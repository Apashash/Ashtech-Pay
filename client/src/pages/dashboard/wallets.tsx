import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, X, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { CURRENCY_SYMBOLS } from "@shared/schema";
import type { User, Transaction } from "@shared/schema";
import { useLanguage } from "@/lib/language";
import { CURRENCY_FLAGS, CURRENCY_NAMES } from "@/lib/walletCurrencies";

interface WalletEntry {
  currency: string;
  balance: string;
  symbol: string;
}

export default function WalletsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [walletToDelete, setWalletToDelete] = useState<WalletEntry | null>(null);

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: rawWalletList = [], isLoading } = useQuery<WalletEntry[]>({
    queryKey: ["/api/wallets"],
    refetchInterval: 30000,
  });
  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });

  const primaryCurrency = user?.preferredCurrency || "XAF";

  const walletList = useMemo(() => {
    const lastTxDate: Record<string, number> = {};
    for (const tx of transactions) {
      if (!tx.currency || !tx.createdAt) continue;
      const ts = new Date(tx.createdAt).getTime();
      if (!lastTxDate[tx.currency] || ts > lastTxDate[tx.currency]) lastTxDate[tx.currency] = ts;
    }
    return [...rawWalletList].sort((a, b) => {
      const dateA = lastTxDate[a.currency] ?? 0;
      const dateB = lastTxDate[b.currency] ?? 0;
      if (dateB !== dateA) return dateB - dateA;
      return parseFloat(b.balance || "0") - parseFloat(a.balance || "0");
    });
  }, [rawWalletList, transactions]);

  const walletSymbol = (currency: string) => (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;

  const openConversion = (sourceCurrency: string) => {
    const targetWallet = walletList.find((wallet) => wallet.currency !== sourceCurrency);
    if (!targetWallet) return;
    navigate(`/dashboard/convert?from=${encodeURIComponent(sourceCurrency)}&to=${encodeURIComponent(targetWallet.currency)}`);
  };

  const deleteWalletMutation = useMutation({
    mutationFn: async (currency: string) => {
      const res = await apiRequest("DELETE", `/api/wallets/${currency}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (_, currency) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: t.wallets.toastDisabled, description: `${t.wallets.toastDisabledDescPre}${currency}${t.wallets.toastDisabledDescSuf}` });
      setWalletToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: t.wallets.toastError, description: error.message, variant: "destructive" });
      setWalletToDelete(null);
    },
  });

  const deleteBalance = parseFloat(walletToDelete?.balance || "0");
  const hasBalanceToLose = deleteBalance > 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto space-y-4 animate-pulse">
          <div className="h-36 bg-muted rounded-2xl" />
          <div className="h-10 bg-muted rounded-xl" />
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-2xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-4 pb-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.wallets.title}</h1>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/dashboard/wallets/add")}
            className="gap-1.5 rounded-xl"
            data-testid="button-add-wallet"
          >
            <Plus className="w-4 h-4" />
            {t.wallets.addAccount}
          </Button>
        </div>

        {/* Portfolio hero card */}
        <div className="rounded-2xl bg-[#1A237E] border border-[#1A237E] overflow-hidden p-6 text-white">
          <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/75 text-sm mb-1">{t.wallets.walletsLabel}</p>
                <p className="text-4xl font-bold text-white tabular-nums">
                  {walletList.length}
                </p>
                <p className="text-sm text-white/75 mt-1">
                  {walletList.length === 1 ? "compte actif" : "comptes actifs"}
                </p>
              </div>
              <button
                onClick={() => { if (walletList.length >= 2) navigate("/dashboard/convert"); }}
                disabled={walletList.length < 2}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="button-open-convert"
              >
                <img src="/exchange-icon.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
                {t.wallets.requestConversion}
              </button>
            </div>
          </div>
        </div>

        {/* Wallet list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {walletList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm">Aucun wallet disponible.</p>
            </div>
          ) : (
            walletList.map((wallet) => {
              const balance = parseFloat(wallet.balance || "0");
              const isMain = wallet.currency === primaryCurrency;
              const flag = CURRENCY_FLAGS[wallet.currency] || "🌍";
              const name = CURRENCY_NAMES[wallet.currency] || wallet.currency;
              const sym = wallet.symbol || walletSymbol(wallet.currency);
              return (
                <div
                  key={wallet.currency}
                  className="flex items-center gap-4 px-4 py-4 hover:bg-muted/30 transition-colors group"
                  data-testid={`wallet-row-${wallet.currency}`}
                >
                  {/* Flag + currency info */}
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-2xl shrink-0 border border-border">
                    {flag}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="shrink-0 font-bold text-foreground text-sm">{wallet.currency}</span>
                      {isMain && (
                        <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                          {t.wallets.principal}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{name}</p>
                  </div>
                  {/* Balance */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground tabular-nums text-sm whitespace-nowrap">
                      {balance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{sym}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openConversion(wallet.currency)}
                      disabled={walletList.length < 2}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={t.wallets.requestConversion}
                      data-testid={`button-convert-${wallet.currency}`}
                    >
                      <img src="/exchange-icon.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
                    </button>
                    {!isMain && (
                      <button
                        onClick={() => setWalletToDelete(wallet)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                        title={t.wallets.disableTooltip}
                        data-testid={`button-disable-wallet-${wallet.currency}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isMain && <div className="w-8 h-8" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add wallet hint */}
        <button
          onClick={() => navigate("/dashboard/wallets/add")}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all group"
          data-testid="button-add-wallet-hint"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:border-primary group-hover:text-primary transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{t.wallets.addAccount}</span>
          </div>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Delete Wallet Confirmation ── */}
      <BottomSheet open={!!walletToDelete} onOpenChange={(open) => { if (!open) setWalletToDelete(null); }}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t.wallets.disableTitle}
            </BottomSheetTitle>
            <BottomSheetDescription>
              {hasBalanceToLose ? (
                <>
                  {t.wallets.disableWithBalancePre}<strong>{walletToDelete?.currency}</strong>{t.wallets.disableWithBalanceMid}
                  <strong className="text-destructive">
                    {deleteBalance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {walletToDelete?.symbol || walletToDelete?.currency}
                  </strong>.{" "}
                  <span className="text-destructive font-semibold">{t.wallets.disableLose}</span>{t.wallets.disableWithBalanceSuf}
                </>
              ) : (
                <>{t.wallets.disableNoBalancePre}<strong>{walletToDelete?.currency}</strong>{t.wallets.disableNoBalanceSuf}</>
              )}
            </BottomSheetDescription>
          </BottomSheetHeader>
          <BottomSheetFooter>
            <Button variant="outline" className="flex-1" onClick={() => setWalletToDelete(null)}>
              {t.wallets.cancel}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-bold"
              disabled={deleteWalletMutation.isPending}
              onClick={() => walletToDelete && deleteWalletMutation.mutate(walletToDelete.currency)}
              data-testid="button-confirm-disable-wallet"
            >
              {deleteWalletMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t.wallets.disableButtonSimple}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </DashboardLayout>
  );
}
