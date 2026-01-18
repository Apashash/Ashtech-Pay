import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Link2
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";

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

interface AdminStats {
  totalUsers: number;
  totalTransactions: number;
  totalVolume: string;
  monthlyTransactions: number;
  rejectedTransactions: number;
  pendingTransactions: number;
  bannedUsers: number;
  totalDeposits: string;
  totalWithdrawals: string;
  totalRevenue: string;
  depositCount: number;
  withdrawalCount: number;
  transferCount: number;
  paymentLinkCount: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  pendingTransfers: number;
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<StatsPeriod>("this_month");
  
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: [`/api/admin/stats?period=${period}`],
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
      title: "Dépôts",
      value: stats?.depositCount || 0,
      subValue: formatCurrency(parseFloat(stats?.totalDeposits || "0"), "XAF"),
      icon: ArrowDownCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      pending: stats?.pendingDeposits || 0,
    },
    {
      title: "Retraits",
      value: stats?.withdrawalCount || 0,
      subValue: formatCurrency(parseFloat(stats?.totalWithdrawals || "0"), "XAF"),
      icon: ArrowUpCircle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      pending: stats?.pendingWithdrawals || 0,
    },
    {
      title: "Envois",
      value: stats?.transferCount || 0,
      icon: Send,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      pending: stats?.pendingTransfers || 0,
    },
    {
      title: "Liens de paiement",
      value: stats?.paymentLinkCount || 0,
      icon: Link2,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Transactions Rejetées",
      value: stats?.rejectedTransactions || 0,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "En Attente",
      value: stats?.pendingTransactions || 0,
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Utilisateurs Bannis",
      value: stats?.bannedUsers || 0,
      icon: Ban,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Revenus (Frais)",
      value: formatCurrency(parseFloat(stats?.totalRevenue || "0"), "XAF"),
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Administrateur</h1>
            <p className="text-muted-foreground">Vue d'ensemble de la plateforme</p>
          </div>
          <div className="flex items-center gap-2">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {kpiCards.map((card, index) => (
            <Card key={index} data-testid={`kpi-card-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
                <div className="flex items-center gap-2">
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
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Activité Récente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Les graphiques d'activité seront affichés ici</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Volume par Pays</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Les statistiques par pays seront affichées ici</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
