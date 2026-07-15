import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Transaction, User, SupportedCurrency } from "@shared/schema";
import {
  TrendingUp, TrendingDown, Clock, Loader2, Link2, ArrowLeftRight,
  Code2, Globe, RefreshCw, Pencil, ChevronLeft, ChevronRight,
  Search, Download, Filter, X, TrendingUp as TrendingUpIcon,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useMemo, useEffect, useCallback } from "react";
import { formatCurrency, formatWalletBalance } from "@/lib/currency";
import { useLocation } from "wouter";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import { useLanguage } from "@/lib/language";

const PAGE_SIZE = 25;

function exportToCSV(transactions: Transaction[], user: User | undefined, tObj: any) {
  const currency = user?.preferredCurrency || "XAF";
  const tl: Record<string, string> = {
    deposit: tObj.transactions.typeDeposit,
    withdrawal: tObj.transactions.typeWithdrawal,
    transfer_in: tObj.transactions.typeTransferIn,
    transfer_out: tObj.transactions.typeTransferOut,
    payment_link: tObj.transactions.typePaymentLink,
    conversion: tObj.transactions.typeConversion,
  };
  const headers = [tObj.transactions.csvDate, tObj.transactions.csvType, tObj.transactions.csvAmount, tObj.transactions.csvCurrency, tObj.transactions.csvStatus, tObj.transactions.csvReference, tObj.transactions.csvDescription];
  const rows = transactions.map(tx => [
    tx.createdAt ? format(new Date(tx.createdAt), "dd/MM/yyyy HH:mm") : "",
    tl[tx.type] || tx.type,
    tx.amount,
    tx.currency || currency,
    tx.status === "completed" ? tObj.transactions.csvStatusCompleted : tx.status === "pending" ? tObj.transactions.csvStatusPending : tx.status === "failed" ? tObj.transactions.csvStatusFailed : tx.status,
    tx.reference || "",
    tx.description || "",
  ]);
  const csvContent = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TransactionsPage() {
  const [, setLocation] = useLocation();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const { rates } = useExchangeRates();
  const { t } = useLanguage();

  const typeLabels: Record<string, string> = {
    deposit: t.transactions.typeDeposit,
    withdrawal: t.transactions.typeWithdrawal,
    transfer_in: t.transactions.typeTransferIn,
    transfer_out: t.transactions.typeTransferOut,
    payment_link: t.transactions.typePaymentLink,
    conversion: t.transactions.typeConversion,
  };

  const typeFilters = [
    { value: "all", label: t.transactions.allTypes },
    { value: "deposit", label: t.transactions.typeDeposits },
    { value: "withdrawal", label: t.transactions.typeWithdrawals },
    { value: "transfer_in", label: t.transactions.typeReceived },
    { value: "transfer_out", label: t.transactions.typeSent },
    { value: "payment_link", label: t.transactions.typePaymentLinks },
    { value: "conversion", label: t.transactions.typeConversions },
  ];

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
    if (typeFilter !== "all" && tx.type !== typeFilter) return false;
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    if (currencyFilter !== "all" && tx.currency !== currencyFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const label = (typeLabels[tx.type] || tx.type).toLowerCase();
      const desc = (tx.description || "").toLowerCase();
      const ref = (tx.reference || "").toLowerCase();
      const amt = tx.amount.toString();
      const op = tx.operatorId ? (operatorMap[tx.operatorId] || "").toLowerCase() : "";
      if (!label.includes(q) && !desc.includes(q) && !ref.includes(q) && !amt.includes(q) && !op.includes(q)) return false;
    }
    return true;
  }), [transactions, typeFilter, statusFilter, currencyFilter, searchQuery, operatorMap]);

  const stats = useMemo(() => {
    const cur = (user?.preferredCurrency || "XAF") as SupportedCurrency;
    const completed = filteredTransactions.filter(tx => tx.status === "completed");
    const incoming = completed.filter(tx => ["deposit", "transfer_in", "payment_link"].includes(tx.type));
    const outgoing = completed.filter(tx => ["withdrawal", "transfer_out"].includes(tx.type));
    const pending = filteredTransactions.filter(tx => tx.status === "pending" || tx.status === "pending_manual");
    const totalIn = incoming.reduce((s, tx) => s + parseFloat(tx.amount || "0"), 0);
    const totalOut = outgoing.reduce((s, tx) => s + parseFloat(tx.amount || "0"), 0);
    return { totalIn, totalOut, pendingCount: pending.length, completedCount: completed.length, currency: cur };
  }, [filteredTransactions, user]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [typeFilter, statusFilter, currencyFilter, searchQuery]);

  const hasActiveFilters = typeFilter !== "all" || statusFilter !== "all" || currencyFilter !== "all" || searchQuery.trim() !== "";

  const clearFilters = useCallback(() => {
    setTypeFilter("all");
    setStatusFilter("all");
    setCurrencyFilter("all");
    setSearchQuery("");
  }, []);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    for (const tx of paginatedTransactions) {
      const dateKey = tx.createdAt ? format(new Date(tx.createdAt), "yyyy-MM-dd") : "inconnu";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [paginatedTransactions]);

  const formatDateLabel = (dateKey: string, tRef: typeof t) => {
    try {
      const date = new Date(dateKey);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) return tRef.transactions.today;
      if (format(date, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) return tRef.transactions.yesterday;
      return format(date, "d MMMM yyyy", { locale: fr });
    } catch { return dateKey; }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
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

  const getApiBadge = (tx: Transaction) => {
    const t = tx as any;
    if (t.type === "payment_link") return null;
    if (t.source === "hosted_page") return <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30"><Globe className="w-2.5 h-2.5" />Hosted</Badge>;
    if (t.source === "api") return <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-sky-500/10 text-sky-600 border-sky-500/30"><Code2 className="w-2.5 h-2.5" />API</Badge>;
    return null;
  };

  const getTxIcon = (tx: Transaction) => {
    if (tx.type === "conversion") return <ArrowLeftRight className="w-4 h-4 text-blue-500" />;
    if (tx.type === "payment_link") return <Link2 className="w-4 h-4 text-primary" />;
    if (["deposit", "transfer_in"].includes(tx.type)) return <TrendingUp className="w-4 h-4 text-green-500" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const getTxIconBg = (tx: Transaction) => {
    if (tx.type === "conversion") return "bg-blue-500/10";
    if (tx.type === "payment_link") return "bg-primary/10";
    return ["deposit", "transfer_in", "payment_link"].includes(tx.type) ? "bg-green-500/10" : "bg-red-500/10";
  };

  const getAmountColor = (tx: Transaction) => {
    if (tx.type === "conversion") return "text-blue-500";
    if (tx.status === "completed") return ["deposit", "transfer_in", "payment_link"].includes(tx.type) ? "text-green-500" : "text-red-500";
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
          <div className="h-20 bg-muted rounded-xl" />
          <div className="flex gap-2">
            <div className="h-9 w-40 bg-muted rounded" />
            <div className="h-9 w-36 bg-muted rounded" />
          </div>
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.transactions.title}</h1>
          <p className="text-muted-foreground">{transactions.length} {transactions.length !== 1 ? t.transactions.totalCountPlural : t.transactions.totalCount}</p>
        </div>

        {/* Stats summary */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{hasActiveFilters ? t.transactions.summaryFiltered : t.transactions.summaryLabel}</p>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">{t.transactions.totalIn}</span>
              </div>
              <span className="text-sm font-semibold text-green-500">
                +{formatCurrency(stats.totalIn, stats.currency, rates)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                </div>
                <span className="text-sm text-muted-foreground">{t.transactions.totalOut}</span>
              </div>
              <span className="text-sm font-semibold text-red-500">
                -{formatCurrency(stats.totalOut, stats.currency, rates)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">{t.transactions.displayed}</span>
              </div>
              <span className="text-sm font-semibold">{filteredTransactions.length}</span>
            </div>
            {stats.pendingCount > 0 && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">{t.transactions.pendingCount}</span>
                </div>
                <span className="text-sm font-semibold text-amber-500">{stats.pendingCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.transactions.filtersLabel}</p>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={t.transactions.searchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm"
                data-testid="input-search-transactions"
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[150px] text-xs" data-testid="select-filter-type">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  {typeFilters.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs" data-testid="select-filter-status">
                  <SelectValue placeholder={t.transactions.allStatuses} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.transactions.allStatuses}</SelectItem>
                  <SelectItem value="completed">{t.transactions.statusCompleted}</SelectItem>
                  <SelectItem value="pending">{t.transactions.statusPending}</SelectItem>
                  <SelectItem value="failed">{t.transactions.statusFailed}</SelectItem>
                  <SelectItem value="cancelled">{t.transactions.statusCancelled}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs" data-testid="select-filter-currency">
                  <SelectValue placeholder={t.transactions.allCurrencies} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.transactions.allCurrencies}</SelectItem>
                  {availableCurrencies.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 ml-auto">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={clearFilters} data-testid="button-clear-filters">
                    <X className="w-3.5 h-3.5" />
                    {t.transactions.clearFilters}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-transactions">
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                  {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t.transactions.refresh}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => exportToCSV(filteredTransactions, user, { transactions: t.transactions })}
                  disabled={filteredTransactions.length === 0}
                  data-testid="button-export-csv"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t.transactions.exportCsv}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction list */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.transactions.historyLabel}</p>

          {filteredTransactions.length === 0 ? (
            <div className="rounded-xl border border-border bg-card">
              <div className="text-center py-16">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">{t.transactions.noTransaction}</p>
                <p className="text-xs text-muted-foreground">
                  {hasActiveFilters ? t.transactions.noTransactionFiltered : t.transactions.noTransactionHint}
                </p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="mt-3 text-xs text-primary font-semibold hover:underline" type="button">
                    {t.transactions.clearFiltersLink}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedByDate.map(([dateKey, txs]) => (
                <div key={dateKey}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    {formatDateLabel(dateKey, t)}
                  </p>
                  <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                    {txs.map((tx) => {
                      const apiBadge = getApiBadge(tx);
                      const operatorName = tx.operatorId ? operatorMap[tx.operatorId] : null;
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => setLocation(`/dashboard/transactions/${tx.id}`)}
                          data-testid={`transaction-item-${tx.id}`}
                        >
                          <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${getTxIconBg(tx)}`}>
                            {getTxIcon(tx)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                                {typeLabels[tx.type] || tx.type}
                              </p>
                              {apiBadge}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {operatorName || (tx.description ? tx.description.slice(0, 28) : "—")}
                              {tx.createdAt && <span className="ml-1">· {format(new Date(tx.createdAt), "HH:mm")}</span>}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-sm font-bold whitespace-nowrap ${getAmountColor(tx)}`}>
                              {getAmountPrefix(tx)}{formatWalletBalance(tx.amount, tx.currency || user?.preferredCurrency || "XAF")}
                            </span>
                            {getStatusBadge(tx.status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {totalPages > 1 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {t.transactions.page} <span className="font-semibold text-foreground">{page}</span> {t.transactions.of} <span className="font-semibold text-foreground">{totalPages}</span>
                      <span className="ml-2 text-xs">({filteredTransactions.length} {t.transactions.results})</span>
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
                        {t.transactions.previous}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-sm"
                        onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0, 0); }}
                        disabled={page === totalPages}
                        data-testid="button-page-next"
                      >
                        {t.transactions.next}
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
