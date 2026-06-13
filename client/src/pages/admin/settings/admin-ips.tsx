import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Ban, Plus, Trash2, Loader2, Info, Wifi } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettingsAdminIps() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [newIp, setNewIp] = useState("");

  const { data, isLoading } = useQuery<{ ips: string[] }>({
    queryKey: ["/api/admin/panel-blocked-ips"],
  });

  const { data: myIpData } = useQuery<{ ip: string }>({
    queryKey: ["/api/admin/my-ip"],
  });

  const ips = data?.ips ?? [];

  const addMutation = useMutation({
    mutationFn: async (ip: string) => {
      const res = await apiRequest("POST", "/api/admin/panel-blocked-ips", { ip });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur");
      return json;
    },
    onSuccess: () => {
      setNewIp("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panel-blocked-ips"] });
      toast({ title: "IP bloquée", description: "Cette IP ne peut plus accéder au panneau admin." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (ip: string) => {
      const res = await apiRequest("DELETE", `/api/admin/panel-blocked-ips/${encodeURIComponent(ip)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panel-blocked-ips"] });
      toast({ title: "Accès rétabli", description: "L'IP peut à nouveau accéder au panneau admin." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleAdd = () => {
    const trimmed = newIp.trim();
    if (!trimmed) return;
    addMutation.mutate(trimmed);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation("/admin/settings")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">IPs bloquées du panneau admin</h1>
            <p className="text-muted-foreground text-sm">N'importe quelle IP peut accéder au panneau admin par défaut</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-600 dark:text-blue-400 mb-1">
              Accès ouvert à toutes les IPs
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Toutes les IPs peuvent accéder au panneau admin par défaut. Ajoutez ici les IPs que vous souhaitez <strong>bloquer définitivement</strong> du panneau.
            </p>
          </div>
        </div>

        {/* My current IP */}
        {myIpData?.ip && (
          <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3">
            <Wifi className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Votre IP actuelle :</p>
              <p className="font-mono font-semibold text-foreground">{myIpData.ip}</p>
            </div>
            {ips.includes(myIpData.ip) && (
              <Badge className="bg-red-500/10 text-red-500 border-red-500/30 text-xs">Bloquée</Badge>
            )}
          </div>
        )}

        {/* Add IP */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Ban className="w-4 h-4 text-destructive" />
              Bloquer une IP
            </CardTitle>
            <CardDescription>Format IPv4 (ex: 105.234.17.42)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="105.234.17.42"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                data-testid="input-new-ip"
              />
              <Button
                onClick={handleAdd}
                disabled={!newIp.trim() || addMutation.isPending}
                variant="destructive"
                className="gap-2 shrink-0"
                data-testid="button-add-ip"
              >
                {addMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Bloquer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* IP list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 justify-between">
              <span>IPs bloquées du panneau admin</span>
              <Badge variant="outline" className="font-mono">
                {isLoading ? "…" : ips.length === 0 ? "Aucune" : `${ips.length} IP${ips.length > 1 ? "s" : ""}`}
              </Badge>
            </CardTitle>
            {ips.length === 0 && !isLoading && (
              <CardDescription className="text-green-600 dark:text-green-400">
                ✓ Aucune IP bloquée — tout le monde peut accéder au panneau admin.
              </CardDescription>
            )}
          </CardHeader>
          {(isLoading || ips.length > 0) && (
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement…
                </div>
              ) : (
                <div className="space-y-2">
                  {ips.map((ip) => (
                    <div
                      key={ip}
                      className="flex items-center justify-between bg-muted/50 border border-border rounded-lg px-4 py-2.5"
                      data-testid={`row-ip-${ip}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="font-mono text-sm font-medium text-foreground">{ip}</span>
                        {myIpData?.ip === ip && (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">Votre IP</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
                        onClick={() => removeMutation.mutate(ip)}
                        disabled={removeMutation.isPending}
                        data-testid={`button-remove-ip-${ip}`}
                      >
                        {removeMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* How it works */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Comment ça fonctionne</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>• <strong>Liste vide</strong> = aucune restriction, toutes les IPs peuvent accéder normalement.</p>
            <p>• <strong>IP ajoutée</strong> = cette IP est bloquée définitivement du panneau admin.</p>
            <p>• Vérification toutes les <strong>3 secondes</strong> pendant la session admin.</p>
            <p>• Si l'IP de l'admin est bloquée → <strong>déconnexion immédiate</strong>.</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
