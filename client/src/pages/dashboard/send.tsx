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
import { SUPPORTED_CURRENCIES, type User, type SupportedCurrency, type Wallet } from "@shared/schema";
import { Send, Globe, Loader2, AlertCircle, Shield, CheckCircle2, Smartphone, TrendingDown, Wallet as WalletIcon, UserCheck, Users, X, CheckCircle, RefreshCw, Clock } from "lucide-react";
import { SearchableSelectContent } from "@/components/ui/searchable-select-content";
import { useLanguage } from "@/lib/language";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import { getOperatorLogo } from "@/lib/operator-logos";
import { getCountryFlagEmoji } from "@/lib/country-flags";
import { z } from "zod";
import { formatCurrency, formatWalletBalance } from "@/lib/currency";
import { useMemo, useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { validateMobileMoneyPhone } from "@shared/mobile-money-phone";

const INTERNAL_KEY = "__ashtech_interne__";

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
  minWithdrawal: number;
  maxWithdrawal: number;
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
  "Congo": "🇨🇬", "Côte d'Ivoire": "🇨🇮", "Gabon": "🇬🇦",
  "Guinée équatoriale": "🇬🇶", "Guinée-Bissau": "🇬🇼",
  "Mali": "🇲🇱", "Niger": "🇳🇪",
  "Ghana": "🇬🇭", "Kenya": "🇰🇪", "Malawi": "🇲🇼", "Mozambique": "🇲🇿",
  "Nigeria": "🇳🇬", "Éthiopie": "🇪🇹", "Ethiopie": "🇪🇹", "Lesotho": "🇱🇸",
  "Sierra Leone": "🇸🇱", "Zambie": "🇿🇲",
  "Ouganda": "🇺🇬", "RD Congo": "🇨🇩", "Rwanda": "🇷🇼", "Sénégal": "🇸🇳",
  "Tanzanie": "🇹🇿", "Tchad": "🇹🇩", "Togo": "🇹🇬", "USA": "🇺🇸"
};

const CURRENCY_FALLBACK_FLAGS: Record<string, string> = {
  XAF: "🇨🇲",
  XAFCF: "🇨🇫",
  XAFC: "🇨🇬",
  XAFG: "🇬🇦",
  XAFTD: "🇹🇩",
  XOFB: "🇧🇯",
  XOFF: "🇧🇫",
  XOFC: "🇨🇮",
  XOFGW: "🇬🇼",
  XOFM: "🇲🇱",
  XOFN: "🇳🇪",
  XOFS: "🇸🇳",
  XOFT: "🇹🇬",
  CDF: "🇨🇩",
  RWF: "🇷🇼",
  TZS: "🇹🇿",
  UGX: "🇺🇬",
  GHS: "🇬🇭",
  KES: "🇰🇪",
  MWK: "🇲🇼",
  MZN: "🇲🇿",
  NGN: "🇳🇬",
  ETB: "🇪🇹",
  LSL: "🇱🇸",
  SLE: "🇸🇱",
  ZMW: "🇿🇲",
  INR: "🇮🇳",
  USD: "🇺🇸",
  USDT: "₮",
};

export default function SendMoneyPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: wallets = [] } = useQuery<Wallet[]>({ queryKey: ["/api/wallets"] });
  const { data: countries, isLoading: isLoadingConfig } = useQuery<CountryConfig[]>({
    queryKey: ["/api/transfers/config"],
  });

  const primaryCurrency = user?.preferredCurrency || "XAF";
  const [selectedWallet, setSelectedWallet] = useState<string>(primaryCurrency);
  const [destination, setDestination] = useState<string>("");
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
  const currencyOptions = useMemo(() => {
    const walletBalances = new Map(wallets.map(wallet => [wallet.currency, wallet.balance || "0"]));
    const countryFlags = new Map<string, string>();
    const countryNames = new Map<string, string[]>();

    for (const country of countries ?? []) {
      if (!countryFlags.has(country.currency)) {
        countryFlags.set(country.currency, getCountryFlagEmoji(country.code));
      }
      const names = countryNames.get(country.currency) || [];
      names.push(country.name);
      countryNames.set(country.currency, names);
    }

    return SUPPORTED_CURRENCIES.map(currency => {
      const balanceValue = parseFloat(walletBalances.get(currency) || "0");
      const balanceLabel = balanceValue.toLocaleString("fr-FR");
      return {
        value: currency,
        label: `${currency} ${balanceLabel}`,
        flag: countryFlags.get(currency) || CURRENCY_FALLBACK_FLAGS[currency] || "🌍",
        searchText: [currency, ...(countryNames.get(currency) || [])].join(" "),
      };
    });
  }, [countries, wallets]);
  const selectedCurrencyOption = currencyOptions.find(option => option.value === selectedWallet);

  const { data: limits } = useQuery<{ minTransfer: number; maxTransfer: number }>({
    queryKey: ["/api/public/limits"],
  });
  const { data: otpStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/public/otp-email-status"],
    staleTime: 30_000,
  });
  const isOtpRequired = otpStatus?.enabled !== false; // default to true (safe)
  const senderCurrency = (selectedWallet || primaryCurrency || "XAF") as string;
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
  const minTransfer = Number(selectedCountry?.minWithdrawal ?? limits?.minTransfer ?? 150);
  const maxTransfer = Number(selectedCountry?.maxWithdrawal ?? limits?.maxTransfer ?? 5000000);
  const amountValue = parseFloat(watchedAmount) || 0;
  const internalAmountValue = parseFloat(internalAmount) || 0;

  useEffect(() => {
    if (!destination && countries && countries.length > 0) {
      const firstCountry = countries[0];
      setDestination(firstCountry.id);
      form.setValue("countryId", firstCountry.id, { shouldValidate: true });
    }
  }, [countries, destination, form]);

  const [feeBearer, setFeeBearer] = useState<"sender" | "receiver">("sender");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingExternalData, setPendingExternalData] = useState<ExternalFormData | null>(null);
  const [showInternalConfirmDialog, setShowInternalConfirmDialog] = useState(false);
  const [prevCountryId, setPrevCountryId] = useState("");
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [showLockedDialog, setShowLockedDialog] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);
  const [showCooldownDialog, setShowCooldownDialog] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

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
  const [otpRef, setOtpRef] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpType, setOtpType] = useState<"external" | "internal">("external");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successLabel, setSuccessLabel] = useState("");
  const [otpTimer, setOtpTimer] = useState(600);
  const [lastTransferPayload, setLastTransferPayload] = useState<{
    type: "external" | "internal";
    recipient?: string; phone?: string; countryOperator?: string; feeBearer?: string;
    amount: string; fee: string; net: string; currency: string;
  } | null>(null);

  useEffect(() => {
    if (watchedCountryId !== prevCountryId) {
      form.setValue("operatorId", "");
      setPrevCountryId(watchedCountryId);
      if (selectedCountry?.currency) {
        // Always align wallet selector with the destination country's currency,
        // whether or not that wallet already exists with a balance.
        setSelectedWallet(selectedCountry.currency);
      }
    }
  }, [watchedCountryId, prevCountryId, form, selectedCountry]);

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
        const minF = selectedOperator.minFee || 0;
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
    if (!showCooldownDialog || cooldownRemaining <= 0) return;
    const id = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) { clearInterval(id); setShowCooldownDialog(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [showCooldownDialog]);

  const requestOtpMutation = useMutation({
    mutationFn: async (payload: {
      type: "external" | "internal";
      recipient?: string;
      phone?: string;
      countryOperator?: string;
      feeBearer?: string;
      amount: string;
      fee: string;
      net: string;
      currency: string;
    }) => {
      const res = await apiRequest("POST", "/api/transfers/request-otp", payload);
      const data = await res.json();
      if (data.code === "OTP_LOCKED") {
        const err = new Error(data.message || "Opération en cours");
        (err as any).code = "OTP_LOCKED";
        (err as any).remainingSeconds = data.remainingSeconds ?? 0;
        throw err;
      }
      if (data.code === "COOLDOWN_ACTIVE") {
        const err = new Error(data.message || "Réessayez dans quelques minutes");
        (err as any).code = "COOLDOWN_ACTIVE";
        (err as any).waitUntil = data.waitUntil ?? (Date.now() + 5 * 60 * 1000);
        throw err;
      }
      if (!res.ok) throw new Error(data.message || "Erreur lors de l'envoi du code");
      return data as { ref: string };
    },
    onSuccess: (data: { ref: string; disabled?: boolean }, variables) => {
      setShowConfirmDialog(false);
      setShowInternalConfirmDialog(false);
      if (data.disabled) {
        clearOtpLock();
        setOtpRef(null);
        setOtpCode("");
        setOtpType(variables.type);
        if (variables.type === "internal") {
          internalMutation.mutate();
        } else {
          externalMutation.mutate(pendingExternalData as ExternalFormData);
        }
        return;
      }
      setOtpLock();
      setOtpRef(data.ref);
      setOtpCode("");
      setOtpError("");
      setOtpType(variables.type);
      setLastTransferPayload(variables);
      setShowOtpDialog(false);
      setTimeout(() => setShowOtpDialog(true), 50);
    },
    onError: (error: Error & { code?: string; remainingSeconds?: number; waitUntil?: number }) => {
      if (error.code === "COOLDOWN_ACTIVE") {
        setCooldownRemaining(Math.max(0, Math.ceil(((error.waitUntil ?? Date.now()) - Date.now()) / 1000)));
        setShowCooldownDialog(true);
        return;
      }
      if (error.code === "OTP_LOCKED") {
        setLockRemaining(error.remainingSeconds ?? 900);
        setShowLockedDialog(true);
        return;
      }
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const internalMutation = useMutation({
    mutationFn: async () => {
      if (!internalIdentifier.trim()) throw new Error("Veuillez entrer l'identifiant du destinataire");
      const amt = parseFloat(internalAmount);
      if (!amt || amt <= 0) throw new Error("Veuillez entrer un montant valide");
      const res = await apiRequest("POST", "/api/transfers/internal", {
        recipientIdentifier: internalIdentifier.trim(),
        amount: internalAmount,
        sourceCurrency: selectedWallet,
        otpRef,
        otpCode,
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || "Erreur lors du transfert");
        (err as any).code = data.code;
        (err as any).waitUntil = data.waitUntil;
        throw err;
      }
      return data;
    },
    onSuccess: (data) => {
      clearOtpLock();
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setInternalIdentifier("");
      setInternalAmount("");
      setOtpRef(null);
      setOtpCode("");
      setShowOtpDialog(false);
      setSuccessLabel(`Compte de ${data.recipientName} crédité avec succès`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    },
    onError: (error: Error & { code?: string; waitUntil?: number }) => {
      clearOtpLock();
      setOtpRef(null);
      setOtpCode("");
      setShowOtpDialog(false);
      if (error.code === "COOLDOWN_ACTIVE") {
        setCooldownRemaining(Math.max(0, Math.ceil(((error.waitUntil ?? Date.now()) - Date.now()) / 1000)));
        setShowCooldownDialog(true);
        return;
      }
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const externalMutation = useMutation({
    mutationFn: async (data: ExternalFormData) => {
      const res = await apiRequest("POST", "/api/transfers/send", {
        ...data,
        sourceCurrency: selectedWallet,
        feeBearer,
        otpRef,
        otpCode,
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.message || "Erreur lors du transfert");
        (err as any).code = json.code;
        (err as any).waitUntil = json.waitUntil;
        throw err;
      }
      return json;
    },
    onSuccess: () => {
      clearOtpLock();
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setPendingExternalData(null);
      form.reset();
      setOtpRef(null);
      setOtpCode("");
      setShowOtpDialog(false);
      setSuccessLabel("Envoi effectué avec succès");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    },
    onError: (error: Error & { code?: string; waitUntil?: number }) => {
      clearOtpLock();
      setOtpRef(null);
      setOtpCode("");
      setShowOtpDialog(false);
      if (error.code === "COOLDOWN_ACTIVE") {
        setCooldownRemaining(Math.max(0, Math.ceil(((error.waitUntil ?? Date.now()) - Date.now()) / 1000)));
        setShowCooldownDialog(true);
        return;
      }
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const currencyMismatch = !isInternal && selectedCountry && selectedWallet !== selectedCountry.currency;

  // True when the destination country's wallet doesn't exist yet or has no funds at all.
  const destinationWallet = selectedCountry ? wallets.find(w => w.currency === selectedCountry.currency) : undefined;
  const needsConversion = !isInternal && !!selectedCountry && parseFloat(destinationWallet?.balance || "0") <= 0;
  // Suggest converting from the wallet with the highest balance (excluding the destination currency).
  const bestSourceWallet = useMemo(() => {
    return [...wallets]
      .filter(w => w.currency !== selectedCountry?.currency)
      .sort((a, b) => parseFloat(b.balance || "0") - parseFloat(a.balance || "0"))[0];
  }, [wallets, selectedCountry]);

  // When sender pays fees: total deducted = amount + fee
  const totalDebitedBySender = feeBearer === "sender"
    ? amountValue + feePreview.feeAmount
    : amountValue;
  const netReceivedByRecipient = feeBearer === "sender"
    ? amountValue
    : amountValue - feePreview.feeAmount;

  const canSubmitExternal = amountValue >= minTransfer &&
    amountValue <= maxTransfer &&
    totalDebitedBySender <= balance &&
    amountValue > 0 &&
    watchedCountryId &&
    watchedOperatorId &&
    !externalMutation.isPending &&
    !feePreview.isLoading &&
    !currencyMismatch &&
    !needsConversion;

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
        <div className="flex items-center gap-3 bg-[#1A237E] border border-[#1A237E] rounded-2xl px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <WalletIcon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/75">{t.send.yourBalance}</p>
            <p className="text-base font-bold text-white tabular-nums">
              {formatWalletBalance(balance, selectedWallet)}
            </p>
          </div>
          {currencyOptions.length > 1 && (
            <Select value={selectedWallet} onValueChange={setSelectedWallet}>
              <SelectTrigger className="h-8 w-auto border-white/30 rounded-lg text-xs font-semibold bg-white/10 text-white gap-1">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true">{selectedCurrencyOption?.flag || "🌍"}</span>
                  <span>{selectedWallet} {balance.toLocaleString("fr-FR")}</span>
                </span>
              </SelectTrigger>
              <SearchableSelectContent
                options={currencyOptions}
                searchPlaceholder={t.send.searchCurrency}
                emptyMessage={t.send.noCurrencyResults}
              />
            </Select>
          )}
        </div>

        {/* Tab switcher: Mobile Money first, Internal second */}
        <div className="flex gap-2 p-1 bg-muted rounded-xl">
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
          <button
            type="button"
            onClick={() => setDestination(INTERNAL_KEY)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              isInternal
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.send.internalTransfer}
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
                  {isLoadingConfig ? (
                    <SelectContent>
                      <SelectItem value="__loading__" disabled>{t.send.loading}</SelectItem>
                    </SelectContent>
                  ) : (
                    <SearchableSelectContent
                      options={(countries ?? []).map(c => ({
                        value: c.id,
                        label: c.name,
                        flag: COUNTRY_FLAGS[c.name] || "🌍",
                        sub: c.currency,
                      }))}
                    />
                  )}
                </Select>
              </div>

              {/* Operator grid */}
              {selectedCountry && (
                <Form {...form}>
                  <form
                    id="external-form"
                    onSubmit={form.handleSubmit((d) => {
                      const phoneValidationError = validateMobileMoneyPhone(
                        d.recipientPhone,
                        selectedCountry?.code || "",
                      );
                      if (phoneValidationError) {
                        form.setError("recipientPhone", {
                          type: "validate",
                          message: phoneValidationError,
                        });
                        return;
                      }
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
                                  const isOrangeMoney = op.name.toLowerCase().includes("orange");
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
                                        ? <img src={logo} alt={op.name} className={`${isOrangeMoney ? "w-16 h-12" : "w-10 h-10"} object-contain rounded-xl`} />
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

                    {/* Fee bearer toggle */}
                    {amountValue > 0 && selectedOperator && feePreview.feeAmount > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qui paye les frais ?</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            data-testid="fee-bearer-sender"
                            onClick={() => setFeeBearer("sender")}
                            className={`relative flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all text-center ${
                              feeBearer === "sender"
                                ? "border-primary bg-primary/8 shadow-sm"
                                : "border-border bg-background hover:border-muted-foreground/40"
                            }`}
                          >
                            {feeBearer === "sender" && (
                              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                <span className="text-[9px] text-black font-bold">✓</span>
                              </span>
                            )}
                            <UserCheck className={`w-5 h-5 ${feeBearer === "sender" ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-xs font-semibold leading-tight ${feeBearer === "sender" ? "text-primary" : "text-foreground"}`}>
                              Moi
                            </span>
                          </button>
                          <button
                            type="button"
                            data-testid="fee-bearer-receiver"
                            onClick={() => setFeeBearer("receiver")}
                            className={`relative flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all text-center ${
                              feeBearer === "receiver"
                                ? "border-primary bg-primary/8 shadow-sm"
                                : "border-border bg-background hover:border-muted-foreground/40"
                            }`}
                          >
                            {feeBearer === "receiver" && (
                              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                <span className="text-[9px] text-black font-bold">✓</span>
                              </span>
                            )}
                            <Users className={`w-5 h-5 ${feeBearer === "receiver" ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-xs font-semibold leading-tight ${feeBearer === "receiver" ? "text-primary" : "text-foreground"}`}>
                              Le receveur
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Fee preview inline */}
                    {amountValue > 0 && selectedOperator && (
                      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden divide-y divide-border text-sm">
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-muted-foreground">{t.send.summaryAmount}</span>
                          <span className="font-semibold tabular-nums">{formatWalletBalance(amountValue, localCurrency)}</span>
                        </div>
                        {feePreview.feeAmount > 0 && (
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <TrendingDown className="w-3.5 h-3.5" />
                              {t.send.summaryFee}
                              {feePreview.isLoading ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : feePreview.feePercentage > 0 ? ` (${feePreview.feePercentage}%)` : ""}
                            </span>
                            <span className="font-semibold text-orange-500 tabular-nums">
                              {feeBearer === "sender" ? "+" : "-"} {formatWalletBalance(feePreview.feeAmount, localCurrency)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
                          <span className="font-semibold">
                            {feeBearer === "sender" ? "Débité de votre compte" : t.send.summaryNet}
                          </span>
                          <span className="font-bold tabular-nums">
                            {formatWalletBalance(totalDebitedBySender, localCurrency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 bg-green-500/5">
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">Net reçu par destinataire</span>
                          <span className="font-bold text-green-500 tabular-nums">
                            {formatWalletBalance(netReceivedByRecipient, localCurrency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
                          <span>{t.send.balanceAfter}</span>
                          <span className={totalDebitedBySender > balance ? "text-red-500 font-semibold" : ""}>
                            {formatWalletBalance(Math.max(0, balance - totalDebitedBySender), localCurrency)}
                          </span>
                        </div>
                      </div>
                    )}

                    {needsConversion && selectedCountry && (
                      <Alert variant="destructive" className="rounded-xl">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <p>
                            Vous n'avez pas encore de fonds sur le portefeuille <strong>{selectedCountry.currency}</strong> ({selectedCountry.name}). Convertissez d'abord vos fonds vers ce portefeuille pour pouvoir envoyer.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            className="mt-3 rounded-lg"
                            onClick={() => setLocation(
                              `/dashboard/convert?to=${encodeURIComponent(selectedCountry.currency)}${bestSourceWallet ? `&from=${encodeURIComponent(bestSourceWallet.currency)}` : ""}`
                            )}
                            data-testid="button-convert-first"
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            Convertir vers {selectedCountry.currency}
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}

                    {!needsConversion && amountValue > balance && (
                      <Alert variant="destructive" className="rounded-xl">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{t.send.insufficientBalance}</AlertDescription>
                      </Alert>
                    )}

                    {!needsConversion && currencyMismatch && (
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
              onClick={() => {
                // Skip OTP step entirely when admin has disabled email OTP
                if (!isOtpRequired) {
                  setShowInternalConfirmDialog(false);
                  clearOtpLock();
                  setOtpRef(null);
                  setOtpCode("");
                  internalMutation.mutate();
                  return;
                }
                const remaining = getOtpLockRemaining();
                if (remaining > 0) {
                  setLockRemaining(remaining);
                  setShowInternalConfirmDialog(false);
                  setShowLockedDialog(true);
                  return;
                }
                requestOtpMutation.mutate({
                  type: "internal",
                  recipient: internalIdentifier,
                  amount: internalAmountValue.toLocaleString("fr-FR"),
                  fee: "0",
                  net: internalAmountValue.toLocaleString("fr-FR"),
                  currency: selectedWallet,
                });
              }}
              disabled={requestOtpMutation.isPending || internalMutation.isPending}
              data-testid="button-final-confirm-internal"
            >
              {requestOtpMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
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
              <span className="text-sm text-muted-foreground">Frais payés par</span>
              <span className="text-sm font-semibold">{feeBearer === "sender" ? "Moi (l'envoyeur)" : "Le receveur"}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.send.confirmSentAmount}</span>
              <span className="text-sm font-bold tabular-nums">{formatWalletBalance(amountValue, selectedWallet)}</span>
            </div>
            {feePreview.feeAmount > 0 && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-muted-foreground">{t.send.confirmFeePercent} ({feePreview.feePercentage}%)</span>
                <span className="text-sm font-semibold text-orange-500 tabular-nums">
                  {feeBearer === "sender" ? "+" : "-"}{formatWalletBalance(feePreview.feeAmount, selectedWallet)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm font-semibold text-muted-foreground">Débité de votre compte</span>
              <span className="text-sm font-bold tabular-nums">{formatWalletBalance(totalDebitedBySender, selectedWallet)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5 bg-green-500/5">
              <span className="text-sm font-semibold">{t.send.confirmNetReceived}</span>
              <span className="text-base font-bold text-green-500 tabular-nums">{formatWalletBalance(netReceivedByRecipient, selectedWallet)}</span>
            </div>
          </div>
          <BottomSheetFooter>
            <Button variant="outline" className="flex-1" onClick={() => setShowConfirmDialog(false)}>{t.send.back}</Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-black font-bold"
              onClick={() => {
                if (!pendingExternalData) return;
                // Skip OTP step entirely when admin has disabled email OTP
                if (!isOtpRequired) {
                  setShowConfirmDialog(false);
                  clearOtpLock();
                  setOtpRef(null);
                  setOtpCode("");
                  externalMutation.mutate(pendingExternalData);
                  return;
                }
                const remaining = getOtpLockRemaining();
                if (remaining > 0) {
                  setLockRemaining(remaining);
                  setShowConfirmDialog(false);
                  setShowLockedDialog(true);
                  return;
                }
                requestOtpMutation.mutate({
                  type: "external",
                  recipient: pendingExternalData.recipientName,
                  phone: pendingExternalData.recipientPhone,
                  countryOperator: `${selectedCountry?.name || ""} · ${selectedOperator?.name || ""}`,
                  feeBearer: feeBearer === "sender" ? "Moi (l'envoyeur)" : "Le receveur",
                  amount: amountValue.toLocaleString("fr-FR"),
                  fee: feePreview.feeAmount > 0 ? `-${feePreview.feeAmount.toLocaleString("fr-FR")}` : "0",
                  net: netReceivedByRecipient.toLocaleString("fr-FR"),
                  currency: selectedWallet,
                });
              }}
              disabled={requestOtpMutation.isPending || externalMutation.isPending}
              data-testid="button-final-confirm-external"
            >
              {requestOtpMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              {t.send.confirm}
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
                data-testid="input-transfer-otp"
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
                onClick={() => lastTransferPayload && requestOtpMutation.mutate(lastTransferPayload)}
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
              className="flex-1 bg-primary hover:bg-primary/90 text-black font-bold"
              onClick={() => {
                if (otpType === "internal") internalMutation.mutate();
                else if (pendingExternalData) externalMutation.mutate(pendingExternalData);
              }}
              disabled={(otpType === "internal" ? internalMutation.isPending : externalMutation.isPending) || otpCode.length < 6 || otpTimer === 0}
              data-testid="button-validate-otp"
            >
              {(otpType === "internal" ? internalMutation.isPending : externalMutation.isPending)
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <CheckCircle className="w-4 h-4 mr-2" />}
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

      {/* ── Cooldown 5min dialog ── */}
      <BottomSheet open={showCooldownDialog} onOpenChange={setShowCooldownDialog}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="text-center text-lg">Opération rejetée</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="space-y-4 py-2 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm text-muted-foreground px-4">
              Votre dernière opération a été rejetée. Vous pourrez réessayer dans :
            </p>
            <div className="text-4xl font-bold tabular-nums text-red-500" data-testid="text-cooldown-remaining">
              {Math.floor(cooldownRemaining / 60)}:{String(cooldownRemaining % 60).padStart(2, "0")}
            </div>
            <p className="text-xs text-muted-foreground">Le délai expire automatiquement, la page se déverrouille seule.</p>
          </div>
          <BottomSheetFooter>
            <Button className="w-full" variant="outline" onClick={() => setShowCooldownDialog(false)}>
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
              <h3 className="text-xl font-bold text-foreground">{successLabel || "Envoi effectué avec succès"}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {otpType === "internal" ? "Transfert instantané — aucun frais." : "Votre transaction est en cours de traitement."}
              </p>
            </div>
            <Button
              className="w-full font-semibold"
              onClick={() => { setShowSuccess(false); form.reset(); setInternalIdentifier(""); setInternalAmount(""); }}
              data-testid="button-another-transaction"
            >
              Effectuer un autre envoi
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
