import { useState } from "react";
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
  CheckCircle, XCircle, Loader2, BarChart3, ChevronLeft, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
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
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1"><CheckCircle className="w-3 h-3" />{ld.statusCompleted}</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 gap-1"><Clock className="w-3 h-3" />{ld.statusPending}</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 gap-1"><XCircle className="w-3 h-3" />{ld.statusFailed}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
                    <div className="space-y-3">
                      {paginatedTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                          data-testid={`link-tx-${tx.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{tx.payerName || "Client"}</p>
                              {getStatusBadge(tx.status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {tx.payerEmail}
                              {tx.createdAt && ` • ${format(new Date(tx.createdAt), "dd/MM/yyyy HH:mm", { locale: language === "fr" ? fr : enUS })}`}
                            </p>
                          </div>
                          <p className={`font-bold text-lg whitespace-nowrap ml-4 ${
                            tx.status === "completed" ? "text-green-500"
                            : tx.status === "pending" ? "text-amber-500"
                            : "text-red-500"
                          }`}>
                            {formatCurrency(parseFloat(tx.amount), tx.currency as SupportedCurrency)}
                          </p>
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
