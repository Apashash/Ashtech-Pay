import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Transaction, User, SupportedCurrency } from "@shared/schema";
import type { PaymentLink } from "@shared/schema";
import {
  ArrowLeft, MousePointer, ArrowDownUp, Clock, TrendingUp,
  Loader2, BarChart3, ChevronLeft, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { formatCurrency, formatWalletBalance } from "@/lib/currency";
import { getImageSrc } from "@/lib/image";
import { useLanguage } from "@/lib/language";

interface LinkAnalytics {
  paymentLink: PaymentLink;
  analytics: {
    totalTransactions: number;
    completedCount: number;
    pendingCount: number;
    failedCount: number;
    totalCollected: string;
    totalPending: string;
    clickCount: number;
    conversionRate: string;
  };
  transactions: Transaction[];
}

const PAGE_SIZE = 20;

export default function LinkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const { t, language } = useLanguage();
  const ld = t.linkDetail;

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const userCurrency = (user?.preferredCurrency || "XAF") as SupportedCurrency;

  const { data, isLoading, isError } = useQuery<LinkAnalytics>({
    queryKey: ["/api/payment-links", id, "analytics"],
    queryFn: async () => {
      const res = await fetch(`/api/payment-links/${id}/analytics`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Error loading");
      return res.json();
    },
    enabled: !!id,
  });

  const transactions = data?.transactions || [];
  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const paginatedTransactions = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "success":
      case "succeeded":
        return <Badge className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-600 border-green-500/30 font-medium">{t.transactions.statusCompleted}</Badge>;
      case "pending":
      case "pending_manual":
        return <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-600 border-amber-500/30 font-medium">{t.transactions.statusPending}</Badge>;
      case "failed":
        return <Badge className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-600 border-red-500/30 font-medium">{t.transactions.statusFailed}</Badge>;
      case "cancelled":
        return <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground font-medium">{t.transactions.statusCancelled}</Badge>;
      default:
        return <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">{status}</Badge>;
    }
  };

  const getTransactionRowClass = (status: string) => {
    if (["completed", "success", "succeeded"].includes(status)) {
      return "border-l-4 border-green-500 bg-green-500/10 hover:bg-green-500/15";
    }
    if (["pending", "pending_manual"].includes(status)) {
      return "border-l-4 border-amber-500 bg-amber-500/10 hover:bg-amber-500/15";
    }
    if (["failed", "cancelled", "rejected"].includes(status)) {
      return "border-l-4 border-red-500 bg-red-500/10 hover:bg-red-500/15";
    }
    return "hover:bg-muted/40";
  };

  const getAmountColor = (tx: Transaction) => {
    if (["completed", "success", "succeeded"].includes(tx.status)) return "text-green-500";
    if (tx.status === "pending" || tx.status === "pending_manual") return "text-amber-500";
    return "text-muted-foreground";
  };

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    for (const tx of paginatedTransactions) {
      const dateKey = tx.createdAt ? format(new Date(tx.createdAt), "yyyy-MM-dd") : "inconnu";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [paginatedTransactions]);

  const formatDateLabel = (dateKey: string) => {
    try {
      const date = new Date(dateKey);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) return t.transactions.today;
      if (format(date, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) return t.transactions.yesterday;
      return format(date, "d MMMM yyyy", { locale: language === "fr" ? fr : enUS });
    } catch {
      return dateKey;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/links")}
            data-testid="button-back-links"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            {data?.paymentLink.imagePath && (
              <img
                src={getImageSrc(data.paymentLink.imagePath)}
                alt=""
                className="w-10 h-10 rounded-lg object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isLoading ? ld.loading : data?.paymentLink.title || ld.defaultTitle}
              </h1>
              <p className="text-muted-foreground text-sm">{ld.subtitle}</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">{ld.loadFail}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/links")}>
              {ld.backToLinks}
            </Button>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <MousePointer className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                  <p className="text-3xl font-bold">{data.analytics.clickCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">{ld.clicks}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <ArrowDownUp className="w-5 h-5 mx-auto mb-2 text-green-500" />
                  <p className="text-3xl font-bold">{data.analytics.completedCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">{ld.validated}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <Clock className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                  <p className="text-3xl font-bold">{data.analytics.pendingCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">{ld.inProgress}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <TrendingUp className="w-5 h-5 mx-auto mb-2 text-purple-500" />
                  <p className="text-3xl font-bold">{data.analytics.conversionRate}%</p>
                  <p className="text-sm text-muted-foreground mt-1">{ld.conversion}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-sm mb-1">{ld.totalCollected}</p>
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(parseFloat(data.analytics.totalCollected), userCurrency)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-sm mb-1">{ld.totalPending}</p>
                  <p className="text-2xl font-bold text-amber-500">
                    {formatCurrency(parseFloat(data.analytics.totalPending), userCurrency)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  {ld.history} ({transactions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">{ld.noTransactions}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-5">
                      {groupedByDate.map(([dateKey, txs]) => (
                        <div key={dateKey}>
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground mb-3">
                            {formatDateLabel(dateKey)}
                          </p>
                          <div className="space-y-3">
                            {txs.map((tx) => (
                              <div
                                key={tx.id}
                                className={`flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-4 shadow-sm cursor-pointer transition-colors ${getTransactionRowClass(tx.status)}`}
                                onClick={() => navigate(`/dashboard/transactions/${tx.id}`)}
                                data-testid={`link-tx-${tx.id}`}
                              >
                                <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-primary/10">
                                  <img
                                    src="/sidebar-icons/links.png"
                                    alt=""
                                    aria-hidden="true"
                                    className="h-7 w-7 object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,0.14)]"
                                  />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-normal text-foreground truncate max-w-[180px]">
                                      {t.transactions.typePaymentLink}
                                    </p>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {(tx.description || tx.payerName || tx.payerEmail || "—").slice(0, 28)}
                                    {tx.createdAt && <span className="ml-1">· {format(new Date(tx.createdAt), "HH:mm")}</span>}
                                  </p>
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <span className={`text-sm font-medium whitespace-nowrap ${getAmountColor(tx)}`}>
                                    +{formatWalletBalance(tx.amount, tx.currency || userCurrency)}
                                  </span>
                                  {getStatusBadge(tx.status)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 mt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, transactions.length)} {ld.of} {transactions.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            data-testid="button-page-prev"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            {ld.prev}
                          </Button>
                          <span className="text-sm font-medium px-2">{page} / {totalPages}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            data-testid="button-page-next"
                          >
                            {ld.next}
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
