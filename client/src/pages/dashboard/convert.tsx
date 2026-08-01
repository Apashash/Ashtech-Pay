import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeftRight, Loader2, CheckCircle2, AlertTriangle, ChevronLeft } from "lucide-react";
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

export default function ConvertPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const presetFrom = searchParams.get("from");
  const presetTo = searchParams.get("to");

  const [fromCurrency, setFromCurrency] = useState(presetFrom || "XAF");
  const [toCurrency, setToCurrency] = useState(presetTo || "XOF");
  const [convertAmount, setConvertAmount] = useState("");
  const [conversionPending, setConversionPending] = useState<{
    conversionId: string; fromCurrency: string; toCurrency: string; fromAmount: number; toAmount: number;
  } | null>(null);
  const [pendingSuccess, setPendingSuccess] = useState<{
    fromCurrency: string; toCurrency: string; fromAmount: number; toAmount: number;
  } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: rawWalletList = [], isLoading } = useQuery<WalletEntry[]>({
    queryKey: ["/api/wallets"],
    refetchInterval: 30000,
  });
  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: fxRates = {} } = useQuery<Record<string, number>>({ queryKey: ["/api/public/exchange-rates"] });
  const { data: feeSettings } = useQuery<{
    conversionFeePercent: number;
    convTotalXafXaf: number; convTotalXofXof: number;
    convTotalXofXaf: number; convTotalXafXof: number;
    convTotalCdfCfa: number; convTotalCfaCdf: number;
    convTotalCfaUsdt: number; convTotalUsdtCfa: number;
  }>({
    queryKey: ["/api/public/fee-settings"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/public/fee-settings"); return res.json(); },
  });

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

  const primaryCurrency = user?.preferredCurrency || "XAF";

  useEffect(() => {
    if (presetFrom || presetTo) return;
    if (walletList.length >= 2) {
      setFromCurrency(walletList[0].currency);
      setToCurrency(walletList[1].currency);
    }
  }, [walletList.length, presetFrom, presetTo]);

  // Determine fee % by currency pair (XOF↔XAF, CDF↔CFA)
  const XOF_FAM = new Set(["XOF","XOFC","XOFF","XOFN","XOFB","XOFT","XOFS","XOFM"]);
  const XAF_FAM = new Set(["XAF","XAFC","XAFG"]);
  const fromFam = XOF_FAM.has(fromCurrency) ? "XOF" : XAF_FAM.has(fromCurrency) ? "XAF" : fromCurrency === "CDF" ? "CDF" : "OTHER";
  const toFam   = XOF_FAM.has(toCurrency)   ? "XOF" : XAF_FAM.has(toCurrency)   ? "XAF" : toCurrency   === "CDF" ? "CDF" : "OTHER";
  const conversionFeePercent =
    fromFam === "XAF" && toFam === "XAF"                                               ? (feeSettings?.convTotalXafXaf  ?? 0) :
    fromFam === "XOF" && toFam === "XOF"                                               ? (feeSettings?.convTotalXofXof  ?? 0) :
    fromFam === "XOF" && toFam === "XAF"                                               ? (feeSettings?.convTotalXofXaf  ?? 2) :
    fromFam === "XAF" && toFam === "XOF"                                               ? (feeSettings?.convTotalXafXof  ?? 2) :
    fromFam === "CDF" && (toFam === "XAF" || toFam === "XOF")                          ? (feeSettings?.convTotalCdfCfa  ?? 5) :
    (fromFam === "XAF" || fromFam === "XOF") && toFam === "CDF"                        ? (feeSettings?.convTotalCfaCdf  ?? 5) :
    (fromFam === "XAF" || fromFam === "XOF") && toCurrency === "USDT"                  ? (feeSettings?.convTotalCfaUsdt ?? 2) :
    fromCurrency === "USDT" && (toFam === "XAF" || toFam === "XOF")                    ? (feeSettings?.convTotalUsdtCfa ?? 2) :
    (feeSettings?.conversionFeePercent ?? 2);
  const sourceBalance = walletList.find(w => w.currency === fromCurrency);
  const parsedAmount = parseFloat(convertAmount || "0");
  const sourceParsedBalance = parseFloat(sourceBalance?.balance || "0");
  const hasSufficientBalance = parsedAmount > 0 && parsedAmount <= sourceParsedBalance;
  const feeAmount = (parsedAmount * conversionFeePercent) / 100;
  const amountAfterFee = parsedAmount - feeAmount;
  const CFA_CODES = new Set(["XAF","XAFC","XAFG","XOF","XOFC","XOFF","XOFN","XOFB","XOFT","XOFS","XOFM"]);
  // fxRates are XAF-direct: fxRates[currency] = how many XAF = 1 unit of that currency (CFA = 1)
  const fromRate = CFA_CODES.has(fromCurrency) ? 1 : (fxRates[fromCurrency] || 1);
  const toRate = CFA_CODES.has(toCurrency) ? 1 : (fxRates[toCurrency] || 1);
  const amountInXAF = amountAfterFee * fromRate;
  const previewAmount = amountInXAF / toRate;

  const walletSymbol = (currency: string) => (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;

  // Target account options: existing wallets + the requested preset currency even if the wallet doesn't exist yet
  const toCurrencyOptions = useMemo(() => {
    const codes = walletList.map(w => w.currency);
    if (presetTo && !codes.includes(presetTo)) codes.push(presetTo);
    return codes;
  }, [walletList, presetTo]);

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
      setConvertAmount("");
      setPendingSuccess(null);
      setConversionPending({
        conversionId: data.conversionId,
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        fromAmount: data.fromAmount,
        toAmount: data.toAmount,
      });
    },
    onError: (error: Error) => {
      toast({ title: t.wallets.toastError, description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!conversionPending) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    const { conversionId, fromCurrency: fc, toCurrency: tc, fromAmount: fa, toAmount: ta } = conversionPending;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/wallets/conversion-status/${conversionId}`, { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (json.status === "completed") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setConversionPending(null);
          setPendingSuccess({ fromCurrency: fc, toCurrency: tc, fromAmount: fa, toAmount: ta });
          queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [conversionPending]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto space-y-4 animate-pulse">
          <div className="h-10 bg-muted rounded-xl" />
          <div className="h-64 bg-muted rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (walletList.length < 2 && !presetTo) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate("/dashboard/wallets")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            {t.wallets.title}
          </button>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <AlertTriangle className="w-10 h-10 text-yellow-500" />
            <p className="text-muted-foreground text-sm">Vous devez avoir au moins 2 portefeuilles pour effectuer une conversion.</p>
            <Button onClick={() => navigate("/dashboard/wallets")} variant="outline" className="rounded-xl">
              Gérer mes portefeuilles
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto pb-10">

        {/* Back nav */}
        <button
          onClick={() => navigate("/dashboard/wallets")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t.wallets.title}
        </button>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            {t.wallets.convertDialogTitle}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t.wallets.convertDialogDesc}</p>
        </div>

        {/* Success banner */}
        {pendingSuccess && (
          <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-500">{t.wallets.conversionDone}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <strong>{pendingSuccess.fromAmount.toLocaleString("fr-FR")} {pendingSuccess.fromCurrency}</strong>
                {" "}→{" "}
                <strong>{pendingSuccess.toAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {pendingSuccess.toCurrency}</strong>
                {" "}crédité avec succès.
              </p>
            </div>
          </div>
        )}

        {/* Pending banner */}
        {conversionPending && (
          <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-3 mb-4">
            <Loader2 className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5 animate-spin" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-yellow-500">Conversion en cours...</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <strong>{conversionPending.fromAmount.toLocaleString("fr-FR")} {conversionPending.fromCurrency}</strong>
                {" "}→{" "}
                <strong>{conversionPending.toAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {conversionPending.toCurrency}</strong>
                {" "}— traitement en cours, veuillez patienter.
              </p>
            </div>
          </div>
        )}

        {/* Form card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-5">

          {/* Source account */}
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

          {/* Swap indicator */}
          <div className="flex items-center justify-center">
            <button
              onClick={() => {
                const prev = fromCurrency;
                setFromCurrency(toCurrency);
                setToCurrency(prev);
                setConvertAmount("");
              }}
              className="w-9 h-9 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
              title="Inverser"
            >
              <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Target account */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.wallets.toAccount}</Label>
            <Select value={toCurrency} onValueChange={setToCurrency}>
              <SelectTrigger className="h-12 rounded-xl" data-testid="select-to-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {toCurrencyOptions.filter(c => c !== fromCurrency).map(currency => (
                  <SelectItem key={currency} value={currency}>
                    {CURRENCY_FLAGS[currency] || "🌍"} {currency} — {CURRENCY_NAMES[currency] || currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {presetTo && !walletList.some(w => w.currency === presetTo) && toCurrency === presetTo && (
              <p className="text-xs text-muted-foreground">Ce portefeuille sera créé automatiquement lors de la conversion.</p>
            )}
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
                <span className="font-medium tabular-nums text-destructive">−{feeAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {fromCurrency}</span>
              </div>
              <div className="px-4 py-3 flex justify-between text-sm bg-primary/5">
                <span className="font-semibold text-foreground">{t.wallets.youReceiveAbout}</span>
                <span className="font-bold text-primary tabular-nums">≈ {previewAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {toCurrency}</span>
              </div>
            </div>
          )}

          {/* Submit */}
          <Button
            className="w-full h-12 rounded-xl font-bold text-base"
            disabled={!hasSufficientBalance || convertMutation.isPending || !!conversionPending}
            onClick={() => convertMutation.mutate({ fromCurrency, toCurrency, amount: convertAmount })}
            data-testid="button-confirm-convert"
          >
            {convertMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...</>
            ) : (
              t.wallets.convertNow || "Convertir maintenant"
            )}
          </Button>
        </div>

        {/* Info note */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Les taux de change sont indicatifs et peuvent varier légèrement lors de l'exécution.
        </p>
      </div>
    </DashboardLayout>
  );
}
