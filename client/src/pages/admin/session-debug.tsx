import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Database,
  AlertTriangle,
  Search,
  Loader2,
  Wifi,
  Clock,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface PoolProbe {
  name: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

interface PoolStats {
  errors: number;
  lastError: string | null;
  lastErrorAt: string | null;
  fallbackToMain?: number;
}

interface SessionOpError {
  at: string;
  op: string;
  userId?: string;
  targetSid?: string;
  pool: string;
  error: string;
  stack?: string;
}

interface RawSession {
  sid: string;
  user_id: string | null;
  login_at: string | null;
  client_ip: string | null;
  user_agent: string | null;
  token_ts: string | null;
  expire: string;
  error?: string;
}

interface DiagData {
  worker: { index: string; pid: number };
  pools: { main: PoolProbe; session: PoolProbe };
  poolStats: { main: PoolStats; session: PoolStats };
  sessionOpErrors: SessionOpError[];
  totalSessionOpErrors: number;
  totalSessionsInDb: number | null;
  recentSessionsInDb: RawSession[] | null;
  tip?: string;
  timestamp: string;
}

function PoolCard({ probe, stats, label }: { probe: PoolProbe; stats: PoolStats; label: string }) {
  return (
    <Card className={cn("border", probe.ok ? "border-green-500/30" : "border-red-500/40")}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Database className="w-4 h-4" />
          {label}
          {probe.ok
            ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">OK</Badge>
            : <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">ERREUR</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Latence</span>
          <span className={cn("font-mono", probe.latencyMs > 500 ? "text-yellow-400" : "text-foreground")}>
            {probe.latencyMs}ms
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Erreurs totales</span>
          <span className={cn("font-mono", stats.errors > 0 ? "text-red-400" : "text-foreground")}>
            {stats.errors}
          </span>
        </div>
        {stats.fallbackToMain !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fallback vers main</span>
            <span className={cn("font-mono", stats.fallbackToMain > 0 ? "text-yellow-400" : "text-foreground")}>
              {stats.fallbackToMain}×
            </span>
          </div>
        )}
        {probe.error && (
          <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded p-2 font-mono break-all">
            {probe.error}
          </div>
        )}
        {stats.lastError && (
          <div className="mt-1 text-xs text-muted-foreground">
            Dernière erreur : <span className="text-red-400">{stats.lastError}</span>
            {stats.lastErrorAt && <span className="ml-1">({format(new Date(stats.lastErrorAt), "HH:mm:ss", { locale: fr })})</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function opLabel(op: string) {
  if (op === "disconnect_one") return "Déconnecter 1";
  if (op === "disconnect_all") return "Déconnecter tous";
  if (op === "list") return "Lister sessions";
  return op;
}

function poolBadge(pool: string) {
  if (pool === "both_failed") return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">both_failed</Badge>;
  if (pool === "main") return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs">main (fallback)</Badge>;
  return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">{pool}</Badge>;
}

export default function AdminSessionDebug() {
  const [userId, setUserId] = useState("");
  const [searchUserId, setSearchUserId] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<DiagData>({
    queryKey: ["/api/admin/session-errors", searchUserId],
    queryFn: async () => {
      const url = searchUserId
        ? `/api/admin/session-errors?userId=${encodeURIComponent(searchUserId)}`
        : "/api/admin/session-errors";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary" />
              Diagnostic Sessions
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              État des pools Supabase · Erreurs d'opérations · Sessions en DB
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dataUpdatedAt > 0 && (
              <span className="text-xs text-muted-foreground">
                Mis à jour à {format(new Date(dataUpdatedAt), "HH:mm:ss")}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span className="ml-1.5">Actualiser</span>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="text-center py-12 text-muted-foreground">Impossible de charger les données.</div>
        ) : (
          <>
            {/* Worker info */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-2">
              <span>Worker <strong className="text-foreground">{data.worker.index}</strong></span>
              <span>PID <strong className="text-foreground">{data.worker.pid}</strong></span>
              <span>Sessions en DB: <strong className="text-foreground">{data.totalSessionsInDb ?? "?"}</strong></span>
              <span>Erreurs capturées: <strong className={cn(data.totalSessionOpErrors > 0 ? "text-red-400" : "text-foreground")}>{data.totalSessionOpErrors}</strong></span>
            </div>

            {/* Pool status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PoolCard probe={data.pools.main} stats={data.poolStats.main} label="Pool principal" />
              <PoolCard probe={data.pools.session} stats={data.poolStats.session} label="Pool session" />
            </div>

            {/* Session errors */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  Dernières erreurs d'opérations de session
                  {data.sessionOpErrors.length > 0 && (
                    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs ml-1">
                      {data.sessionOpErrors.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {data.sessionOpErrors.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-6 text-sm text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Aucune erreur depuis le démarrage du serveur
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Heure</TableHead>
                          <TableHead className="text-xs">Opération</TableHead>
                          <TableHead className="text-xs">Pool</TableHead>
                          <TableHead className="text-xs">userId</TableHead>
                          <TableHead className="text-xs">Erreur</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.sessionOpErrors.map((err, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono whitespace-nowrap">
                              {format(new Date(err.at), "HH:mm:ss")}
                            </TableCell>
                            <TableCell className="text-xs">{opLabel(err.op)}</TableCell>
                            <TableCell className="text-xs">{poolBadge(err.pool)}</TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {err.userId ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs text-red-400 max-w-xs truncate" title={err.error}>
                              {err.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Session lookup by userId */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Sessions brutes par utilisateur
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="ID utilisateur (ex: 42)"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") setSearchUserId(userId || undefined); }}
                    className="max-w-xs text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => setSearchUserId(userId || undefined)}
                    disabled={isFetching}
                  >
                    {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Chercher</span>
                  </Button>
                  {searchUserId && (
                    <Button size="sm" variant="ghost" onClick={() => { setSearchUserId(undefined); setUserId(""); }}>
                      Effacer
                    </Button>
                  )}
                </div>

                {!data.recentSessionsInDb ? (
                  <p className="text-xs text-muted-foreground">{data.tip}</p>
                ) : data.recentSessionsInDb.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune session trouvée pour cet utilisateur.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">SID</TableHead>
                          <TableHead className="text-xs">IP</TableHead>
                          <TableHead className="text-xs">Appareil</TableHead>
                          <TableHead className="text-xs">Connexion</TableHead>
                          <TableHead className="text-xs">Expiration</TableHead>
                          <TableHead className="text-xs">Token TS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentSessionsInDb.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate" title={s.sid}>
                              {s.sid ? s.sid.slice(0, 12) + "…" : "—"}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{s.client_ip ?? "—"}</TableCell>
                            <TableCell className="text-xs max-w-[140px] truncate" title={s.user_agent ?? ""}>
                              {s.user_agent ? s.user_agent.slice(0, 30) + (s.user_agent.length > 30 ? "…" : "") : "—"}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {s.login_at
                                ? format(new Date(s.login_at), "dd/MM HH:mm", { locale: fr })
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {s.expire
                                ? format(new Date(s.expire), "dd/MM HH:mm", { locale: fr })
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {s.token_ts ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
