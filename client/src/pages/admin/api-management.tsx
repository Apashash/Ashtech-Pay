import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Search, Code2, Globe, TrendingUp, Users, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ApiUser {
  id: string;
  fullName: string;
  email: string;
  username: string;
  isVerified: boolean;
  apiEnabled: boolean;
  hasApiKey: boolean;
  createdAt: string | null;
  stats: {
    totalTransactions: number;
    sdkTransactions: number;
    hpTransactions: number;
    totalCollected: number;
    sdkCollected: number;
    hpCollected: number;
  };
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminApiManagement() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<ApiUser[]>({
    queryKey: ["/api/admin/api-management"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      await apiRequest("POST", `/api/admin/api-management/${userId}/toggle`, { enabled });
    },
    onSuccess: (_, { enabled, userId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-management"] });
      const u = users.find(u => u.id === userId);
      toast({
        title: enabled ? "API activée" : "API désactivée",
        description: `L'accès API de ${u?.fullName || "l'utilisateur"} a été ${enabled ? "activé" : "désactivé"}.`,
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "La mise à jour a échoué.", variant: "destructive" });
    },
  });

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const totalCollected = users.reduce((s, u) => s + u.stats.totalCollected, 0);
  const totalHp = users.reduce((s, u) => s + u.stats.hpCollected, 0);
  const activeApis = users.filter(u => u.apiEnabled).length;
  const verifiedUsers = users.filter(u => u.isVerified).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des API</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Activez ou désactivez l'accès API SDK et Hosted Page par marchand. Consultez les volumes collectés.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Marchands total" value={users.length} />
          <StatCard icon={CheckCircle} label="API activées" value={activeApis} sub={`sur ${verifiedUsers} vérifiés`} />
          <StatCard icon={TrendingUp} label="Volume total collecté" value={`${totalCollected.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XAF`} />
          <StatCard icon={Globe} label="Via Hosted Page" value={`${totalHp.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XAF`} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">Marchands</CardTitle>
              <div className="relative flex-1 max-w-xs ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un marchand…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                  data-testid="input-search-user"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marchand</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center">Clé API</TableHead>
                    <TableHead className="text-right">Transactions HP</TableHead>
                    <TableHead className="text-right">Volume collecté</TableHead>
                    <TableHead className="text-right">HP collecté</TableHead>
                    <TableHead className="text-center">API activée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Chargement…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Aucun résultat
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-foreground">{user.fullName}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {user.isVerified ? (
                              <Badge variant="outline" className="text-green-600 border-green-600 text-xs w-fit">
                                <CheckCircle className="h-3 w-3 mr-1" /> Vérifié
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs w-fit">
                                <AlertCircle className="h-3 w-3 mr-1" /> Non vérifié
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {user.hasApiKey ? (
                            <Badge variant="outline" className="text-sky-600 border-sky-600 text-xs">
                              <Code2 className="h-3 w-3 mr-1" /> Générée
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-medium">{user.stats.hpTransactions}</span>
                          <span className="text-muted-foreground text-xs ml-1">txn</span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-mono font-medium">
                            {user.stats.totalCollected.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-muted-foreground text-xs ml-1">XAF</span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-mono font-medium text-sky-600">
                            {user.stats.hpCollected.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-muted-foreground text-xs ml-1">XAF</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              checked={user.apiEnabled}
                              disabled={!user.isVerified || toggleMutation.isPending}
                              onCheckedChange={(enabled) =>
                                toggleMutation.mutate({ userId: user.id, enabled })
                              }
                              data-testid={`switch-api-${user.id}`}
                            />
                            {!user.isVerified && (
                              <span className="text-[10px] text-muted-foreground">KYC requis</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <strong className="text-foreground">Règles d'accès</strong> — Un marchand ne peut activer son API que si son compte est vérifié (KYC approuvé).
                Même vérifié, l'API reste désactivée jusqu'à votre activation manuelle ici.
                Les deux API (SDK <code className="text-xs bg-muted px-1 rounded">ak_</code> et Hosted Page <code className="text-xs bg-muted px-1 rounded">hp_live_</code>) sont contrôlées par le même interrupteur.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
