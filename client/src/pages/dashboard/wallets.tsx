import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeftRight, Plus, Loader2, CheckCircle2, X, AlertTriangle, ChevronRight, TrendingUp, Repeat2 } from "lucide-react";
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
  GHS: "🇬🇭", NGN: "🇳🇬", KES: "🇰🇪", RWF: "🇷🇼", TZS: "🇹🇿",
  UGX: "🇺🇬", CDF: "🇨🇩", GNF: "🇬🇳", GMD: "🇬🇲", SLL: "🇸🇱",
  MWK: "🇲🇼", ZMK: "🇿🇲", ZAR: "🇿🇦", EGP: "🇪🇬", MAD: "🇲🇦",
  ETB: "🇪🇹", MZN: "🇲🇿", ZWE: "🇿🇼", CVE: "🇨🇻",
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", CHF: "🇨🇭",
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
  const [convertOpen, setConvertOpen] = useState(false);
  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const [pendingSuccess, setPendingSuccess] = useState<{ fromCurrency: string; toCurrency: string; fromAmount: number } | null>(null);
  const [walletToDelete, setWalletToDelete] = useState<WalletEntry | null>(null);

  const [fromCurrency, setFromCurrency] = useState("XAF");
  const [toCurrency, setToCurrency] = useState("XOF");
  const [convertAmount, setConvertAmount] = useState("");
  const [newWalletCurrency, setNewWalletCurrency] = useState("");

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: rawWalletList = [], isLoading } = useQuery<WalletEntry[]>({
    queryKey: ["/api/wallets"],
    refetchInterval: 30000,
  });
  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: fxRates = {} } = useQuery<Record<string, number>>({ queryKey: ["/api/public/exchange-rates"] });
  const { data: feeSettings } = useQuery<{
    conversionFeePercent: number;
    conversionFeePercentSwychr: number;
  }>({
    queryKey: ["/api/public/fee-settings"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/public/fee-settings"); return res.json(); },
  });

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

  const conversionFeePercent = feeSettings?.conversionFeePercentSwychr ?? feeSettings?.conversionFeePercent ?? 6;
  const sourceBalance = walletList.find(w => w.currency === fromCurrency);
  const parsedAmount = parseFloat(convertAmount || "0");
  const sourceParsedBalance = parseFloat(sourceBalance?.balance || "0");
  const hasSufficientBalance = parsedAmount > 0 && parsedAmount <= sourceParsedBalance;
  const feeAmount = (parsedAmount * conversionFeePercent) / 100;
  const amountAfterFee = parsedAmount - feeAmount;
  const CFA_CODES = new Set(["XAF","XAFC","XAFG","XOF","XOFC","XOFF","XOFN","XOFB","XOFT","XOFS","XOFM"]);
  const xafRate = fxRates["XAF"] || 585;
  const fromRateUSD = CFA_CODES.has(fromCurrency) ? xafRate : (fxRates[fromCurrency] || xafRate);
  const toRateUSD = CFA_CODES.has(toCurrency) ? xafRate : (fxRates[toCurrency] || xafRate);
  const amountInXAF = amountAfterFee * (xafRate / fromRateUSD);
  const previewAmount = amountInXAF * (toRateUSD / xafRate);

  const walletSymbol = (currency: string) => (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;

  const convertMutation = useMutation({
    mutationFn: async (data: { fromCurrency: string; toCurrency: string; amount: string }) => {
      const res = await apiRequest("POST", "/api/wallets/convert", data);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setConvertOpen(false);
      setPendingSuccess({ fromCurrency: data.fromCurrency, toCurrency: data.toCurrency, fromAmount: data.fromAmount });
      setConvertAmount("");
    },
    onError: (error: Error) => {
      toast({ title: t.wallets.toastError, description: error.message, variant: "destructive" });
    },
  });

  const openConvert = (wallet: WalletEntry) => {
    setFromCurrency(wallet.currency);
    const other = walletList.find(w => w.currency !== wallet.currency);
    setToCurrency(other?.currency || primaryCurrency);
    setConvertAmount("");
    setPendingSuccess(null);
    setConvertOpen(true);
  };

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
                onClick={() => {
                  if (walletList.length >= 2) {
                    setFromCurrency(walletList[0].currency);
                    setToCurrency(walletList[1].currency);
                    setConvertAmount("");
                    setPendingSuccess(null);
                    setConvertOpen(true);
                  }
                }}
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

        {/* Success banner */}
        {pendingSuccess && (
          <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-500">{t.wallets.conversionDone}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.wallets.conversionDoneDescPre}
                <strong>{pendingSuccess.fromAmount.toLocaleString("fr-FR")} {pendingSuccess.fromCurrency}</strong>
                {t.wallets.conversionDoneDescMid}<strong>{pendingSuccess.toCurrency}</strong>{t.wallets.conversionDoneDescSuf}
              </p>
            </div>
          </div>
        )}

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
                      onClick={() => openConvert(wallet)}
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

      {/* ── Conversion Bottom Sheet ── */}
      <BottomSheet open={convertOpen} onOpenChange={setConvertOpen}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5" />
              {t.wallets.convertDialogTitle}
            </BottomSheetTitle>
            <BottomSheetDescription>{t.wallets.convertDialogDesc}</BottomSheetDescription>
          </BottomSheetHeader>

          <div className="space-y-4">
            {/* From */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.wallets.fromAccount}</Label>
              <Select value={fromCurrency} onValueChange={(v) => { setFromCurrency(v); setConvertAmount(""); }}>
                <SelectTrigger className="h-12 rounded-xl" data-testid="select-from-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {walletList.map(w => (
                    <SelectItem key={w.currency} value={w.currency}>
                      {CURRENCY_FLAGS[w.currency] || "🌍"} {w.currency} — {parseFloat(w.balance || "0").toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {w.symbol || walletSymbol(w.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Arrow swap indicator */}
            <div className="flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* To */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.wallets.toAccount}</Label>
              <Select value={toCurrency} onValueChange={setToCurrency}>
                <SelectTrigger className="h-12 rounded-xl" data-testid="select-to-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {walletList.filter(w => w.currency !== fromCurrency).map(w => (
                    <SelectItem key={w.currency} value={w.currency}>
                      {CURRENCY_FLAGS[w.currency] || "🌍"} {w.currency} — {CURRENCY_NAMES[w.currency] || w.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.wallets.convertAmountLabel} ({fromCurrency})
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                pattern="[0-9.]*"
                placeholder="0"
                className="h-12 rounded-xl text-base"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                data-testid="input-convert-amount"
              />
              {convertAmount && parsedAmount > 0 && !hasSufficientBalance && (
                <p className="text-xs text-red-500">
                  {t.wallets.insufficientPre}{sourceParsedBalance.toLocaleString("fr-FR")} {fromCurrency}
                </p>
              )}
            </div>

            {/* Preview */}
            {convertAmount && hasSufficientBalance && (
              <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                <div className="px-4 py-3 flex justify-between text-sm border-b border-border">
                  <span className="text-muted-foreground">{t.wallets.grossAmount}</span>
                  <span className="font-medium tabular-nums">{parsedAmount.toLocaleString("fr-FR")} {fromCurrency}</span>
                </div>
                <div className="px-4 py-3 flex justify-between text-sm border-b border-border">
                  <span className="text-muted-foreground">{t.wallets.conversionFee} ({conversionFeePercent}%)</span>
                  <span className="font-medium text-red-500 tabular-nums">-{feeAmount.toLocaleString("fr-FR")} {fromCurrency}</span>
                </div>
                <div className="px-4 py-3 flex justify-between bg-primary/5">
                  <span className="font-semibold text-sm">{t.wallets.youReceiveAbout}</span>
                  <span className="font-bold text-primary tabular-nums">{previewAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {toCurrency}</span>
                </div>
                <p className="text-[10px] text-muted-foreground px-4 py-2 text-center italic">{t.wallets.rateNote}</p>
              </div>
            )}
          </div>

          <BottomSheetFooter>
            <Button variant="outline" className="flex-1" onClick={() => setConvertOpen(false)}>
              {t.wallets.cancel}
            </Button>
            <Button
              className="flex-1 gap-2 font-bold"
              disabled={!hasSufficientBalance || convertMutation.isPending}
              onClick={() => convertMutation.mutate({ fromCurrency, toCurrency, amount: convertAmount })}
              data-testid="button-confirm-convert"
            >
              {convertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {t.wallets.convertNow}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>

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
              {t.wallets.disableConfirm}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </DashboardLayout>
  );
}
