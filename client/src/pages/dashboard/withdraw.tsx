import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { withdrawSchema, type SupportedCurrency, type WithdrawalNumber } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { Smartphone, Building2, Loader2, CheckCircle, AlertCircle, Plus, Settings, Shield, Info, CreditCard, X, RefreshCw, Clock } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import { getOperatorLogo } from "@/lib/operator-logos";
import { getCountryFlagEmoji } from "@/lib/country-flags";
import { z } from "zod";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/currency";
import { Link, useLocation } from "wouter";
import { useExchangeRates } from "@/hooks/use-exchange-rates";

interface OperatorConfig {
  id: string;
  name: string;
  type: string;
  paymentProvider: string;
  feePercentage: number;
  feeFixed: number;
  afribapayFee: number;
  pixpayFee: number;
  ashtechMargin: number;
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

const withdrawMethods = [
  { id: "mobile_money", name: "Mobile Money", icon: Smartphone, description: "Orange, MTN, Wave, Airtel..." },
  { id: "bank_transfer", name: "Virement bancaire", icon: Building2, description: "Vers votre compte bancaire" },
];

const OTP_LOCK_KEY = "atp_otp_lock";
const OTP_LOCK_DURATION_MS = 15 * 60 * 1000;

function getOtpLockRemaining(): number {
  try {
    const raw = localStorage.getItem(OTP_LOCK_KEY);
    if (!raw) return 0;
    const { sentAt } = JSON.parse(raw);
    const remaining = Math.ceil((OTP_LOCK_DURATION_MS - (Date.now() - sentAt)) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch { return 0; }
}
function setOtpLock() {
  localStorage.setItem(OTP_LOCK_KEY, JSON.stringify({ sentAt: Date.now() }));
}
function clearOtpLock() {
  localStorage.removeItem(OTP_LOCK_KEY);
}

export default function WithdrawPage() {
  const [selectedMethod, setSelectedMethod] = useState<string>("mobile_money");
  const [selectedNumber, setSelectedNumber] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedOperator, setSelectedOperator] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLockedDialog, setShowLockedDialog] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);
  const [otpRef, setOtpRef] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpTimer, setOtpTimer] = useState(600);
  const { toast } = useToast();

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: otpStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/public/otp-email-status"],
    staleTime: 30_000,
  });
  const isOtpRequired = otpStatus?.enabled !== false; // default to true (safe)

  const { data: limits } = useQuery<{ minWithdrawal: number; maxWithdrawal: number; minTransfer: number; maxTransfer: number }>({
    queryKey: ["/api/public/limits"],
  });
  const { rates: fxRates } = useExchangeRates();
  const userCurrency = user?.preferredCurrency || "XAF";
  // fxRates are XAF-direct: fxRates[currency] = how many XAF = 1 unit of that currency
  const userRate = fxRates[userCurrency] || 1; // XAF per 1 unit of userCurrency
  const convertFromXAF = (xaf: number) => Math.ceil(xaf / userRate);
  const limitsLoaded = limits !== undefined && fxRates && Object.keys(fxRates).length > 0;
  const minWithdrawal = convertFromXAF(limits?.minWithdrawal ?? 150);
  const maxWithdrawal = Math.floor((limits?.maxWithdrawal ?? 5000000) / userRate);

  const rawBalance = parseFloat(user?.balance || "0");
  const isDecimalCurrency = userCurrency === "USD" || userCurrency === "EUR";
  const balance = isDecimalCurrency
    ? Math.floor(rawBalance * 100) / 100
    : Math.round(rawBalance);

  const { t } = useLanguage();
  const { data: withdrawalNumbers = [] } = useQuery<WithdrawalNumber[]>({
    queryKey: ["/api/withdrawal-numbers"],
  });

  const { data: countriesConfig = [] } = useQuery<CountryConfig[]>({
    queryKey: ["/api/transfers/config?type=withdrawal"],
  });

  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: "", paymentMethod: "mobile_money", accountDetails: "", countryId: "", operatorId: "" },
  });

  const selectedCountryData = countriesConfig.find(c => c.id === selectedCountry);
  const operators = selectedCountryData?.operators || [];
  const selectedOperatorData = operators.find(o => o.id === selectedOperator);

  useEffect(() => {
    if (countriesConfig.length > 0 && !selectedCountry) {
      if (user?.country) {
        const byName = countriesConfig.find(
          c => c.name.toLowerCase() === (user.country || "").toLowerCase()
        );
        if (byName) { setSelectedCountry(byName.id); return; }
      }
      const byCurrency = countriesConfig.find(c => c.currency === userCurrency);
      if (byCurrency) setSelectedCountry(byCurrency.id);
    }
  }, [user?.country, countriesConfig, userCurrency]);

  useEffect(() => {
    if (selectedNumber && withdrawalNumbers.length > 0) {
      const number = withdrawalNumbers.find(n => n.id === selectedNumber);
      if (number) form.setValue("accountDetails", number.phoneNumber);
    }
  }, [selectedNumber, withdrawalNumbers, form]);

  useEffect(() => {
    setSelectedOperator("");
    form.setValue("countryId", selectedCountry);
    form.setValue("operatorId", "");
  }, [selectedCountry, form]);

  useEffect(() => {
    form.setValue("operatorId", selectedOperator);
  }, [selectedOperator, form]);

  useEffect(() => {
    if (!showOtpDialog) return;
    setOtpTimer(600);
    const id = setInterval(() => setOtpTimer(prev => (prev <= 1 ? (clearInterval(id), 0) : prev - 1)), 1000);
    return () => clearInterval(id);
  }, [showOtpDialog]);

  useEffect(() => {
    if (!showLockedDialog || lockRemaining <= 0) return;
    const id = setInterval(() => {
      setLockRemaining(prev => {
        if (prev <= 1) { clearInterval(id); setShowLockedDialog(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [showLockedDialog]);

  useEffect(() => {
    fetch("/api/user/otp-lock", { credentials: "include" })
      .then(r => r.json())
      .then((d: { remainingSeconds: number }) => {
        if (d.remainingSeconds > 0) {
          setLockRemaining(d.remainingSeconds);
          setShowLockedDialog(true);
        }
      })
      .catch(() => {});
  }, []);

  const requestOtpMutation = useMutation({
    mutationFn: async () => {
      const values = form.getValues();
      const res = await apiRequest("POST", "/api/withdrawals/request-otp", {
        method: selectedMethod === "mobile_money" ? "Mobile Money" : "Virement bancaire",
        country: selectedCountryData?.name,
        operator: selectedOperatorData?.name,
        phone: values.accountDetails,
        amount: amountValue.toLocaleString("fr-FR"),
        fee: feeAmount > 0 ? `-${feeAmount.toLocaleString("fr-FR")}` : "0",
        net: (amountValue - feeAmount).toLocaleString("fr-FR"),
        currency: userCurrency,
      });
      const data = await res.json();
      if (data.code === "OTP_LOCKED") {
        const err = new Error(data.message || "Opération en cours");
        (err as any).code = "OTP_LOCKED";
        (err as any).remainingSeconds = data.remainingSeconds ?? 0;
        throw err;
      }
      if (!res.ok) throw new Error(data.message || "Erreur lors de l'envoi du code");
      return data;
    },
    onSuccess: (data: { ref: string; disabled?: boolean }) => {
      setShowConfirmDialog(false);
      if (data.disabled) {
        clearOtpLock();
        setOtpRef(null);
        setOtpCode("");
        withdrawMutation.mutate(form.getValues());
        return;
      }
      setOtpLock();
      setOtpRef(data.ref);
      setOtpCode("");
      setOtpError("");
      setShowOtpDialog(false);
      setTimeout(() => setShowOtpDialog(true), 50);
    },
    onError: (error: Error & { code?: string; remainingSeconds?: number }) => {
      if (error.code === "OTP_LOCKED") {
        setLockRemaining(error.remainingSeconds ?? 900);
        setShowLockedDialog(true);
        return;
      }
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: z.infer<typeof withdrawSchema>) => {
      const res = await apiRequest("POST", "/api/withdrawals", {
        ...data,
        paymentMethod: selectedMethod,
        otpRef,
        otpCode,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur");
      return json;
    },
    onSuccess: () => {
      clearOtpLock();
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      form.reset();
      setSelectedNumber("");
      setOtpRef(null);
      setOtpCode("");
      setShowOtpDialog(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    },
    onError: (error: Error) => {
      clearOtpLock();
      setOtpRef(null);
      setOtpCode("");
      setShowOtpDialog(false);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const [, setLocation] = useLocation();
  const isVerified = user?.isVerified;

  const watchedAmount = form.watch("amount");
  const watchedAccountDetails = form.watch("accountDetails");
  const amountValue = parseFloat(watchedAmount || "0");
  const feePercent = selectedOperatorData?.feePercentage || 0;
  const feeFixed = selectedOperatorData?.feeFixed || 0;
  const minPayoutCharge = selectedOperatorData?.minFee || 0;

  const percentageFee = (amountValue * feePercent / 100);
  const isSwychr = !selectedOperatorData?.paymentProvider || selectedOperatorData.paymentProvider === "swychr";
  const feeAmount = (amountValue > 0 && selectedOperatorData)
    ? (isSwychr ? Math.max(percentageFee + feeFixed, minPayoutCharge) : percentageFee + feeFixed)
    : 0;

  const isAmountValid = amountValue >= minWithdrawal && amountValue <= maxWithdrawal && amountValue <= balance;
  const isMobileMoneyValid = selectedMethod === "mobile_money" ? (!!selectedCountry && !!selectedOperator && !!watchedAccountDetails) : true;
  const isBankTransferValid = selectedMethod === "bank_transfer" ? !!watchedAccountDetails : true;
  const isSubmitDisabled = withdrawMutation.isPending || !isAmountValid || !isMobileMoneyValid || !isBankTransferValid;

  if (user && !isVerified) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t.withdraw.title}</h1>
            <p className="text-muted-foreground">{t.withdraw.subtitle}</p>
          </div>
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Shield className="w-8 h-8 text-yellow-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t.withdraw.unverifiedTitle}</h2>
            <p className="text-muted-foreground max-w-md mx-auto">{t.withdraw.unverifiedDesc}</p>
            <Button onClick={() => setLocation("/dashboard/kyc")} className="mt-4" data-testid="button-go-to-kyc">
              <Shield className="w-4 h-4 mr-2" />
              {t.withdraw.verifyButton}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => withdrawMutation.mutate(d))}>
          <div className="space-y-4 pb-6">

            {/* ── Balance Card ── */}
            <div
              className="rounded-2xl p-5 text-white"
              style={{ background: "linear-gradient(135deg, #C75000 0%, #E07020 60%, #D06010 100%)" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1">
                Solde compte principal
              </p>
              <p className="text-4xl font-bold tracking-tight">
                {formatCurrency(balance, userCurrency as SupportedCurrency)}
              </p>
              <p className="text-sm text-white/70 mt-1">
                {selectedCountryData?.name || user?.country || "Votre pays"} · {userCurrency}
              </p>

              {limitsLoaded && (
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/20">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Min retrait</p>
                    <p className="text-sm font-bold">{minWithdrawal.toLocaleString()} {userCurrency}</p>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Max retrait</p>
                    <p className="text-sm font-bold">{maxWithdrawal.toLocaleString()} {userCurrency}</p>
                  </div>
                </div>
              )}
            </div>

            {limitsLoaded && balance < minWithdrawal && (
              <div className="flex items-center gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/8 px-4 py-3">
                <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
                <p className="text-sm text-foreground">
                  Solde insuffisant. Minimum : {minWithdrawal.toLocaleString()} {userCurrency}.
                </p>
              </div>
            )}

            {/* ── Méthode ── */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Méthode</p>
              <div className="grid grid-cols-2 gap-3">
                {withdrawMethods.map((method) => {
                  const isSelected = selectedMethod === method.id;
                  const isDisabled = method.id === "bank_transfer";
                  return (
                    <button
                      key={method.id}
                      type="button"
                      data-testid={`withdraw-method-${method.id}`}
                      onClick={() => {
                        if (isDisabled) {
                          toast({ title: "Bientôt disponible", description: "Le virement bancaire sera disponible prochainement." });
                        } else {
                          setSelectedMethod(method.id);
                        }
                      }}
                      className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-muted-foreground/30"
                      } ${isDisabled ? "opacity-60" : ""}`}
                    >
                      {isDisabled && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Bientôt
                        </span>
                      )}
                      {isSelected && !isDisabled && (
                        <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-primary" />
                      )}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isSelected ? "bg-primary/15" : "bg-muted"
                      }`}>
                        <method.icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {method.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{method.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Montant ── */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Montant</p>
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          className="flex-1 text-4xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 w-0"
                          {...field}
                          data-testid="input-withdraw-amount"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-muted-foreground">{userCurrency}</span>
                          <button
                            type="button"
                            data-testid="button-max-amount"
                            onClick={() => form.setValue("amount", balance.toString(), { shouldValidate: true })}
                            className="text-[11px] font-bold uppercase px-2 py-1 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                          >
                            MAX
                          </button>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Solde disponible</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(balance, userCurrency as SupportedCurrency)}
                </span>
              </div>
              {amountValue > 0 && amountValue < minWithdrawal && (
                <div className="flex items-center gap-1.5 text-destructive text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {t.withdraw.minAmount} {minWithdrawal.toLocaleString()} {userCurrency}
                </div>
              )}
              {amountValue > 0 && amountValue > balance && (
                <div className="flex items-center gap-1.5 text-destructive text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Solde insuffisant ({amountValue.toLocaleString()} {userCurrency} requis)
                </div>
              )}

              {/* Fee summary */}
              {amountValue > 0 && selectedOperatorData && (
                <div className="rounded-xl bg-muted/50 p-3 space-y-2" data-testid="fee-calculator-withdrawal">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t.withdraw.withdrawalFee} {feePercent > 0 ? `(${feePercent}%)` : `(${t.withdraw.free})`}
                    </span>
                    <span className={`font-medium ${feeAmount > 0 ? "text-destructive" : "text-green-500"}`}>
                      {feeAmount > 0 ? `-${formatCurrency(feeAmount, userCurrency as SupportedCurrency)}` : t.withdraw.free}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{t.withdraw.netReceive}</span>
                    <span className="text-base font-bold text-green-500" data-testid="net-withdrawal-amount">
                      {formatCurrency(amountValue - feeAmount, userCurrency as SupportedCurrency)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Destination (mobile money) ── */}
            {selectedMethod === "mobile_money" && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Destination</p>

                {/* Country */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="text-base">🌐</span> Pays
                  </p>
                  <div
                    className="flex items-center gap-3 h-12 px-4 rounded-xl border border-border bg-muted/40 text-sm text-foreground"
                    data-testid="display-country"
                  >
                    {selectedCountryData?.code && (
                      <span className="text-xl">{getCountryFlagEmoji(selectedCountryData.code)}</span>
                    )}
                    <span className="font-semibold flex-1">
                      {selectedCountryData?.name || (countriesConfig.length === 0 ? "Chargement..." : "Non défini")}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">{userCurrency}</span>
                  </div>
                </div>

                {/* Operator */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" /> Opérateur Mobile Money
                  </p>
                  {operators.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Aucun opérateur disponible pour ce pays.</p>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                      {operators.map((op) => {
                        const logo = getOperatorLogo(op.name);
                        const isSelected = selectedOperator === op.id;
                        return (
                          <button
                            key={op.id}
                            type="button"
                            data-testid={`button-operator-${op.id}`}
                            onClick={() => setSelectedOperator(op.id)}
                            className={`flex-shrink-0 flex flex-col items-center justify-center gap-2 w-24 h-[88px] rounded-2xl border-2 transition-all ${
                              isSelected
                                ? "border-primary bg-primary/8 shadow-sm"
                                : "border-border bg-background hover:border-muted-foreground/40"
                            }`}
                          >
                            {logo ? (
                              <img src={logo} alt={op.name} className="w-11 h-11 object-contain rounded-xl" />
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                                <Smartphone className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <span className={`text-[11px] font-semibold text-center leading-tight px-1 ${
                              isSelected ? "text-primary" : "text-foreground"
                            }`}>
                              {op.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Registered number */}
                {withdrawalNumbers.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Numéro enregistré</p>
                    <Select value={selectedNumber} onValueChange={setSelectedNumber}>
                      <SelectTrigger className="h-12 rounded-xl text-sm" data-testid="select-withdrawal-number">
                        <SelectValue placeholder="Choisir un numéro" />
                      </SelectTrigger>
                      <SelectContent>
                        {withdrawalNumbers.map((number) => (
                          <SelectItem key={number.id} value={number.id}>
                            {number.phoneNumber} ({number.operatorName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Link href="/dashboard/withdrawal-numbers">
                      <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-manage-numbers">
                        <Settings className="w-3.5 h-3.5" />
                        Gérer mes numéros
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 flex items-start gap-3">
                    <Plus className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.withdraw.noNumbers}</p>
                      <Link href="/dashboard/withdrawal-numbers">
                        <button type="button" className="text-xs text-primary hover:underline mt-1 flex items-center gap-1" data-testid="button-add-withdrawal-number">
                          <Plus className="w-3 h-3" />
                          {t.withdraw.addNumber}
                        </button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Bank transfer details ── */}
            {selectedMethod === "bank_transfer" && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Coordonnées bancaires</p>
                <FormField
                  control={form.control}
                  name="accountDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="IBAN..."
                          className="h-12 rounded-xl"
                          {...field}
                          data-testid="input-account-details"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* ── Fee details link ── */}
            <div className="flex justify-center">
              <Link href="/dashboard/fee-details">
                <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="w-3.5 h-3.5" />
                  {t.withdraw.feeDetails}
                </button>
              </Link>
            </div>

            {/* ── Submit ── */}
            <button
              type="button"
              disabled={isSubmitDisabled}
              data-testid="button-withdraw-confirm"
              onClick={() => setShowConfirmDialog(true)}
              className={`w-full flex items-center justify-center gap-2 h-14 rounded-2xl font-semibold text-base transition-all ${
                isSubmitDisabled
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/25"
              }`}
            >
              <CreditCard className="w-5 h-5" />
              {t.withdraw.submitButton}
            </button>
          </div>
        </form>
      </Form>

      {/* ── Confirm bottom sheet ── */}
      <BottomSheet open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="text-center text-lg">{t.withdraw.confirmTitle}</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border my-2">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.withdraw.confirmMethod}</span>
              <span className="text-sm font-medium">{selectedMethod === "mobile_money" ? t.withdraw.mobileMoney : t.withdraw.bankTransfer}</span>
            </div>
            {selectedCountryData && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-muted-foreground">{t.withdraw.confirmCountry}</span>
                <span className="text-sm font-medium">{selectedCountryData.name}</span>
              </div>
            )}
            {selectedOperatorData && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-muted-foreground">{t.withdraw.confirmOperator}</span>
                <span className="text-sm font-medium">{selectedOperatorData.name}</span>
              </div>
            )}
            {form.getValues("accountDetails") && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-muted-foreground">{t.withdraw.confirmNumber}</span>
                <span className="text-sm font-medium">{form.getValues("accountDetails")}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.withdraw.confirmAmount}</span>
              <span className="text-sm font-medium">{formatCurrency(amountValue, userCurrency as SupportedCurrency)}</span>
            </div>
            {feeAmount > 0 && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-muted-foreground">{t.withdraw.confirmFee} {feePercent > 0 ? `(${feePercent}%)` : ""}</span>
                <span className="text-sm font-medium text-red-500">-{formatCurrency(feeAmount, userCurrency as SupportedCurrency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3.5 bg-muted/30">
              <span className="text-sm font-semibold text-foreground">{t.withdraw.confirmNet}</span>
              <span className="text-base font-bold text-green-500">{formatCurrency(amountValue - feeAmount, userCurrency as SupportedCurrency)}</span>
            </div>
          </div>
          <BottomSheetFooter>
            <Button variant="outline" className="flex-1" onClick={() => setShowConfirmDialog(false)}>
              {t.withdraw.back}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                // Skip OTP step entirely when admin has disabled email OTP
                if (!isOtpRequired) {
                  setShowConfirmDialog(false);
                  clearOtpLock();
                  setOtpRef(null);
                  setOtpCode("");
                  withdrawMutation.mutate(form.getValues());
                  return;
                }
                const remaining = getOtpLockRemaining();
                if (remaining > 0) {
                  setLockRemaining(remaining);
                  setShowConfirmDialog(false);
                  setShowLockedDialog(true);
                  return;
                }
                requestOtpMutation.mutate();
              }}
              disabled={requestOtpMutation.isPending || withdrawMutation.isPending}
              data-testid="button-final-confirm-withdraw"
            >
              {(requestOtpMutation.isPending || withdrawMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
              {t.withdraw.confirm}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>

      {/* ── OTP Verification dialog ── */}
      <BottomSheet open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="text-center text-lg">Code de vérification</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="space-y-5 py-2">
            <div className="text-center space-y-3">
              {/* Circular countdown timer */}
              <div className="relative w-24 h-24 mx-auto" data-testid="text-otp-timer">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" strokeWidth="5" className="stroke-muted" />
                  <circle
                    cx="48" cy="48" r="40" fill="none" strokeWidth="5" strokeLinecap="round"
                    className={
                      otpTimer > 60 ? "stroke-green-500" :
                      otpTimer > 20 ? "stroke-orange-500" :
                      otpTimer > 0  ? "stroke-red-500" :
                      "stroke-muted-foreground"
                    }
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - otpTimer / 600)}`}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Shield className={`w-4 h-4 mb-0.5 ${otpTimer > 60 ? "text-green-500" : otpTimer > 20 ? "text-orange-500" : otpTimer > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                  <span className={`text-base font-bold leading-none ${otpTimer > 60 ? "text-green-500" : otpTimer > 20 ? "text-orange-500" : otpTimer > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {otpTimer > 0
                      ? `${Math.floor(otpTimer / 60)}:${String(otpTimer % 60).padStart(2, "0")}`
                      : "Expiré"}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground px-4">
                Un code à 6 chiffres a été envoyé à <strong>{user?.email}</strong>
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="• • • • • •"
                value={otpCode}
                onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                className="w-full h-14 text-center text-2xl font-bold tracking-[0.5em] bg-muted border border-border rounded-xl outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground/40"
                data-testid="input-withdrawal-otp"
                autoFocus
              />
              {otpError && (
                <p className="text-xs text-destructive text-center">{otpError}</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={otpTimer > 0 || requestOtpMutation.isPending}
                onClick={() => requestOtpMutation.mutate()}
                className="w-full gap-2"
                data-testid="button-resend-otp"
              >
                {requestOtpMutation.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Envoi en cours…</>
                  : otpTimer > 0
                  ? `Renvoyer dans ${Math.floor(otpTimer / 60)}:${String(otpTimer % 60).padStart(2, "0")}`
                  : <><RefreshCw className="w-3.5 h-3.5" />Renvoyer le code</>
                }
              </Button>
            </div>
          </div>
          <BottomSheetFooter>
            <Button variant="outline" className="flex-1" onClick={() => setShowOtpDialog(false)} data-testid="button-cancel-otp">
              Annuler
            </Button>
            <Button
              className="flex-1"
              onClick={() => withdrawMutation.mutate(form.getValues())}
              disabled={withdrawMutation.isPending || otpCode.length < 6 || otpTimer === 0}
              data-testid="button-validate-otp"
            >
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Valider
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>

      {/* ── Locked dialog (OTP déjà envoyé, 15min) ── */}
      <BottomSheet open={showLockedDialog} onOpenChange={setShowLockedDialog}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="text-center text-lg">Opération en cours</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="space-y-4 py-2 text-center">
            <div className="w-16 h-16 rounded-full bg-orange-500/15 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-sm text-muted-foreground px-4">
              Un code de vérification a déjà été envoyé sur votre email. Vous pourrez lancer une nouvelle opération dans :
            </p>
            <div className="text-4xl font-bold tabular-nums text-orange-500" data-testid="text-lock-remaining">
              {Math.floor(lockRemaining / 60)}:{String(lockRemaining % 60).padStart(2, "0")}
            </div>
            <p className="text-xs text-muted-foreground">Réessayez après l'expiration du délai.</p>
          </div>
          <BottomSheetFooter>
            <Button className="w-full" variant="outline" onClick={() => setShowLockedDialog(false)}>
              Fermer
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>

      {/* ── Success popup ── */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative bg-card border border-border rounded-3xl p-8 mx-4 max-w-sm w-full shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowSuccess(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              data-testid="button-close-success"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Retrait effectué avec succès</h3>
              <p className="text-sm text-muted-foreground mt-1">Votre demande est en cours de traitement.</p>
            </div>
            <Button
              className="w-full font-semibold"
              onClick={() => setShowSuccess(false)}
              data-testid="button-another-transaction"
            >
              Effectuer un autre retrait
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
