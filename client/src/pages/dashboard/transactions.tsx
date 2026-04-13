import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Transaction, User, SupportedCurrency } from "@shared/schema";
import { TrendingUp, TrendingDown, Clock, Loader2, Link2, ArrowLeftRight, Smartphone, Code2, Globe, RefreshCw, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useMemo, useEffect } from "react";

import { formatCurrency } from "@/lib/currency";
import { useLocation } from "wouter";

const PAGE_SIZE = 25;

const typeLabels: Record<string, string> = {
  deposit: "Dépôt Mobile Money",
  withdrawal: "Retrait",
  transfer_in: "Virement reçu",
  transfer_out: "Virement envoyé",
  payment_link: "Lien de paiement",
  conversion: "Conversion",
};

export default function TransactionsPage() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: transactions = [], isLoading, refetch, isFetching } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });
  const { data: wallets = [] } = useQuery<any[]>({ queryKey: ["/api/wallets"] });
  const { data: depositConfig } = useQuery<any>({ queryKey: ["/api/public/deposit-config"] });

  const operatorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const country of depositConfig?.countries || []) {
      for (const op of country.operators || []) {
        map[op.id] = op.name;
      }
    }
    return map;
  }, [depositConfig]);

  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(tx => { if (tx.currency) set.add(tx.currency); });
    wallets.forEach((w: any) => set.add(w.currency));
    if (user?.preferredCurrency) set.add(user.preferredCurrency);
    return Array.from(set).sort();
  }, [transactions, wallets, user]);

  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    if (currencyFilter !== "all" && tx.currency !== currencyFilter) return false;
    return true;
  }), [transactions, statusFilter, currencyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [statusFilter, currencyFilter]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    for (const tx of paginatedTransactions) {
      const dateKey = tx.createdAt
        ? format(new Date(tx.createdAt), "yyyy-MM-dd")
        : "inconnu";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [paginatedTransactions]);

  const formatDateLabel = (dateKey: string) => {
    try {
      return format(new Date(dateKey), "d MMMM", { locale: fr }).toUpperCase();
    } catch { return dateKey; }
  };

  const getStatusBadge = (status: string, compact = false) => {
    const size = compact ? "text-[10px] px-1.5 py-0" : "text-xs";
    switch (status) {
      case "completed":
        return <Badge className={`${size} bg-green-500/20 text-green-600 border-green-500/30 font-medium`}>Réussi</Badge>;
      case "pending":
      case "pending_manual":
        return <Badge className={`${size} bg-amber-500/20 text-amber-600 border-amber-500/30 font-medium`}>En cours</Badge>;
      case "failed":
        return <Badge className={`${size} bg-red-500/20 text-red-600 border-red-500/30 font-medium`}>Échoué</Badge>;
      case "cancelled":
        return <Badge className={`${size} bg-muted text-muted-foreground font-medium`}>Annulé</Badge>;
      default:
        return <Badge className={`${size} bg-muted text-muted-foreground`}>{status}</Badge>;
    }
  };

  const getApiBadge = (tx: Transaction) => {
    const t = tx as any;
    if (t.confirmedAt && t.status === "completed" && t.type === "deposit") {
      return <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-violet-500/10 text-violet-600 border-violet-500/30 font-medium"><Pencil className="w-2.5 h-2.5" />Rectification</Badge>;
    }
    if (t.type === "payment_link") return null;
    if (t.source === "hosted_page") {
      return <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30"><Globe className="w-2.5 h-2.5" />Hosted Page</Badge>;
    }
    if (t.source === "api") {
      return <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-sky-500/10 text-sky-600 border-sky-500/30"><Code2 className="w-2.5 h-2.5" />API</Badge>;
    }
    return null;
  };

  const copyReference = (ref: string) => {
    navigator.clipboard.writeText(ref);
    toast({ title: "Référence copiée" });
  };

  const tx = txDetails || selectedTx;
  const isIncomingSelected = tx ? ["deposit", "transfer_in", "payment_link"].includes(tx.type) : false;

  const getTxIcon = (tx: Transaction) => {
    const isIncoming = ["deposit", "transfer_in", "payment_link"].includes(tx.type);
    const isConversion = tx.type === "conversion";
    const isPaymentLink = tx.type === "payment_link";
    if (isConversion) return <ArrowLeftRight className="w-5 h-5 text-blue-500" />;
    if (isPaymentLink) return <Link2 className="w-5 h-5 text-primary" />;
    if (isIncoming) return <TrendingUp className="w-5 h-5 text-green-500" />;
    return <TrendingDown className="w-5 h-5 text-red-500" />;
  };

  const getTxIconBg = (tx: Transaction) => {
    const isIncoming = ["deposit", "transfer_in", "payment_link"].includes(tx.type);
    const isConversion = tx.type === "conversion";
    const isPaymentLink = tx.type === "payment_link";
    if (isConversion) return "bg-blue-500/10";
    if (isPaymentLink) return "bg-primary/10";
    return isIncoming ? "bg-green-500/10" : "bg-red-500/10";
  };

  const getAmountColor = (tx: Transaction) => {
    const isIncoming = ["deposit", "transfer_in", "payment_link"].includes(tx.type);
    if (tx.type === "conversion") return "text-blue-500";
    if (tx.status === "completed") return isIncoming ? "text-green-500" : "text-red-500";
    if (tx.status === "pending" || tx.status === "pending_manual") return "text-amber-500";
    return "text-muted-foreground";
  };

  const getAmountPrefix = (tx: Transaction) => {
    if (tx.type === "conversion") return "⇄ ";
    return ["deposit", "transfer_in", "payment_link"].includes(tx.type) ? "+" : "-";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-1" />
          <div className="h-4 w-64 bg-muted rounded" />
          <div className="flex gap-2">
            <div className="h-9 w-40 bg-muted rounded" />
            <div className="h-9 w-36 bg-muted rounded" />
            <div className="h-9 w-24 bg-muted rounded" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-xl" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Historique des transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs" data-testid="select-filter-status">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En cours</SelectItem>
                  <SelectItem value="completed">Réussi</SelectItem>
                  <SelectItem value="failed">Échoué</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>

              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs" data-testid="select-filter-currency">
                  <SelectValue placeholder="Toutes devises" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes devises</SelectItem>
                  {availableCurrencies.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh-transactions"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucune transaction trouvée</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedByDate.map(([dateKey, txs]) => (
                  <div key={dateKey}>
                    <p className="text-xs font-semibold text-primary mb-2 px-1">
                      {formatDateLabel(dateKey)}
                    </p>
                    <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                      {txs.map((tx) => {
                        const apiBadge = getApiBadge(tx);
                        const operatorName = tx.operatorId ? operatorMap[tx.operatorId] : null;
                        return (
                          <div
                            key={tx.id}
                            className="flex items-center gap-3 px-3 py-3 bg-card cursor-pointer active:bg-muted/50 transition-colors"
                            onClick={() => setLocation(`/dashboard/transactions/${tx.id}`)}
                            data-testid={`transaction-item-${tx.id}`}
                          >
                            <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${getTxIconBg(tx)}`}>
                              {getTxIcon(tx)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-medium text-foreground truncate max-w-[160px]">
                                  {typeLabels[tx.type] || tx.type}
                                </p>
                                {apiBadge}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {operatorName || (tx.description ? tx.description.slice(0, 24) : "—")}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-sm font-bold whitespace-nowrap ${getAmountColor(tx)}`}>
                                {getAmountPrefix(tx)}{formatCurrency(tx.amount, (tx.currency || user?.preferredCurrency || "XAF") as SupportedCurrency)}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {getStatusBadge(tx.status, true)}
                                <span className="text-[10px] text-muted-foreground">
                                  {tx.createdAt ? format(new Date(tx.createdAt), "HH:mm") : ""}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-muted-foreground">
                      Page {page} sur {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-sm"
                        onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
                        disabled={page === 1}
                        data-testid="button-page-prev"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Précédent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-sm"
                        onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0, 0); }}
                        disabled={page === totalPages}
                        data-testid="button-page-next"
                      >
                        Suivant
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </DashboardLayout>
  );
}
