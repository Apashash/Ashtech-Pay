import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldBan, Clock, Unlock, RefreshCw, WifiOff } from "lucide-react";
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

export default function BlockedIpsPage() {
  const { toast } = useToast();

  const { data: blockedIps = [], isLoading, refetch } = useQuery<BlockedIp[]>({
    queryKey: ["/api/admin/blocked-ips"],
    refetchInterval: 5000,
  });

  const unblockMutation = useMutation({
    mutationFn: async (ip: string) => {
      await apiRequest("DELETE", `/api/admin/blocked-ips/${encodeURIComponent(ip)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-ips"] });
      toast({ title: "IP débloquée", description: "L'adresse IP a été débloquée manuellement." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

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
              <p className="text-sm text-muted-foreground">Surveillance en temps réel des tentatives d'intrusion</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {blockedIps.length > 0 && (
              <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-sm px-3 py-1">
                {blockedIps.length} IP{blockedIps.length > 1 ? "s" : ""} bloquée{blockedIps.length > 1 ? "s" : ""}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </Button>
          </div>
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-red-400" />
              Adresses IP actuellement bloquées
              <span className="ml-auto text-xs text-muted-foreground font-normal">Actualisation auto toutes les 5s</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : blockedIps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <ShieldBan className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-sm font-medium">Aucune IP bloquée en ce moment</p>
                <p className="text-xs text-muted-foreground/60">La liste s'actualise automatiquement toutes les 5 secondes.</p>
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
                    <TableRow key={entry.ip} data-testid={`row-blocked-ip-${entry.ip}`}>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono" data-testid={`text-ip-${entry.ip}`}>
                          {entry.ip}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-amber-400 font-medium" data-testid={`text-identifier-${entry.ip}`}>
                          {entry.identifier}
                        </span>
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
                          data-testid={`button-unblock-${entry.ip}`}
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
