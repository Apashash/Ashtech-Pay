import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Wallet, ArrowLeftRight, Info, Plus, Loader2, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { ALL_FX_CURRENCIES, CURRENCY_SYMBOLS } from "@shared/schema";
import type { User, Transaction } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });
  const { data: fxRates = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/public/exchange-rates"],
  });

  const primaryCurrency = user?.preferredCurrency || "XAF";

  const walletList = useMemo(() => {
    const lastTxDate: Record<string, number> = {};
    for (const tx of transactions) {
      if (!tx.currency || !tx.createdAt) continue;
      const ts = new Date(tx.createdAt).getTime();
      if (!lastTxDate[tx.currency] || ts > lastTxDate[tx.currency]) {
        lastTxDate[tx.currency] = ts;
      }
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

  const { data: feeSettings } = useQuery<{
    conversionFeePercent: number;
    conversionFeePercentSwychr: number;
    conversionFeePercentPixpay: number;
    conversionFeePercentAfribapay: number;
  }>({
    queryKey: ["/api/public/fee-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/public/fee-settings");
      return res.json();
    },
  });

  const conversionFeePercentSwychr = feeSettings?.conversionFeePercentSwychr ?? feeSettings?.conversionFeePercent ?? 6;
  const conversionFeePercentPixpay = feeSettings?.conversionFeePercentPixpay ?? feeSettings?.conversionFeePercent ?? 6;
  const conversionFeePercentAfribapay = feeSettings?.conversionFeePercentAfribapay ?? feeSettings?.conversionFeePercent ?? 6;
  const conversionFeePercent = conversionFeePercentSwychr;
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

  const walletSymbol = (currency: string) =>
    (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;

  const deleteBalance = parseFloat(walletToDelete?.balance || "0");
  const hasBalanceToLose = deleteBalance > 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 w-40 bg-muted rounded mb-2" />
              <div className="h-4 w-60 bg-muted rounded" />
            </div>
            <div className="h-10 w-36 bg-muted rounded" />
          </div>
          <div className="h-14 bg-muted rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-44 bg-muted rounded-xl" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t.wallets.title}</h1>
            <p className="text-muted-foreground">{t.wallets.subtitle}</p>
          </div>
          <Button variant="outline" onClick={() => setAddWalletOpen(true)} className="gap-2" data-testid="button-add-wallet">
            <Plus className="w-4 h-4" />
            {t.wallets.addAccount}
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {t.wallets.alertDesc}
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.wallets.walletsLabel}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {walletList.map((wallet) => {
              const balance = parseFloat(wallet.balance || "0");
              const isMain = wallet.currency === primaryCurrency;
              return (
                <Card
                  key={wallet.currency}
                  className={`relative overflow-hidden ${isMain ? "border-primary/40 bg-gradient-to-br from-primary/10 to-transparent" : ""}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{CURRENCY_FLAGS[wallet.currency] || "🌍"}</span>
                        <div>
                          <p className="font-bold text-lg">{wallet.currency}</p>
                          <p className="text-xs text-muted-foreground">{CURRENCY_NAMES[wallet.currency] || wallet.currency}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isMain && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                            {t.wallets.principal}
                          </span>
                        )}
                        {!isMain && (
                          <button
                            onClick={() => setWalletToDelete(wallet)}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                            title={t.wallets.disableTooltip}
                            data-testid={`button-disable-wallet-${wallet.currency}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mb-4">
                      <p className="text-muted-foreground text-sm mb-1">{t.wallets.balance}</p>
                      <p className="text-2xl font-bold">
                        {balance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-base font-normal text-muted-foreground ml-1">{wallet.symbol || walletSymbol(wallet.currency)}</span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => openConvert(wallet)}
                      disabled={walletList.length < 2}
                      data-testid={`button-convert-${wallet.currency}`}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      {t.wallets.requestConversion}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          </>
        )}

        {pendingSuccess && (
          <Card className="border-green-500/40 bg-green-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-600">{t.wallets.conversionDone}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.wallets.conversionDoneDescPre}
                  <strong>{pendingSuccess.fromAmount.toLocaleString("fr-FR")} {pendingSuccess.fromCurrency}</strong>
                  {t.wallets.conversionDoneDescMid}<strong>{pendingSuccess.toCurrency}</strong>{t.wallets.conversionDoneDescSuf}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conversion Dialog */}
        <BottomSheet open={convertOpen} onOpenChange={setConvertOpen}>
          <BottomSheetContent>
            <BottomSheetHeader>
              <BottomSheetTitle className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                {t.wallets.convertDialogTitle}
              </BottomSheetTitle>
              <BottomSheetDescription>
                {t.wallets.convertDialogDesc}
              </BottomSheetDescription>
            </BottomSheetHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.wallets.fromAccount}</Label>
                <Select value={fromCurrency} onValueChange={(v) => { setFromCurrency(v); setConvertAmount(""); }}>
                  <SelectTrigger data-testid="select-from-currency">
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

              <div className="space-y-2">
                <Label>{t.wallets.toAccount}</Label>
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger data-testid="select-to-currency">
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

              <div className="space-y-2">
                <Label>{t.wallets.convertAmountLabel} ({fromCurrency})</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  min="1"
                  max={sourceParsedBalance}
                  data-testid="input-convert-amount"
                />
                {convertAmount && parsedAmount > 0 && !hasSufficientBalance && (
                  <p className="text-xs text-red-500">
                    {t.wallets.insufficientPre}{sourceParsedBalance.toLocaleString("fr-FR")} {fromCurrency}
                  </p>
                )}
                {convertAmount && hasSufficientBalance && (
                  <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-lg space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t.wallets.grossAmount}</span>
                      <span>{parsedAmount.toLocaleString("fr-FR")} {fromCurrency}</span>
                    </div>
                    <div className="flex justify-between text-xs text-amber-600 font-medium">
                      <span>{t.wallets.conversionFee}</span>
                      <span>-{feeAmount.toLocaleString("fr-FR")} {fromCurrency}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-primary/10 pt-1 mt-1">
                      <span>{t.wallets.youReceiveAbout}</span>
                      <span className="text-primary">{previewAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {toCurrency}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 italic text-center">
                      {t.wallets.rateNote}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConvertOpen(false)}>
                  {t.wallets.cancel}
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!hasSufficientBalance || convertMutation.isPending}
                  onClick={() => convertMutation.mutate({ fromCurrency, toCurrency, amount: convertAmount })}
                  data-testid="button-confirm-convert"
                >
                  {convertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {t.wallets.convertNow}
                </Button>
              </div>
            </div>
          </BottomSheetContent>
        </BottomSheet>

        {/* Add Wallet Dialog */}
        <BottomSheet open={addWalletOpen} onOpenChange={setAddWalletOpen}>
          <BottomSheetContent>
            <BottomSheetHeader>
              <BottomSheetTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                {t.wallets.addDialogTitle}
              </BottomSheetTitle>
              <BottomSheetDescription>
                {t.wallets.addDialogDesc}
              </BottomSheetDescription>
            </BottomSheetHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.wallets.currencyLabel}</Label>
                <Select value={newWalletCurrency} onValueChange={setNewWalletCurrency}>
                  <SelectTrigger data-testid="select-new-wallet-currency">
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
                  className="flex-1"
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

        {/* Disable Wallet Confirmation Dialog */}
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
                  <>
                    {t.wallets.disableNoBalancePre}<strong>{walletToDelete?.currency}</strong>{t.wallets.disableNoBalanceSuf}
                  </>
                )}
              </BottomSheetDescription>
            </BottomSheetHeader>
            <BottomSheetFooter>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setWalletToDelete(null)}
                data-testid="button-cancel-disable"
              >
                {t.wallets.cancel}
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                disabled={deleteWalletMutation.isPending}
                onClick={() => walletToDelete && deleteWalletMutation.mutate(walletToDelete.currency)}
                data-testid="button-confirm-disable"
              >
                {deleteWalletMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                {hasBalanceToLose ? t.wallets.disableButton : t.wallets.disableButtonSimple}
              </Button>
            </BottomSheetFooter>
          </BottomSheetContent>
        </BottomSheet>
      </div>
    </DashboardLayout>
  );
}
