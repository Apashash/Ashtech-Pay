import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Shield,
  User,
  CreditCard,
  Globe,
  Settings,
  MessageSquare,
  DollarSign,
  Link2,
  LogOut,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AdminLog } from "@shared/schema";

export default function AdminLogs() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: logs, isLoading } = useQuery<AdminLog[]>({
    queryKey: ["/api/admin/logs"],
  });

  const disconnectAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/admin/sessions/all");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      toast({
        title: "Déconnexion globale effectuée",
        description: data.count > 0
          ? `${data.count} session(s) révoquée(s).`
          : "Aucune session active trouvée.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message || "Impossible de déconnecter les utilisateurs.", variant: "destructive" });
    },
  });

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || log.targetType === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  const getActionIcon = (targetType: string | null) => {
    switch (targetType) {
      case "user":
        return <User className="w-4 h-4 text-blue-500" />;
      case "transaction":
        return <CreditCard className="w-4 h-4 text-green-500" />;
      case "country":
      case "operator":
        return <Globe className="w-4 h-4 text-purple-500" />;
      case "fee":
        return <DollarSign className="w-4 h-4 text-yellow-500" />;
      case "ticket":
        return <MessageSquare className="w-4 h-4 text-orange-500" />;
      case "setting":
        return <Settings className="w-4 h-4 text-gray-500" />;
      case "payment_link":
        return <Link2 className="w-4 h-4 text-cyan-500" />;
      default:
        return <Shield className="w-4 h-4 text-red-500" />;
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes("create")) return <Badge className="bg-green-500">Création</Badge>;
    if (action.includes("update")) return <Badge className="bg-blue-500">Modification</Badge>;
    if (action.includes("delete")) return <Badge variant="destructive">Suppression</Badge>;
    if (action.includes("ban")) return <Badge variant="destructive">Bannissement</Badge>;
    if (action.includes("unban")) return <Badge className="bg-green-500">Débannissement</Badge>;
    return <Badge variant="secondary">{action}</Badge>;
  };

  const formatDetails = (details: string | null) => {
    if (!details) return "-";
    try {
      const parsed = JSON.parse(details);
      return Object.entries(parsed)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
    } catch {
      return details;
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Logs & Sécurité</h1>
            <p className="text-muted-foreground">Historique des actions administratives</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex items-center gap-2" data-testid="button-disconnect-all-users">
                <LogOut className="w-4 h-4" />
                Déconnecter tous les utilisateurs
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Déconnexion globale</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action va immédiatement déconnecter <strong>tous les comptes connectés</strong> sur la plateforme, <strong>vous y compris</strong>. Toutes les sessions seront supprimées et tous les tokens révoqués. Vous serez redirigé vers la page de connexion.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => disconnectAllMutation.mutate()}
                  disabled={disconnectAllMutation.isPending}
                  data-testid="button-confirm-disconnect-all"
                >
                  {disconnectAllMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Déconnexion...</>
                  ) : "Oui, déconnecter tout le monde"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans les logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-logs"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40" data-testid="select-type-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="user">Utilisateurs</SelectItem>
                  <SelectItem value="transaction">Transactions</SelectItem>
                  <SelectItem value="country">Pays</SelectItem>
                  <SelectItem value="operator">Opérateurs</SelectItem>
                  <SelectItem value="fee">Frais</SelectItem>
                  <SelectItem value="ticket">Tickets</SelectItem>
                  <SelectItem value="setting">Paramètres</SelectItem>
                  <SelectItem value="payment_link">Liens</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Détails</TableHead>
                  <TableHead>Adresse IP</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Chargement...</TableCell>
                  </TableRow>
                ) : !filteredLogs.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun log trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.targetType)}
                          <span className="capitalize">{log.targetType || "system"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                        {formatDetails(log.details)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.ipAddress || "-"}
                      </TableCell>
                      <TableCell>
                        {log.createdAt ? format(new Date(log.createdAt), "d MMM yyyy HH:mm", { locale: fr }) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
