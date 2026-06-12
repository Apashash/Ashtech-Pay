import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  XCircle, 
  Clock, 
  Ban, 
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Filter,
  Send,
  Link2,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Zap,
  Sun,
  Wallet
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

type StatsPeriod = "last_year" | "this_year" | "last_month" | "this_month" | "last_week" | "this_week" | "yesterday" | "today";

const periodLabels: Record<StatsPeriod, string> = {
  last_year: "Année Passée",
  this_year: "Cette Année",
  last_month: "Mois Passé",
  this_month: "Ce Mois-ci",
  last_week: "Semaine Passée",
  this_week: "Cette Semaine",
  yesterday: "Hier",
  today: "Aujourd'hui",
};

interface TotalBalances {
  totalXAF: number;
  breakdown: { currency: string; amount: string; amountXAF: number }[];
}

interface AdminStats {
  totalUsers: number;
  apiEnabledUsers: number;
  totalTransactions: number;
  totalVolume: string;
  monthlyTransactions: number;
  rejectedTransactions: number;
  pendingTransactions: number;
  bannedUsers: number;
  totalDeposits: string;
  totalWithdrawals: string;
  totalCollected: string;
  totalWithdrawn: string;
  totalRevenue: string;
  depositFees: string;
  withdrawalFees: string;
  transferFees: string;
  paymentLinkFees: string;
  conversionFees: string;
  depositCount: number;
  withdrawalCount: number;
  transferCount: number;
  paymentLinkCount: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  pendingTransfers: number;
  statsResetAt: string | null;
}

interface SessionInfo {
  otpValid: boolean;
  tier1_memory: boolean;
  tier2_session: boolean;
  tier3_db: boolean;
  tier3_dbError: string | null;
  ip: string;
  whitelistActive: boolean;
  ipAllowed: boolean;
  whitelistCount: number;
  role: string;
  totpEnabled: boolean;
  timestamp: string;
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<StatsPeriod>("this_month");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [diagInfo, setDiagInfo] = useState<SessionInfo | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const { toast } = useToast();
  
  const { data: stats, isLoading, error: statsError, refetch: refetchStats } = useQuery<AdminStats>({
    queryKey: [`/api/admin/stats?period=${period}`],
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/reset-stats"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/stats?period=${period}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/by-country"] });
      setShowResetDialog(false);
      toast({ title: "Réinitialisé", description: "Les statistiques ont été remises à zéro." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "La réinitialisation a échoué.", variant: "destructive" });
    },
  });

  const { data: todayStats, isLoading: todayLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats?period=today"],
    refetchInterval: 30000,
  });

  const { data: activityData = [] } = useQuery<{ date: string; deposit: number; withdrawal: number; payment_link: number; transfer: number; api_deposit: number; depositVol: number; withdrawalVol: number; paymentLinkVol: number; transferVol: number; apiDepositVol: number }[]>({
    queryKey: [`/api/admin/stats/activity?period=${period}`],
    refetchInterval: 30000,
  });

  const { data: countryData = [] } = useQuery<{ country: string; volume: number; count: number }[]>({
    queryKey: ["/api/admin/stats/by-country"],
    refetchInterval: 30000,
  });

  const { data: totalBalances, isLoading: balancesLoading } = useQuery<TotalBalances>({
    queryKey: ["/api/admin/stats/total-balances"],
    refetchInterval: 60000,
  });

  const chartActivity = activityData.map(d => {
    const isHourly = d.date.length === 13;
    const label = isHourly
      ? format(new Date(d.date + ":00:00Z"), "HH'h'", { locale: fr })
      : format(new Date(d.date), "dd/MM", { locale: fr });
    return { ...d, label };
  });

  const kpiCards = [
    {
      title: "Total Utilisateurs",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Utilisateurs API activée",
      value: stats?.apiEnabledUsers || 0,
      icon: Zap,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      href: "/admin/api-management",
    },
    {
      title: "Total Transactions",
      value: stats?.totalTransactions || 0,
      icon: CreditCard,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Volume Total",
      value: formatCurrency(parseFloat(stats?.totalVolume || "0"), "XAF"),
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Volume Dépôts",
      value: formatCurrency(parseFloat(stats?.totalDeposits || "0"), "XAF"),
      icon: ArrowDownCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Volume Retraits",
      value: formatCurrency(parseFloat(stats?.totalWithdrawals || "0"), "XAF"),
      icon: ArrowUpCircle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Revenus Ashtech Pay (Marge)",
      value: formatCurrency(parseFloat(stats?.totalRevenue || "0"), "XAF"),
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Dépôts",
      value: stats?.depositCount || 0,
      icon: ArrowDownCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      pending: stats?.pendingDeposits || 0,
      href: stats?.pendingDeposits ? "/admin/transactions/deposits?status=pending" : "/admin/transactions/deposits",
    },
    {
      title: "Retraits",
      value: stats?.withdrawalCount || 0,
      icon: ArrowUpCircle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      pending: stats?.pendingWithdrawals || 0,
      href: stats?.pendingWithdrawals ? "/admin/transactions/withdrawals?status=pending" : "/admin/transactions/withdrawals",
    },
    {
      title: "Envois",
      value: stats?.transferCount || 0,
      icon: Send,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      pending: stats?.pendingTransfers || 0,
      href: stats?.pendingTransfers ? "/admin/transactions/transfers?status=pending" : "/admin/transactions/transfers",
    },
    {
      title: "Liens de paiement",
      value: stats?.paymentLinkCount || 0,
      icon: Link2,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      href: "/admin/transactions/deposits",
    },
    {
      title: "Transactions Rejetées",
      value: stats?.rejectedTransactions || 0,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      href: "/admin/transactions?status=failed",
    },
    {
      title: "En Attente",
      value: stats?.pendingTransactions || 0,
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      href: "/admin/transactions?status=pending",
    },
    {
      title: "Utilisateurs Bannis",
      value: stats?.bannedUsers || 0,
      icon: Ban,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];

  const gridCols = kpiCards.length > 9 ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {statsError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Erreur de chargement des statistiques</p>
                <p className="text-xs mt-1 text-red-300 break-words">{(statsError as Error).message || "Erreur inconnue"}</p>
                <p className="text-xs mt-1 text-red-300/70">Cause possible : IP non autorisée, session OTP expirée, ou problème réseau.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10" disabled={diagLoading} onClick={async () => {
                  setDiagLoading(true);
                  setDiagInfo(null);
                  try {
                    const res = await apiRequest("GET", "/api/admin/session-info");
                    const data = await res.json();
                    setDiagInfo(data);
                  } catch (e: any) {
                    toast({ title: "Diagnostic échoué", description: e.message, variant: "destructive" });
                  } finally {
                    setDiagLoading(false);
                  }
                }}>
                  {diagLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Diagnostic"}
                </Button>
                <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10" onClick={() => refetchStats()}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Réessayer
                </Button>
              </div>
            </div>
            {diagInfo && (
              <div className="border-t border-red-500/20 p-4 bg-black/20 text-xs space-y-1 font-mono">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <span className="text-red-300/70">OTP Valide :</span>
                  <span className={diagInfo.otpValid ? "text-green-400" : "text-red-400"}>{diagInfo.otpValid ? "✓ Oui" : "✗ Non"}</span>
                  <span className="text-red-300/70">Tier 1 (mémoire) :</span>
                  <span className={diagInfo.tier1_memory ? "text-green-400" : "text-amber-400"}>{diagInfo.tier1_memory ? "✓" : "✗"}</span>
                  <span className="text-red-300/70">Tier 2 (session) :</span>
                  <span className={diagInfo.tier2_session ? "text-green-400" : "text-amber-400"}>{diagInfo.tier2_session ? "✓" : "✗"}</span>
                  <span className="text-red-300/70">Tier 3 (base de données) :</span>
                  <span className={diagInfo.tier3_db ? "text-green-400" : "text-amber-400"}>{diagInfo.tier3_db ? "✓" : diagInfo.tier3_dbError ? `✗ ${diagInfo.tier3_dbError}` : "✗"}</span>
                  <span className="text-red-300/70">IP actuelle :</span>
                  <span className="text-red-200">{diagInfo.ip}</span>
                  <span className="text-red-300/70">Whitelist IP active :</span>
                  <span className={diagInfo.whitelistActive ? "text-amber-400" : "text-green-400"}>{diagInfo.whitelistActive ? `Oui (${diagInfo.whitelistCount} IP)` : "Non"}</span>
                  <span className="text-red-300/70">IP autorisée :</span>
                  <span className={diagInfo.ipAllowed ? "text-green-400" : "text-red-400 font-bold"}>{diagInfo.ipAllowed ? "✓ Oui" : "✗ Non — ajoutez votre IP dans Paramètres → IP Whitelist"}</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Administrateur</h1>
            <p className="text-muted-foreground">
              Vue d'ensemble de la plateforme
              {stats?.statsResetAt && (
                <span className="ml-2 text-xs text-amber-500">
                  · Réinitialisé le {format(new Date(stats.statsResetAt), "dd/MM/yyyy à HH:mm", { locale: fr })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-red-500/50 text-red-500 hover:bg-red-500/10"
              onClick={() => setShowResetDialog(true)}
              data-testid="button-reset-stats"
            >
              <RotateCcw className="w-4 h-4" />
              Réinitialiser
            </Button>
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={period} onValueChange={(value) => setPeriod(value as StatsPeriod)}>
              <SelectTrigger className="w-[180px]" data-testid="select-period">
                <SelectValue placeholder="Sélectionner une période" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(periodLabels) as [StatsPeriod, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key} data-testid={`period-${key}`}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Revenus du jour — toujours affiché indépendamment du filtre de période */}
        <Card className="border-2 border-primary/40 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/20">
                  <Sun className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Revenus du jour (marge Ashtech Pay)</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-right">
                  {todayLoading ? (
                    <Skeleton className="h-9 w-32" />
                  ) : (
                    <p className="text-3xl font-bold text-primary">
                      {formatCurrency(parseFloat(todayStats?.totalRevenue || "0"), "XAF")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">Total marges encaissées</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Dépôts:</span>
                  <span className="font-semibold text-right">{todayLoading ? "…" : formatCurrency(parseFloat(todayStats?.depositFees || "0"), "XAF")}</span>
                  <span className="text-muted-foreground">Retraits:</span>
                  <span className="font-semibold text-right">{todayLoading ? "…" : formatCurrency(parseFloat(todayStats?.withdrawalFees || "0"), "XAF")}</span>
                  <span className="text-muted-foreground">Envois:</span>
                  <span className="font-semibold text-right">{todayLoading ? "…" : formatCurrency(parseFloat(todayStats?.transferFees || "0"), "XAF")}</span>
                  <span className="text-muted-foreground">Liens:</span>
                  <span className="font-semibold text-right">{todayLoading ? "…" : formatCurrency(parseFloat(todayStats?.paymentLinkFees || "0"), "XAF")}</span>
                  <span className="text-muted-foreground">Conversions:</span>
                  <span className="font-semibold text-right">{todayLoading ? "…" : formatCurrency(parseFloat(todayStats?.conversionFees || "0"), "XAF")}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="w-3 h-3" />
                  <span>Mise à jour auto toutes les 30s</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={`grid ${gridCols} gap-4`}>
          {kpiCards.map((card, index) => {
            const cardContent = (
              <Card key={index} data-testid={`kpi-card-${index}`} className={"href" in card ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </CardTitle>
                    {"pending" in card && (card.pending as number) > 0 && (
                      <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">
                        {card.pending} en attente
                      </Badge>
                    )}
                  </div>
                  <div className={`p-2 rounded-lg ${card.bgColor}`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div>
                      <p className="text-2xl font-bold">{card.value}</p>
                      {"subValue" in card && card.subValue && (
                        <p className="text-sm text-muted-foreground mt-1">{card.subValue}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
            return "href" in card ? (
              <Link key={index} href={(card as any).href}>{cardContent}</Link>
            ) : cardContent;
          })}
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Revenus</p>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              Revenus Ashtech Pay — Marge uniquement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Marge Dépôts</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <p className="text-lg font-bold text-green-500">
                    {formatCurrency(parseFloat(stats?.depositFees || "0"), "XAF")}
                  </p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpCircle className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Marge Retraits</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <p className="text-lg font-bold text-orange-500">
                    {formatCurrency(parseFloat(stats?.withdrawalFees || "0"), "XAF")}
                  </p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Send className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Marge Envois</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <p className="text-lg font-bold text-blue-500">
                    {formatCurrency(parseFloat(stats?.transferFees || "0"), "XAF")}
                  </p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Marge Liens Paiement</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <p className="text-lg font-bold text-purple-500">
                    {formatCurrency(parseFloat(stats?.paymentLinkFees || "0"), "XAF")}
                  </p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-4 h-4 text-teal-500" />
                  <span className="text-sm text-muted-foreground">Marge Conversion</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <p className="text-lg font-bold text-teal-500">
                    {formatCurrency(parseFloat(stats?.conversionFees || "0"), "XAF")}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Total des revenus</span>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(parseFloat(stats?.totalRevenue || "0"), "XAF")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Solde total disponible sur la plateforme */}
        <Card className="border-2 border-blue-500/40 bg-gradient-to-r from-blue-500/5 to-blue-600/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <Wallet className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Solde total disponible — Tous les comptes utilisateurs</p>
                  <p className="text-xs text-muted-foreground">Somme de tous les wallets convertis en XAF · Mise à jour toutes les 60s</p>
                </div>
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-right">
                  {balancesLoading ? (
                    <Skeleton className="h-9 w-40" />
                  ) : (
                    <p className="text-3xl font-bold text-blue-500" data-testid="text-total-platform-balance">
                      {formatCurrency(totalBalances?.totalXAF || 0, "XAF")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">Équivalent XAF total</p>
                </div>
                {!balancesLoading && totalBalances?.breakdown && totalBalances.breakdown.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs max-w-xs">
                    {totalBalances.breakdown.slice(0, 8).map(b => (
                      <div key={b.currency} className="contents">
                        <span className="text-muted-foreground font-medium">{b.currency}:</span>
                        <span className="font-semibold text-right">{parseFloat(b.amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transactions entrantes vs sortantes — 30 derniers jours */}
          <Card>
            <CardHeader>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Activité</p>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                Flux transactions par type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-3 flex-wrap text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Dépôt</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" />Dépôt API</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />Retrait</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />Lien paiement</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />Envoi</span>
              </div>
              {activityData.length === 0 || activityData.every(d => d.deposit === 0 && d.api_deposit === 0 && d.withdrawal === 0 && d.payment_link === 0 && d.transfer === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aucune activité sur cette période</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartActivity} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDeposit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorApiDeposit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorWithdrawal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPaymentLink" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTransfer" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#888" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#ccc" }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = { deposit: "Dépôt", api_deposit: "Dépôt API", withdrawal: "Retrait", payment_link: "Lien paiement", transfer: "Envoi" };
                        return [value, labels[name] || name];
                      }}
                    />
                    <Area type="monotone" dataKey="deposit" stroke="#22c55e" fill="url(#colorDeposit)" strokeWidth={2} dot={false} name="deposit" />
                    <Area type="monotone" dataKey="api_deposit" stroke="#22d3ee" fill="url(#colorApiDeposit)" strokeWidth={2} dot={false} name="api_deposit" />
                    <Area type="monotone" dataKey="withdrawal" stroke="#f97316" fill="url(#colorWithdrawal)" strokeWidth={2} dot={false} name="withdrawal" />
                    <Area type="monotone" dataKey="payment_link" stroke="#a855f7" fill="url(#colorPaymentLink)" strokeWidth={2} dot={false} name="payment_link" />
                    <Area type="monotone" dataKey="transfer" stroke="#3b82f6" fill="url(#colorTransfer)" strokeWidth={2} dot={false} name="transfer" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top 8 pays par nombre de transactions */}
          <Card>
            <CardHeader>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Géographie</p>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                Top 8 pays — Nombre de transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {countryData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aucune donnée disponible</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={countryData} layout="vertical" margin={{ top: 0, right: 30, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#888" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="country" tick={{ fontSize: 10, fill: "#ccc" }} width={90} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => [value, "Transactions"]}
                    />
                    <Bar dataKey="count" fill="#F0B90B" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "#888" }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {countryData.length > 0 && (
                <div className="mt-3 space-y-1">
                  {countryData.slice(0, 8).map((c, i) => (
                    <div key={c.country} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-sm bg-primary/20 flex items-center justify-center text-primary font-bold">{i + 1}</span>
                        {c.country}
                      </span>
                      <span className="font-medium text-foreground">{formatCurrency(c.volume, "XAF")} · {c.count} tx</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Volume XAF par type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Volume XAF par type — {period === "today" ? "Aujourd'hui (par heure)" : period === "yesterday" ? "Hier (par heure)" : "Par jour"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3 flex-wrap text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 inline-block" />Dépôt</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cyan-400 inline-block" />Dépôt API</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-500 inline-block" />Retrait</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500 inline-block" />Lien paiement</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block" />Envoi</span>
            </div>
            {activityData.length === 0 || activityData.every(d => d.depositVol === 0 && d.apiDepositVol === 0 && d.withdrawalVol === 0 && d.paymentLinkVol === 0 && d.transferVol === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun volume sur cette période</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartActivity} margin={{ top: 4, right: 8, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#888" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#888" }} allowDecimals={false} tickFormatter={(v: number) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#ccc" }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = { depositVol: "Dépôt", apiDepositVol: "Dépôt API", withdrawalVol: "Retrait", paymentLinkVol: "Lien paiement", transferVol: "Envoi" };
                      return [value.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " XAF", labels[name] || name];
                    }}
                  />
                  <Bar dataKey="depositVol" stackId="vol" fill="#22c55e" name="depositVol" />
                  <Bar dataKey="apiDepositVol" stackId="vol" fill="#22d3ee" name="apiDepositVol" />
                  <Bar dataKey="withdrawalVol" stackId="vol" fill="#f97316" name="withdrawalVol" />
                  <Bar dataKey="paymentLinkVol" stackId="vol" fill="#a855f7" name="paymentLinkVol" />
                  <Bar dataKey="transferVol" stackId="vol" fill="#3b82f6" name="transferVol" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Réinitialiser les statistiques
            </DialogTitle>
            <DialogDescription>
              Cette action va remettre à zéro tous les compteurs du dashboard : volume, transactions, dépôts, retraits, envois, revenus et marges. Les données en base ne seront pas supprimées — seul l'affichage sera réinitialisé à partir de maintenant.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              data-testid="button-confirm-reset"
            >
              {resetMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Confirmer la réinitialisation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
