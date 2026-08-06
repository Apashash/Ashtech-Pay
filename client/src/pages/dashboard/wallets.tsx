import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeftRight, Plus, X, ChevronRight, TrendingUp, Repeat2, Loader2, AlertTriangle } from "lucide-react";
import { ALL_FX_CURRENCIES, CURRENCY_SYMBOLS } from "@shared/schema";
import type { User, Transaction } from "@shared/schema";
import { useLanguage } from "@/lib/language";

interface WalletEntry {
  currency: string;
  balance: string;
  symbol: string;
}

const CURRENCY_FLAGS: Record<string, string> = {
  XAF: "🇨🇲", XAFC: "🇨🇬", XAFG: "🇬🇦",
  XOF: "🇸🇳", XOFC: "🇨🇮", XOFF: "🇧🇫", XOFN: "🇳🇪", XOFB: "🇧🇯", XOFT: "🇹🇬", XOFS: "🇸🇳", XOFM: "🇲🇱",
  RWF: "🇷🇼", TZS: "🇹🇿",
  UGX: "🇺🇬", CDF: "🇨🇩", SLL: "🇸🇱",
  MWK: "🇲🇼", ZMK: "🇿🇲", ZAR: "🇿🇦", EGP: "🇪🇬", MAD: "🇲🇦",
  ETB: "🇪🇹", MZN: "🇲🇿", ZWE: "🇿🇼", CVE: "🇨🇻",
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", CHF: "🇨🇭", USDT: "₮",
  CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿",
  INR: "🇮🇳", PKR: "🇵🇰", BDT: "🇧🇩", LRK: "🇱🇰",
  PHP: "🇵🇭", IDR: "🇮🇩", MYR: "🇲🇾", THB: "🇹🇭",
  VND: "🇻🇳", KRW: "🇰🇷", JPY: "🇯🇵", HKD: "🇭🇰", CHN: "🇨🇳",
  SAR: "🇸🇦", AED: "🇦🇪", QAR: "🇶🇦", KWD: "🇰🇼", BHD: "🇧🇭",
  ILS: "🇮🇱", TRY: "🇹🇷",
  SEK: "🇸🇪", NOK: "🇳🇴", DKK: "🇩🇰", PLN: "🇵🇱",
  CZK: "🇨🇿", HUF: "🇭🇺", RON: "🇷🇴", BGN: "🇧🇬", ISK: "🇮🇸",
  BRL: "🇧🇷", MXN: "🇲🇽", ARS: "🇦🇷", CLP: "🇨🇱", COP: "🇨🇴",
};

const CURRENCY_NAMES: Record<string, string> = {};
ALL_FX_CURRENCIES.forEach(c => { CURRENCY_NAMES[c.code] = c.name; });

export default function WalletsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState<WalletEntry | null>(null);
  const [newWalletCurrency, setNewWalletCurrency] = useState("");

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

  const existingCurrencies = new Set(walletList.map(w => w.currency));
  const availableCurrencies = ALL_FX_CURRENCIES.filter(c => !existingCurrencies.has(c.code));

  const walletSymbol = (currency: string) => (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;

  const addWalletMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wallets/create", { currency: newWalletCurrency });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: t.wallets.toastCreated, description: `${t.wallets.toastCreatedDescPre}${newWalletCurrency}${t.wallets.toastCreatedDescSuf}` });
      setAddWalletOpen(false);
      setNewWalletCurrency("");
    },
    onError: (error: Error) => {
      toast({ title: t.wallets.toastError, description: error.message, variant: "destructive" });
    },
  });

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
            <p className="text-sm text-muted-foreground">{t.wallets.subtitle}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddWalletOpen(true)}
            className="gap-1.5 rounded-xl"
            data-testid="button-add-wallet"
          >
            <Plus className="w-4 h-4" />
            {t.wallets.addAccount}
          </Button>
        </div>

        {/* Portfolio hero card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 p-5">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/5 -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-primary/5 translate-y-6 -translate-x-6" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.wallets.walletsLabel}</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {walletList.length}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {walletList.length === 1 ? "compte actif" : "comptes actifs"}
                </p>
              </div>
              <button
                onClick={() => { if (walletList.length >= 2) navigate("/dashboard/convert"); }}
                disabled={walletList.length < 2}
                className="flex items-center gap-2 bg-primary text-black font-bold text-sm px-4 py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
                data-testid="button-open-convert"
              >
                <Repeat2 className="w-4 h-4" />
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
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{wallet.currency}</span>
                      {isMain && (
                        <span className="text-[10px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                          {t.wallets.principal}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{name}</p>
                  </div>
                  {/* Balance */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground tabular-nums text-sm">
                      {balance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{sym}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => navigate("/dashboard/convert")}
                      disabled={walletList.length < 2}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={t.wallets.requestConversion}
                      data-testid={`button-convert-${wallet.currency}`}
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
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
          onClick={() => setAddWalletOpen(true)}
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

      {/* ── Add Wallet Bottom Sheet ── */}
      <BottomSheet open={addWalletOpen} onOpenChange={setAddWalletOpen}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>{t.wallets.addDialogTitle}</BottomSheetTitle>
            <BottomSheetDescription>{t.wallets.addDialogDesc}</BottomSheetDescription>
          </BottomSheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.wallets.currencyLabel}</Label>
              <Select value={newWalletCurrency} onValueChange={setNewWalletCurrency}>
                <SelectTrigger className="h-12 rounded-xl" data-testid="select-new-wallet-currency">
                  <SelectValue placeholder={t.wallets.chooseCurrency} />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {CURRENCY_FLAGS[c.code] || "🌍"} {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setAddWalletOpen(false)} data-testid="button-cancel-wallet">
                {t.wallets.cancel}
              </Button>
              <Button
                className="flex-1 font-bold"
                disabled={!newWalletCurrency || addWalletMutation.isPending}
                onClick={() => addWalletMutation.mutate()}
                data-testid="button-create-wallet"
              >
                {addWalletMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t.wallets.create}
              </Button>
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>

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
