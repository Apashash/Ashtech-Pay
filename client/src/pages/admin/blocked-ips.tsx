import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldBan, Clock, Unlock, RefreshCw, WifiOff, Ban, Plus, Infinity } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BlockedIp {
  ip: string;
  identifier: string;
  blockedUntil: number;
  blockedAt: number;
}

interface AdminPanelBlock {
  ip: string;
  blockedAt: number;
  expiresAt?: number;
}

function useCountdown(blockedUntil: number) {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
      setRemaining(diff);
      if (diff <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [blockedUntil]);

  return remaining;
}

function CountdownCell({ blockedUntil }: { blockedUntil: number }) {
  const remaining = useCountdown(blockedUntil);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return (
    <div className="flex items-center gap-2">
      <Clock className="w-3.5 h-3.5 text-red-400 shrink-0" />
      <span className="font-mono text-red-400 font-semibold tabular-nums">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}

function ExpiryBadge({ expiresAt }: { expiresAt?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!expiresAt) {
    return (
      <div className="flex items-center gap-1.5 text-orange-400">
        <Infinity className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Permanent</span>
      </div>
    );
  }

  const diffMs = expiresAt - now;
  if (diffMs <= 0) {
    return <span className="text-xs text-muted-foreground">Expiré</span>;
  }

  const diffDays = Math.ceil(diffMs / 86_400_000);
  const diffHours = Math.ceil(diffMs / 3_600_000);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-amber-400 font-medium">
        {diffDays >= 2 ? `${diffDays} jours restants` : diffHours <= 24 ? `${diffHours}h restantes` : `${diffDays} jour restant`}
      </span>
      <span className="text-xs text-muted-foreground">
        Expire le {format(new Date(expiresAt), "dd/MM/yyyy", { locale: fr })}
      </span>
    </div>
  );
}

export default function BlockedIpsPage() {
  const { toast } = useToast();
  const [newIp, setNewIp] = useState("");
  const [days, setDays] = useState("");

  const { data: blockedIps = [], isLoading, refetch } = useQuery<BlockedIp[]>({
    queryKey: ["/api/admin/blocked-ips"],
    refetchInterval: 5000,
  });

  const { data: panelData, refetch: refetchPanel } = useQuery<{ blocks: AdminPanelBlock[] }>({
    queryKey: ["/api/admin/panel-blocked-ips"],
    refetchInterval: 15000,
  });
  const panelBlocks = panelData?.blocks ?? [];

  const { data: myIpData } = useQuery<{ ip: string }>({
    queryKey: ["/api/admin/my-ip"],
  });

  const unblockMutation = useMutation({
    mutationFn: async (ip: string) => {
      await apiRequest("DELETE", `/api/admin/blocked-ips/${encodeURIComponent(ip)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-ips"] });
      toast({ title: "IP débloquée", description: "L'adresse IP a été débloquée manuellement." });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const addBlockMutation = useMutation({
    mutationFn: async ({ ip, days }: { ip: string; days?: number }) => {
      const res = await apiRequest("POST", "/api/admin/panel-blocked-ips", { ip, days });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panel-blocked-ips"] });
      setNewIp("");
      setDays("");
      toast({ title: "IP bloquée", description: "Cette IP ne peut plus accéder au panneau admin." });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const removeBlockMutation = useMutation({
    mutationFn: async (ip: string) => {
      await apiRequest("DELETE", `/api/admin/panel-blocked-ips/${encodeURIComponent(ip)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panel-blocked-ips"] });
      toast({ title: "Accès rétabli", description: "L'IP peut à nouveau accéder au panneau admin." });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleAdd = () => {
    const trimmed = newIp.trim();
    if (!trimmed) return;
    const daysNum = days.trim() ? parseInt(days.trim(), 10) : undefined;
    addBlockMutation.mutate({ ip: trimmed, days: daysNum });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldBan className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold">IPs Bloquées</h1>
              <p className="text-sm text-muted-foreground">Gestion des accès par adresse IP</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchPanel(); }} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </Button>
        </div>

        {/* ── Section 1 : Blocage manuel du panneau admin ─────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ban className="w-4 h-4 text-orange-400" />
              Bloquer une IP du panneau admin
              {panelBlocks.length > 0 && (
                <Badge className="ml-2 bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs">
                  {panelBlocks.length} IP{panelBlocks.length > 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Toutes les IPs peuvent accéder au panneau admin par défaut. Bloquez manuellement une IP avec ou sans limite de durée.
              {myIpData?.ip && (
                <span className="ml-1">Votre IP : <code className="bg-muted px-1 rounded">{myIpData.ip}</code></span>
              )}
            </p>

            {/* Add form */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Adresse IP</Label>
                <Input
                  placeholder="ex: 192.168.1.100"
                  value={newIp}
                  onChange={e => setNewIp(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                  className="font-mono text-sm w-48"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Durée (jours) <span className="text-muted-foreground/60">— vide = permanent</span>
                </Label>
                <Input
                  placeholder="ex: 7"
                  value={days}
                  onChange={e => setDays(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                  className="w-28 text-sm"
                  type="number"
                  min="1"
                  max="3650"
                />
              </div>
              <Button
                className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={handleAdd}
                disabled={!newIp.trim() || addBlockMutation.isPending}
              >
                <Plus className="w-3.5 h-3.5" />
                Bloquer
              </Button>
              {myIpData?.ip && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs self-end mb-0.5"
                  onClick={() => setNewIp(myIpData.ip)}
                >
                  Mon IP
                </Button>
              )}
            </div>

            {/* Panel blocked list */}
            {panelBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <ShieldBan className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm">Aucune IP bloquée du panneau admin</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adresse IP</TableHead>
                    <TableHead>Bloqué le</TableHead>
                    <TableHead>Durée / Expiration</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {panelBlocks.map((block) => (
                    <TableRow key={block.ip}>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono">{block.ip}</code>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(block.blockedAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ExpiryBadge expiresAt={block.expiresAt} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs border-green-500/30 text-green-500 hover:bg-green-500/10"
                          onClick={() => removeBlockMutation.mutate(block.ip)}
                          disabled={removeBlockMutation.isPending}
                        >
                          <Unlock className="w-3 h-3" />
                          Débloquer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ── Section 2 : IPs auto-bloquées (trop de tentatives) ─────────── */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-red-400" />
              Tentatives d'intrusion — blocage automatique
              {blockedIps.length > 0 && (
                <Badge className="ml-2 bg-red-500/10 text-red-500 border-red-500/20 text-xs">
                  {blockedIps.length} IP{blockedIps.length > 1 ? "s" : ""}
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground font-normal">Auto toutes les 5s</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              IPs bloquées automatiquement après trop de tentatives de connexion échouées. Débloquées automatiquement après 30 min. Ce blocage ne s'applique <strong>pas</strong> au panneau admin.
            </p>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : blockedIps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <ShieldBan className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-sm font-medium">Aucune IP bloquée en ce moment</p>
                <p className="text-xs text-muted-foreground/60">Actualisation automatique toutes les 5 secondes.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adresse IP</TableHead>
                    <TableHead>Identifiant tenté</TableHead>
                    <TableHead>Bloqué à</TableHead>
                    <TableHead>Temps restant</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedIps.map((entry) => (
                    <TableRow key={entry.ip}>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono">{entry.ip}</code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-amber-400 font-medium">{entry.identifier}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.blockedAt), "HH:mm:ss", { locale: fr })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <CountdownCell blockedUntil={entry.blockedUntil} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs border-green-500/30 text-green-500 hover:bg-green-500/10"
                          onClick={() => unblockMutation.mutate(entry.ip)}
                          disabled={unblockMutation.isPending}
                        >
                          <Unlock className="w-3 h-3" />
                          Débloquer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
