import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LogIn, LogOut, UserPlus, Key, ArrowDownCircle, ArrowRightCircle,
  ShieldCheck, ShieldX, UserX, UserCheck, Shield, Search, ChevronLeft,
  ChevronRight, RefreshCw, AlertCircle, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { AuditLog } from "@shared/schema";

const ACTION_LABELS: Record<string, string> = {
  login_success:      "Connexion réussie",
  login_failed:       "Connexion échouée",
  logout:             "Déconnexion",
  register:           "Inscription",
  password_changed:   "Mot de passe modifié",
  password_reset:     "Réinit. mot de passe",
  withdrawal_created: "Retrait créé",
  withdrawal_failed:  "Retrait échoué",
  transfer_sent:      "Virement envoyé",
  transfer_failed:    "Virement échoué",
  deposit_initiated:  "Dépôt initié",
  payment_link_paid:  "Lien payé",
  role_changed:       "Rôle modifié",
  user_banned:        "Utilisateur banni",
  user_unbanned:      "Utilisateur débanni",
  kyc_approved:       "KYC approuvé",
  kyc_rejected:       "KYC rejeté",
  session_revoked:    "Session révoquée",
  settings_updated:   "Paramètres modifiés",
};

const ACTION_ICONS: Record<string, JSX.Element> = {
  login_success:      <LogIn className="w-4 h-4 text-green-400" />,
  login_failed:       <LogIn className="w-4 h-4 text-red-400" />,
  logout:             <LogOut className="w-4 h-4 text-gray-400" />,
  register:           <UserPlus className="w-4 h-4 text-blue-400" />,
  password_changed:   <Key className="w-4 h-4 text-yellow-400" />,
  password_reset:     <Key className="w-4 h-4 text-orange-400" />,
  withdrawal_created: <ArrowDownCircle className="w-4 h-4 text-purple-400" />,
  withdrawal_failed:  <ArrowDownCircle className="w-4 h-4 text-red-400" />,
  transfer_sent:      <ArrowRightCircle className="w-4 h-4 text-cyan-400" />,
  transfer_failed:    <ArrowRightCircle className="w-4 h-4 text-red-400" />,
  kyc_approved:       <ShieldCheck className="w-4 h-4 text-green-400" />,
  kyc_rejected:       <ShieldX className="w-4 h-4 text-red-400" />,
  user_banned:        <UserX className="w-4 h-4 text-red-400" />,
  user_unbanned:      <UserCheck className="w-4 h-4 text-green-400" />,
  role_changed:       <Shield className="w-4 h-4 text-yellow-400" />,
};

const ACTOR_COLORS: Record<string, string> = {
  user:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
  admin:  "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  system: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const PAGE_SIZE = 50;

interface AuditResponse { logs: AuditLog[]; total: number }

function formatDetails(details: string | null): string {
  if (!details) return "—";
  try {
    const parsed = JSON.parse(details);
    return Object.entries(parsed)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
  } catch {
    return details;
  }
}

export default function AdminAuditLogs() {
  const [search, setSearch]         = useState("");
  const [actionFilter, setAction]   = useState("all");
  const [actorFilter, setActor]     = useState("all");
  const [successFilter, setSuccess] = useState("all");
  const [page, setPage]             = useState(0);

  const params = new URLSearchParams();
  params.set("limit",  String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));
  if (actionFilter !== "all") params.set("action",    actionFilter);
  if (actorFilter  !== "all") params.set("actorType", actorFilter);
  if (successFilter !== "all") params.set("success",  successFilter);

  const { data, isLoading, refetch } = useQuery<AuditResponse>({
    queryKey: ["/api/admin/audit-logs", actionFilter, actorFilter, successFilter, page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erreur de chargement");
      return res.json();
    },
  });

  const logs  = data?.logs ?? [];
  const total = data?.total ?? 0;

  const filtered = search
    ? logs.filter(l =>
        l.action.includes(search.toLowerCase()) ||
        l.userId?.includes(search) ||
        l.ipAddress?.includes(search) ||
        l.details?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-yellow-400" />
            Audit de sécurité
          </h1>
          <p className="text-muted-foreground mt-1">
            Historique complet des événements sensibles — connexion, retrait, rôle, KYC…
          </p>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total événements", value: total, icon: <Shield className="w-4 h-4" /> },
            { label: "Sur cette page", value: logs.length, icon: <RefreshCw className="w-4 h-4" /> },
            { label: "Succès", value: logs.filter(l => l.success).length, icon: <CheckCircle2 className="w-4 h-4 text-green-400" /> },
            { label: "Échecs", value: logs.filter(l => !l.success).length, icon: <AlertCircle className="w-4 h-4 text-red-400" /> },
          ].map(s => (
            <Card key={s.label} className="bg-[#1E2329] border-[#2B3139]">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  {s.icon} {s.label}
                </div>
                <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-[#1E2329] border-[#2B3139]">
          <CardHeader>
            <div className="flex flex-wrap gap-3 items-center">
              {/* Recherche libre */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher userId, IP, action…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  className="pl-10 bg-[#0B0E11] border-[#2B3139]"
                  data-testid="input-search-audit"
                />
              </div>
              {/* Filtre action */}
              <Select value={actionFilter} onValueChange={v => { setAction(v); setPage(0); }}>
                <SelectTrigger className="w-44 bg-[#0B0E11] border-[#2B3139]" data-testid="select-action-filter">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes actions</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Filtre acteur */}
              <Select value={actorFilter} onValueChange={v => { setActor(v); setPage(0); }}>
                <SelectTrigger className="w-36 bg-[#0B0E11] border-[#2B3139]" data-testid="select-actor-filter">
                  <SelectValue placeholder="Acteur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous acteurs</SelectItem>
                  <SelectItem value="user">Utilisateur</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="system">Système</SelectItem>
                </SelectContent>
              </Select>
              {/* Filtre succès */}
              <Select value={successFilter} onValueChange={v => { setSuccess(v); setPage(0); }}>
                <SelectTrigger className="w-32 bg-[#0B0E11] border-[#2B3139]" data-testid="select-success-filter">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="true">Succès</SelectItem>
                  <SelectItem value="false">Échec</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()} className="border-[#2B3139]" data-testid="button-refresh-audit">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2B3139] hover:bg-transparent">
                    <TableHead className="w-8" />
                    <TableHead>Action</TableHead>
                    <TableHead>Acteur</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Détails</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-16">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i} className="border-[#2B3139]">
                        {Array.from({ length: 8 }).map((__, j) => (
                          <TableCell key={j}><div className="h-4 bg-[#2B3139] rounded animate-pulse w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !filtered.length ? (
                    <TableRow className="border-[#2B3139]">
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        Aucun événement d'audit trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(log => (
                      <TableRow key={log.id} className="border-[#2B3139] hover:bg-[#2B3139]/30" data-testid={`audit-row-${log.id}`}>
                        <TableCell className="pl-4">
                          {ACTION_ICONS[log.action] ?? <Shield className="w-4 h-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${ACTOR_COLORS[log.actorType] ?? ""}`}>
                            {log.actorType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                          {log.userId ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                          {formatDetails(log.details)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.ipAddress ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {log.createdAt
                            ? format(new Date(log.createdAt), "d MMM yyyy HH:mm:ss", { locale: fr })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {log.success
                            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                            : <AlertCircle className="w-4 h-4 text-red-400" />}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#2B3139]">
                <span className="text-sm text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} sur {total.toLocaleString()} événements
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="border-[#2B3139]"
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-2 py-1 text-muted-foreground">
                    Page {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="border-[#2B3139]"
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
