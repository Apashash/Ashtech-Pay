import { getAdminPath } from "@/lib/adminPath";
import { useEffect, useState } from "react";
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
import { Search, Code2, Globe, CheckCircle, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface ApiUser {
  id: string;
  fullName: string | null;
  email: string | null;
  username: string | null;
  isVerified: boolean;
  apiEnabled: boolean;
  hasApiKey: boolean;
  createdAt: string | null;
  stats: {
    totalTransactions: number;
    sdkTransactions: number;
    hpTransactions: number;
    linkTransactions: number;
    totalCollected: number;
    sdkCollected: number;
    hpCollected: number;
    linkCollected: number;
  };
}

const MERCHANTS_PER_PAGE = 50;

export default function AdminMerchants() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const { data: users = [], isLoading, isError } = useQuery<ApiUser[]>({
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
        description: `Accès API de ${u?.fullName || "l'utilisateur"} ${enabled ? "activé" : "désactivé"}.`,
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "La mise à jour a échoué.", variant: "destructive" });
    },
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = users.filter(u =>
    [u.fullName, u.email, u.username]
      .some(value => String(value ?? "").toLowerCase().includes(normalizedSearch))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / MERCHANTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * MERCHANTS_PER_PAGE;
  const paginatedUsers = filtered.slice(pageStart, pageStart + MERCHANTS_PER_PAGE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`${getAdminPath()}/api-management`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Marchands</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Activez ou désactivez l'accès API SDK et Hosted Page par marchand.
            </p>
          </div>
        </div>

        {isError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">
                Impossible de charger la liste des marchands. Actualisez la page ou réessayez dans quelques instants.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">
                {filtered.length} marchand{filtered.length > 1 ? "s" : ""}
              </CardTitle>
              <div className="relative flex-1 max-w-xs ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-9 text-sm"
                  data-testid="input-search-merchant"
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
                    <TableHead>Statut KYC</TableHead>
                    <TableHead className="text-center">Clé générée</TableHead>
                    <TableHead className="text-right">Txn SDK</TableHead>
               <TableHead className="text-right">Txn HP</TableHead>
               <TableHead className="text-right">Txn liens</TableHead>
               <TableHead className="text-right">Volume total collecté</TableHead>
                    <TableHead className="text-center">API activée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Chargement…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucun résultat
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedUsers.map((user) => (
                      <TableRow key={user.id} data-testid={`row-merchant-${user.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-foreground">
                              {user.fullName || user.username || user.email || "Marchand sans nom"}
                            </p>
                            <p className="text-xs text-muted-foreground">{user.email || "—"}</p>
                            {user.username && (
                              <p className="text-xs text-muted-foreground">@{user.username}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.isVerified ? (
                            <Badge variant="outline" className="text-green-600 border-green-600 text-xs w-fit">
                              <CheckCircle className="h-3 w-3 mr-1" /> Vérifié
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs w-fit">
                              <AlertCircle className="h-3 w-3 mr-1" /> Non vérifié
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {user.hasApiKey ? (
                            <Badge variant="outline" className="text-sky-600 border-sky-600 text-xs">
                              <Code2 className="h-3 w-3 mr-1" /> Oui
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-medium">{user.stats.sdkTransactions}</span>
                          <span className="text-muted-foreground text-xs ml-1">txn</span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-medium">{user.stats.hpTransactions}</span>
                          <span className="text-muted-foreground text-xs ml-1">txn</span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-medium">{user.stats.linkTransactions}</span>
                          <span className="text-muted-foreground text-xs ml-1">txn</span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-mono font-medium text-foreground">
                            {user.stats.totalCollected.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
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
            {filtered.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-3 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Affichage de {pageStart + 1} à{" "}
                  {Math.min(pageStart + MERCHANTS_PER_PAGE, filtered.length)} sur {filtered.length} marchands
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Précédent
                    </Button>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Page {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Suivant
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Règle</strong> — L'API directe ne peut être activée que si le marchand est KYC-vérifié. Le switch contrôle uniquement le SDK/API directe (<code className="text-xs bg-muted px-1 rounded">ak_</code>) ; le Checkout Page (<code className="text-xs bg-muted px-1 rounded">hp_live_</code>) nécessite seulement un KYC validé.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
