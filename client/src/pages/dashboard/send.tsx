import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, SupportedCurrency, Wallet } from "@shared/schema";
import { Send, Globe, Loader2, ArrowRight, AlertCircle, Shield, CheckCircle2, Smartphone, TrendingDown, Wallet as WalletIcon } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import { getOperatorLogo } from "@/lib/operator-logos";
import { z } from "zod";
import { formatCurrency, formatWalletBalance } from "@/lib/currency";
import { useMemo, useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { useExchangeRates } from "@/hooks/use-exchange-rates";

const INTERNAL_KEY = "__ashtech_interne__";

interface OperatorConfig {
  id: string;
  name: string;
  type: string;
  paymentProvider: string;
  feePercentage: number;
  feeFixed: number;
  minFee: number | null;
  maxFee: number | null;
}

interface CountryConfig {
  id: string;
  name: string;
  code: string;
  currency: string;
  operators: OperatorConfig[];
}

const externalFormSchema = z.object({
  recipientName: z.string().min(2, "Nom du destinataire requis"),
  recipientPhone: z.string().min(8, "Numéro de téléphone invalide"),
  countryId: z.string().min(1, "Veuillez sélectionner un pays"),
  operatorId: z.string().min(1, "Veuillez sélectionner un opérateur"),
  amount: z.string().min(1, "Montant requis").refine(v => parseFloat(v) > 0, "Le montant doit être supérieur à 0"),
});

type ExternalFormData = z.infer<typeof externalFormSchema>;

const COUNTRY_FLAGS: Record<string, string> = {
  "Bénin": "🇧🇯", "Burkina Faso": "🇧🇫", "Cameroun": "🇨🇲", "Centrafrique": "🇨🇫",
  "Congo": "🇨🇬", "Côte d'Ivoire": "🇨🇮", "Gabon": "🇬🇦", "Ghana": "🇬🇭",
  "Guinée Conakry": "🇬🇳", "Guinée équatoriale": "🇬🇶", "Guinée-Bissau": "🇬🇼",
  "Kenya": "🇰🇪", "Mali": "🇲🇱", "Niger": "🇳🇪", "Nigeria": "🇳🇬", "Nigéria": "🇳🇬",
  "Ouganda": "🇺🇬", "RD Congo": "🇨🇩", "Rwanda": "🇷🇼", "Sénégal": "🇸🇳",
  "Tanzanie": "🇹🇿", "Tchad": "🇹🇩", "Togo": "🇹🇬", "USA": "🇺🇸"
};

export default function SendMoneyPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: wallets = [] } = useQuery<Wallet[]>({ queryKey: ["/api/wallets"] });

  const primaryCurrency = user?.preferredCurrency || "XAF";
  const [selectedWallet, setSelectedWallet] = useState<string>(primaryCurrency);
  const [destination, setDestination] = useState<string>(INTERNAL_KEY);
  const [internalIdentifier, setInternalIdentifier] = useState("");
  const [internalAmount, setInternalAmount] = useState("");

  useEffect(() => {
    if (primaryCurrency && selectedWallet === "XAF" && primaryCurrency !== "XAF") {
      setSelectedWallet(primaryCurrency);
    }
  }, [primaryCurrency]);

  const isInternal = destination === INTERNAL_KEY;
  const balance = parseFloat(wallets.find(w => w.currency === selectedWallet)?.balance || "0");
  const localCurrency = primaryCurrency;

  const { data: limits } = useQuery<{ minTransfer: number; maxTransfer: number }>({
    queryKey: ["/api/public/limits"],
  });
  const { rates: fxRates } = useExchangeRates();
  const senderCurrency = (selectedWallet || primaryCurrency || "XAF") as string;
  const xafFxRate = fxRates["XAF"] || 585;
  const senderFxRate = fxRates[senderCurrency] || xafFxRate;
  const minTransfer = Math.ceil((limits?.minTransfer ?? 150) * senderFxRate / xafFxRate);
  const maxTransfer = Math.floor((limits?.maxTransfer ?? 5000000) * senderFxRate / xafFxRate);

  const { data: countries, isLoading: isLoadingConfig } = useQuery<CountryConfig[]>({
    queryKey: ["/api/transfers/config"],
  });

  const form = useForm<ExternalFormData>({
    resolver: zodResolver(externalFormSchema),
    defaultValues: { recipientName: "", recipientPhone: "", countryId: "", operatorId: "", amount: "" },
  });

  const watchedCountryId = form.watch("countryId");
  const watchedOperatorId = form.watch("operatorId");
  const watchedAmount = form.watch("amount");

  const [feePreview, setFeePreview] = useState<{
    feeAmount: number;
    feePercentage: number;
    totalAmount: number;
    isLoading: boolean;
  }>({ feeAmount: 0, feePercentage: 0, totalAmount: 0, isLoading: false });

  const selectedCountry = useMemo(() => countries?.find(c => c.id === watchedCountryId), [countries, watchedCountryId]);
  const selectedOperator = useMemo(() => selectedCountry?.operators.find(o => o.id === watchedOperatorId), [selectedCountry, watchedOperatorId]);
  const amountValue = parseFloat(watchedAmount) || 0;
  const internalAmountValue = parseFloat(internalAmount) || 0;

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingExternalData, setPendingExternalData] = useState<ExternalFormData | null>(null);
  const [showInternalConfirmDialog, setShowInternalConfirmDialog] = useState(false);
  const [prevCountryId, setPrevCountryId] = useState("");

  useEffect(() => {
    if (watchedCountryId !== prevCountryId) {
      form.setValue("operatorId", "");
      setPrevCountryId(watchedCountryId);
      if (selectedCountry?.currency) {
        const matchingWallet = wallets.find(w => w.currency === selectedCountry.currency);
        if (matchingWallet) setSelectedWallet(selectedCountry.currency);
      }
    }
  }, [watchedCountryId, prevCountryId, form, selectedCountry, wallets]);

  const fetchFeePreview = useCallback(async () => {
    if (!watchedOperatorId || amountValue <= 0) {
      setFeePreview({ feeAmount: 0, feePercentage: 0, totalAmount: 0, isLoading: false });
      return;
    }
    setFeePreview(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await apiRequest("POST", "/api/transfers/calculate-fee", {
        operatorId: watchedOperatorId,
        amount: amountValue.toString(),
      });
      const data = await res.json();
      let feeAmount = data.feeAmount;
      let feePercentage = data.feePercentage;
      if (feeAmount === 0 && selectedOperator) {
        const pct = selectedOperator.feePercentage || 0;
        const fixed = selectedOperator.feeFixed || 0;
        const isSwychr = !selectedOperator.paymentProvider || selectedOperator.paymentProvider === "swychr";
        const minF = isSwychr ? (selectedOperator.minFee || 0) : 0;
        feeAmount = Math.max((amountValue * pct / 100) + fixed, minF);
        feePercentage = pct;
      }
      setFeePreview({ feeAmount, feePercentage, totalAmount: amountValue + feeAmount, isLoading: false });
    } catch {
      setFeePreview(prev => ({ ...prev, isLoading: false }));
    }
  }, [watchedOperatorId, amountValue, selectedOperator]);

  useEffect(() => {
    const timer = setTimeout(fetchFeePreview, 300);
    return () => clearTimeout(timer);
  }, [fetchFeePreview]);

  const internalMutation = useMutation({
    mutationFn: async () => {
      if (!internalIdentifier.trim()) throw new Error("Veuillez entrer l'identifiant du destinataire");
      const amt = parseFloat(internalAmount);
      if (!amt || amt <= 0) throw new Error("Veuillez entrer un montant valide");
      const res = await apiRequest("POST", "/api/transfers/internal", {
        recipientIdentifier: internalIdentifier.trim(),
        amount: internalAmount,
        sourceCurrency: selectedWallet,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur lors du transfert");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Transfert effectué ✓", description: `Compte de ${data.recipientName} crédité instantanément — Frais: 0` });
      setInternalIdentifier("");
      setInternalAmount("");
      setShowInternalConfirmDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setShowInternalConfirmDialog(false);
    },
  });

  const externalMutation = useMutation({
    mutationFn: async (data: ExternalFormData) => {
      const res = await apiRequest("POST", "/api/transfers/send", { ...data, sourceCurrency: selectedWallet });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur lors du transfert");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setShowConfirmDialog(false);
      setPendingExternalData(null);
      form.reset();
      toast({ title: "Paiement envoyé avec succès ✓", description: "Votre transaction est en cours de traitement" });
    },
    onError: (error: Error) => {
      setShowConfirmDialog(false);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const currencyMismatch = !isInternal && selectedCountry && selectedWallet !== selectedCountry.currency;

  const canSubmitExternal = amountValue >= minTransfer &&
    amountValue <= maxTransfer &&
    amountValue <= balance &&
    amountValue > 0 &&
    watchedCountryId &&
    watchedOperatorId &&
    !externalMutation.isPending &&
    !feePreview.isLoading &&
    !currencyMismatch;

  if (user && !user.isVerified) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto space-y-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.send.title}</h1>
            <p className="text-sm text-muted-foreground">{t.send.subtitleUnverified}</p>
          </div>
          <div className="bg-card border border-yellow-500/30 rounded-2xl p-8 text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/15 flex items-center justify-center">
              <Shield className="w-8 h-8 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t.send.unverifiedTitle}</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{t.send.unverifiedDesc}</p>
            </div>
            <Button onClick={() => setLocation("/dashboard/kyc")} className="rounded-xl">
              <Shield className="w-4 h-4 mr-2" />{t.send.verifyButton}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-4 pb-8">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">{t.send.title}</h1>
          <p className="text-sm text-muted-foreground">{t.send.subtitle}</p>
        </div>

        {/* Wallet selector + balance */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-2xl px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <WalletIcon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{t.send.yourBalance}</p>
            <p className="text-base font-bold text-foreground tabular-nums">
              {formatWalletBalance(balance, selectedWallet)}
            </p>
          </div>
          {wallets.length > 1 && (
            <Select value={selectedWallet} onValueChange={setSelectedWallet}>
              <SelectTrigger className="h-8 w-auto border-primary/30 rounded-lg text-xs font-semibold bg-primary/5 gap-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((w) => (
                  <SelectItem key={w.currency} value={w.currency}>
                    {w.currency} — {parseFloat(w.balance || "0").toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tab switcher: Internal vs External */}
        <div className="flex gap-2 p-1 bg-muted rounded-xl">
          <button
            type="button"
            onClick={() => setDestination(INTERNAL_KEY)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              isInternal
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-base">🏦</span>
            {t.send.internalTransfer}
          </button>
          <button
            type="button"
            onClick={() => { if (isInternal) setDestination(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              !isInternal
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="w-4 h-4" />
            Mobile Money
          </button>
        </div>

        {/* INTERNAL TRANSFER */}
        {isInternal && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-2">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-sm font-semibold">{t.send.zeroFeeMsg}</span>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-4 pt-3">
              {/* Recipient */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.send.recipientLabel}</label>
                <Input
                  placeholder="email / +237600000000 / @username"
                  value={internalIdentifier}
                  onChange={e => setInternalIdentifier(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.send.amountLabel} ({selectedWallet})
                </label>
                <div className="flex items-center gap-2 border border-border rounded-xl px-4 py-2 focus-within:border-primary transition-colors h-14">
                  <span className="text-sm font-semibold text-muted-foreground shrink-0">{selectedWallet}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    className="flex-1 text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30"
                    value={internalAmount}
                    onChange={e => setInternalAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  />
                </div>
                {internalAmountValue > balance && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Solde insuffisant ({formatWalletBalance(balance, selectedWallet)} disponible)
                  </p>
                )}
              </div>

              {/* Fee info */}
              <div className="flex items-center justify-between py-2 px-3 bg-green-500/5 border border-green-500/20 rounded-xl text-sm">
                <span className="text-muted-foreground">{t.send.confirmFee}</span>
                <span className="font-bold text-green-500">{t.send.free}</span>
              </div>

              <Button
                className="w-full h-12 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl"
                size="lg"
                onClick={() => {
                  if (!internalIdentifier.trim() || !parseFloat(internalAmount)) {
                    internalMutation.mutate();
                    return;
                  }
                  setShowInternalConfirmDialog(true);
                }}
                disabled={internalMutation.isPending || !internalIdentifier.trim() || internalAmountValue <= 0 || internalAmountValue > balance}
              >
                {internalMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Envoi...</>
                  : <><Send className="w-4 h-4 mr-2" />{t.send.sendButton}</>
                }
              </Button>
            </div>
          </div>
        )}

        {/* EXTERNAL TRANSFER */}
        {!isInternal && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-5 space-y-5">

              {/* Country select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.send.destination}</label>
                <Select
                  value={destination === INTERNAL_KEY ? "" : destination}
                  onValueChange={(val) => {
                    setDestination(val);
                    form.setValue("countryId", val);
                  }}
                >
                  <SelectTrigger className="h-14 rounded-xl border-border">
                    {selectedCountry ? (
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xl shrink-0">
                          {COUNTRY_FLAGS[selectedCountry.name] || "🌍"}
                        </span>
                        <div className="text-left min-w-0">
                          <p className="font-semibold truncate text-sm">{selectedCountry.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedCountry.currency}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">{t.send.selectDestination}</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingConfig
                      ? <SelectItem value="__loading__" disabled>{t.send.loading}</SelectItem>
                      : (countries ?? []).map(country => (
                        <SelectItem key={country.id} value={country.id}>
                          <span className="flex items-center gap-2">
                            <span>{COUNTRY_FLAGS[country.name] || "🌍"}</span>
                            <span>{country.name}</span>
                            <span className="text-muted-foreground text-xs">({country.currency})</span>
                          </span>
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              {/* Operator grid */}
              {selectedCountry && (
                <Form {...form}>
                  <form
                    id="external-form"
                    onSubmit={form.handleSubmit((d) => {
                      setPendingExternalData({ ...d, countryId: destination });
                      setShowConfirmDialog(true);
                    })}
                    className="space-y-5"
                  >
                    {selectedCountry.operators.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground bg-muted/30 rounded-xl">
                        {t.send.noOperator}
                      </div>
                    ) : (
                      <FormField
                        control={form.control}
                        name="operatorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.send.operatorLabel}</FormLabel>
                            <div className="overflow-hidden">
                              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                                {selectedCountry.operators.map((op) => {
                                  const logo = getOperatorLogo(op.name);
                                  const isSelected = field.value === op.id;
                                  return (
                                    <button
                                      key={op.id}
                                      type="button"
                                      data-testid={`button-operator-${op.id}`}
                                      onClick={() => field.onChange(op.id)}
                                      className={`flex-shrink-0 flex flex-col items-center justify-center gap-2 w-24 h-20 rounded-2xl border-2 transition-all cursor-pointer ${
                                        isSelected
                                          ? "border-primary bg-primary/10 shadow-md"
                                          : "border-border bg-card/50 hover:border-primary/40"
                                      }`}
                                    >
                                      {logo
                                        ? <img src={logo} alt={op.name} className="w-10 h-10 object-contain rounded-xl" />
                                        : <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Smartphone className="w-5 h-5 text-primary" /></div>
                                      }
                                      <span className={`text-[11px] font-semibold text-center leading-tight px-1 ${isSelected ? "text-primary" : "text-foreground"}`}>
                                        {op.name}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Amount */}
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t.send.sendAmountLabel} ({selectedCountry?.currency || "XAF"})
                          </FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2 border border-border rounded-xl px-4 py-2 focus-within:border-primary transition-colors h-14">
                              <span className="text-sm font-semibold text-muted-foreground shrink-0">
                                {selectedCountry?.currency || senderCurrency}
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                className="flex-1 text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30"
                                value={field.value}
                                onChange={e => field.onChange(e.target.value.replace(/[^0-9.]/g, ""))}
                                data-testid="input-amount"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                          {amountValue > 0 && amountValue < minTransfer && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {t.send.minAmount} {minTransfer.toLocaleString()} {senderCurrency}
                            </p>
                          )}
                          {amountValue > 0 && amountValue > maxTransfer && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {t.send.maxAmount} {maxTransfer.toLocaleString()} {senderCurrency}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />

                    {/* Fee preview inline */}
                    {amountValue > 0 && selectedOperator && (
                      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden divide-y divide-border text-sm">
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-muted-foreground">{t.send.summaryAmount}</span>
                          <span className="font-semibold tabular-nums">{formatWalletBalance(amountValue, localCurrency)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5" />
                            {t.send.summaryFee}
                            {feePreview.isLoading ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : feePreview.feePercentage > 0 ? ` (${feePreview.feePercentage}%)` : ""}
                          </span>
                          <span className="font-semibold text-orange-500 tabular-nums">
                            - {formatWalletBalance(feePreview.feeAmount, localCurrency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
                          <span className="font-semibold">{t.send.summaryNet}</span>
                          <span className="font-bold tabular-nums">{formatWalletBalance(amountValue - feePreview.feeAmount, localCurrency)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
                          <span>{t.send.balanceAfter}</span>
                          <span className={amountValue > balance ? "text-red-500 font-semibold" : ""}>
                            {formatWalletBalance(Math.max(0, balance - amountValue), localCurrency)}
                          </span>
                        </div>
                      </div>
                    )}

                    {amountValue > balance && (
                      <Alert variant="destructive" className="rounded-xl">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{t.send.insufficientBalance}</AlertDescription>
                      </Alert>
                    )}

                    {currencyMismatch && (
                      <Alert variant="destructive" className="rounded-xl">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Compte sélectionné en <strong>{selectedWallet}</strong> mais {selectedCountry?.name} utilise <strong>{selectedCountry?.currency}</strong>.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Recipient fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="recipientName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.send.recipientName}</FormLabel>
                          <FormControl>
                            <Input placeholder="Jean Dupont" {...field} className="h-11 rounded-xl" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="recipientPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.send.recipientPhone}</FormLabel>
                          <FormControl>
                            <Input placeholder="XXXXXXXXX" inputMode="tel" {...field} className="h-11 rounded-xl" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <Button
                      type="submit"
                      form="external-form"
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl"
                      size="lg"
                      disabled={!canSubmitExternal}
                    >
                      {externalMutation.isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Envoi...</>
                        : <><Send className="w-4 h-4 mr-2" />{t.send.sendButton}{amountValue > 0 ? ` ${formatCurrency(amountValue, localCurrency as SupportedCurrency)}` : ""}</>
                      }
                    </Button>
                  </form>
                </Form>
              )}

              {!selectedCountry && (
                <div className="py-8 text-center">
                  <Globe className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t.send.chooseDestFirst}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Internal advantages */}
        {isInternal && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 divide-y divide-green-500/10 overflow-hidden">
            {[t.send.advantageFree, t.send.advantageInstant, t.send.advantageSecure].map((txt, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 text-xs font-bold shrink-0">✓</span>
                <span className="text-sm text-muted-foreground">{txt}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Internal confirm */}
      <BottomSheet open={showInternalConfirmDialog} onOpenChange={setShowInternalConfirmDialog}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="text-center text-lg">{t.send.confirmInternalTitle}</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border my-2">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.send.confirmRecipient}</span>
              <span className="text-sm font-medium">{internalIdentifier}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.send.confirmDebitAccount}</span>
              <span className="text-sm font-medium">{selectedWallet}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.send.confirmAmount}</span>
              <span className="text-sm font-bold tabular-nums">{formatWalletBalance(parseFloat(internalAmount) || 0, selectedWallet)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5 bg-green-500/5">
              <span className="text-sm font-semibold">{t.send.confirmFee}</span>
              <span className="text-base font-bold text-green-500">{t.send.free}</span>
            </div>
          </div>
          <BottomSheetFooter>
            <Button variant="outline" className="flex-1" onClick={() => setShowInternalConfirmDialog(false)}>{t.send.back}</Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-black font-bold"
              onClick={() => internalMutation.mutate()}
              disabled={internalMutation.isPending}
              data-testid="button-final-confirm-internal"
            >
              {internalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              {t.send.confirm}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>

      {/* External confirm */}
      <BottomSheet open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="text-center text-lg">{t.send.confirmExternalTitle}</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border my-2">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.send.confirmRecipient}</span>
              <span className="text-sm font-medium">{pendingExternalData?.recipientName}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.send.confirmPhone}</span>
              <span className="text-sm font-medium">{pendingExternalData?.recipientPhone}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.send.confirmCountryOperator}</span>
              <span className="text-sm font-medium">{selectedCountry?.name} · {selectedOperator?.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.send.confirmSentAmount}</span>
              <span className="text-sm font-bold tabular-nums">{formatWalletBalance(amountValue, selectedWallet)}</span>
            </div>
            {feePreview.feeAmount > 0 && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-muted-foreground">{t.send.confirmFeePercent} ({feePreview.feePercentage}%)</span>
                <span className="text-sm font-semibold text-red-500 tabular-nums">-{formatWalletBalance(feePreview.feeAmount, selectedWallet)}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3.5 bg-green-500/5">
              <span className="text-sm font-semibold">{t.send.confirmNetReceived}</span>
              <span className="text-base font-bold text-green-500 tabular-nums">{formatWalletBalance(amountValue - feePreview.feeAmount, selectedWallet)}</span>
            </div>
          </div>
          <BottomSheetFooter>
            <Button variant="outline" className="flex-1" onClick={() => setShowConfirmDialog(false)}>{t.send.back}</Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-black font-bold"
              onClick={() => { if (pendingExternalData) externalMutation.mutate(pendingExternalData); }}
              disabled={externalMutation.isPending}
              data-testid="button-final-confirm-external"
            >
              {externalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              {t.send.confirm}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </DashboardLayout>
  );
}
