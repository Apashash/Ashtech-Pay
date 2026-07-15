import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
import type { User, SupportedCurrency } from "@shared/schema";
import { CreditCard, Loader2, AlertCircle, Phone, CheckCircle, XCircle, Smartphone, ExternalLink, Hash, Clock, Copy, TrendingDown, Bitcoin, DollarSign } from "lucide-react";
import { SearchableSelectContent } from "@/components/ui/searchable-select-content";
import { useLanguage } from "@/lib/language";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import { getOperatorLogo } from "@/lib/operator-logos";
import { z } from "zod";
import { useState, useEffect, useMemo, useRef } from "react";
import { formatCurrency } from "@/lib/currency";
import { getCountryFlagEmoji } from "@/lib/country-flags";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OperatorConfig {
  id: string;
  name: string;
  type: string;
  gateway: string;
  paymentProvider: string;
  feePercentage: number;
  feeFixed?: number;
  fixedFee: number;
  afribapayFee?: number;
  pixpayFee?: number;
  ashtechMargin?: number;
  pixpayOperatorType?: string;
  otpUssdCode?: string | null;
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

const depositFormSchema = z.object({
  countryId: z.string().min(1),
  operatorId: z.string().min(1),
  phoneNumber: z.string().min(8),
  amount: z.string().min(1).refine(v => parseFloat(v) > 0),
  description: z.string().optional(),
});

type DepositFormData = z.infer<typeof depositFormSchema>;

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000, 100000];

export default function DepositPage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [showValidationMessage, setShowValidationMessage] = useState(false);
  const [depositReference, setDepositReference] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "failed">("pending");
  const [failureReason, setFailureReason] = useState<string>("");
  const [countdown, setCountdown] = useState(8 * 60);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpType, setOtpType] = useState<"api" | "ussd">("api");
  const [otpUssdCode, setOtpUssdCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [waveUrl, setWaveUrl] = useState<string | null>(null);
  const [pixpayOtpCode, setPixpayOtpCode] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingDepositData, setPendingDepositData] = useState<DepositFormData | null>(null);

  const [depositMode, setDepositMode] = useState<"mobile_money" | "crypto">("mobile_money");
  const [cryptoAmountUsd, setCryptoAmountUsd] = useState("");
  const [cryptoStatus, setCryptoStatus] = useState<"idle" | "pending" | "waiting" | "success" | "cancelled">("idle");
  const [cryptoRef, setCryptoRef] = useState("");
  const [cryptoPayAddress, setCryptoPayAddress] = useState("");
  const [cryptoPayAmount, setCryptoPayAmount] = useState(0);
  const [cryptoPaymentId, setCryptoPaymentId] = useState("");
  const [cryptoExpiresAt, setCryptoExpiresAt] = useState<Date | null>(null);
  const [cryptoAddressCopied, setCryptoAddressCopied] = useState(false);
  const [cryptoPayCurrency, setCryptoPayCurrency] = useState("usdttrc20");
  const cryptoPollingRef = useRef<NodeJS.Timeout | null>(null);

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: wallets } = useQuery<{ id: string; currency: string; balance: string }[]>({
    queryKey: ["/api/wallets"],
  });

  const { data: countries, isLoading: isLoadingConfig } = useQuery<CountryConfig[]>({
    queryKey: ["/api/transfers/config?type=deposit"],
  });

  const form = useForm<DepositFormData>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      countryId: "",
      operatorId: "",
      phoneNumber: "",
      amount: "",
      description: ""
    },
  });

  const watchedCountryId = form.watch("countryId");
  const watchedOperatorId = form.watch("operatorId");
  const watchedAmount = form.watch("amount");
  const watchedPhoneNumber = form.watch("phoneNumber");
  const [prevCountryId, setPrevCountryId] = useState<string>("");

  const selectedCountry = useMemo(() => {
    return countries?.find(c => c.id === watchedCountryId);
  }, [countries, watchedCountryId]);

  const selectedOperator = useMemo(() => {
    return selectedCountry?.operators.find(op => op.id === watchedOperatorId);
  }, [selectedCountry, watchedOperatorId]);

  const feeCalculation = useMemo(() => {
    const amount = parseFloat(watchedAmount) || 0;
    if (amount <= 0 || !selectedOperator) return null;

    const provider = selectedOperator.paymentProvider || "swychr";
    const isAfribaPay = provider === "afribapay";
    const isPixPay = provider === "pixpay";

    let feePercentage = 0;
    let fee = 0;

    if (isAfribaPay) {
      const afribapayFee = selectedOperator.afribapayFee || 3;
      const ashtechMargin = selectedOperator.ashtechMargin || 2;
      feePercentage = afribapayFee + ashtechMargin;
      fee = (amount * feePercentage) / 100;
    } else if (isPixPay) {
      const pixpayFee = selectedOperator.pixpayFee || 3;
      const ashtechMargin = selectedOperator.ashtechMargin || 2;
      feePercentage = pixpayFee + ashtechMargin;
      fee = (amount * feePercentage) / 100;
    } else {
      feePercentage = selectedOperator.feePercentage || 0;
      const fixedFee = selectedOperator.fixedFee || 0;
      if (feePercentage > 0) {
        fee = (amount * feePercentage) / 100;
      } else if (fixedFee > 0) {
        fee = fixedFee;
      }
      if (selectedOperator.minFee !== null && fee < (selectedOperator.minFee ?? 0)) fee = selectedOperator.minFee ?? 0;
      if (selectedOperator.maxFee !== null && fee > (selectedOperator.maxFee ?? Infinity)) fee = selectedOperator.maxFee ?? fee;
    }

    const creditedAmount = amount - fee;
    return { amount, fee, creditedAmount: creditedAmount > 0 ? creditedAmount : 0, feePercentage, fixedFee: selectedOperator.fixedFee || 0, isAfribaPay, isPixPay };
  }, [watchedAmount, selectedOperator]);

  useEffect(() => {
    if (watchedCountryId !== prevCountryId) {
      form.setValue("operatorId", "");
      setPrevCountryId(watchedCountryId);
    }
  }, [watchedCountryId, prevCountryId, form]);

  const parseFailureMessage = (description?: string): string => {
    if (!description) return "";
    const errorCodeMap: Record<string, string> = {
      "OPERATOR_PAYER_INSUFF_BALANCE": "Solde insuffisant sur votre compte Mobile Money.",
      "OPERATOR_PAYER_NOT_FOUND": "Numéro de téléphone introuvable chez l'opérateur.",
      "OPERATOR_PAYER_LIMIT_REACHED": "Limite de transaction Mobile Money atteinte.",
      "OPERATOR_PAYER_ACCOUNT_BLOCKED": "Compte Mobile Money bloqué. Contactez votre opérateur.",
      "OPERATOR_TRANSACTION_DECLINED": "Transaction refusée par l'opérateur.",
      "OPERATOR_TIMEOUT": "Délai d'attente dépassé. Réessayez.",
      "PAYER_CANCELED": "Vous avez annulé la transaction.",
      "INVALID_PHONE": "Numéro de téléphone invalide pour cet opérateur.",
    };
    try {
      const match = description.match(/errorMessage["\s:]+([A-Z_]+)/);
      if (match && match[1] && errorCodeMap[match[1]]) return errorCodeMap[match[1]];
    } catch {}
    return "";
  };

  const startDepositPolling = (ref: string) => {
    setCountdown(8 * 60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPaymentStatus("failed");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/transactions/status/${ref}`, { credentials: "include", headers: getAuthHeaders() });
        if (res.ok) {
          const statusData = await res.json();
          if (statusData.status === "completed") {
            setPaymentStatus("success");
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pollingRef.current) clearInterval(pollingRef.current);
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          } else if (statusData.status === "failed") {
            setFailureReason(parseFailureMessage(statusData.description));
            setPaymentStatus("failed");
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
      } catch (e) {
        console.error("Error checking deposit status:", e);
      }
    }, 2000);
  };

  const handleCancelDeposit = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPaymentStatus("failed");
    if (depositReference) {
      try { await apiRequest("POST", `/api/transactions/cancel/${depositReference}`, {}); } catch {}
    }
    setIsCancelling(false);
  };

  const isPixPayOtp = selectedOperator?.paymentProvider === "pixpay" &&
    selectedOperator?.pixpayOperatorType === "otp";

  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      const payload: any = {
        amount: data.amount,
        paymentMethod: "mobile_money",
        operatorId: data.operatorId,
        countryId: data.countryId,
        phoneNumber: data.phoneNumber,
        description: data.description,
      };
      if (isPixPayOtp && pixpayOtpCode) payload.pixpayOtp = pixpayOtpCode;
      const res = await apiRequest("POST", "/api/deposits", payload);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      const ref = data.reference || data.transaction?.reference || "";
      setShowValidationMessage(true);
      setDepositReference(ref);
      setPaymentStatus("pending");
      setOtpCode("");
      setWaveUrl(null);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      if (data.waveUrl) {
        setWaveUrl(data.waveUrl);
        setOtpRequired(false);
        startDepositPolling(ref);
      } else if (data.otpRequired) {
        setOtpRequired(true);
        setOtpType(data.otpType || "api");
        setOtpUssdCode(data.ussdCode || "");
      } else {
        setOtpRequired(false);
        startDepositPolling(ref);
      }
    },
    onError: (error: Error) => {
      toast({ title: t.deposit.toastError, description: error.message, variant: "destructive" });
    },
  });

  const otpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deposits/confirm-otp", { ref: depositReference, otpCode });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Code OTP invalide"); }
      return res.json();
    },
    onSuccess: () => {
      setOtpRequired(false);
      toast({ title: t.deposit.otpValidated, description: t.deposit.otpProcessing });
      startDepositPolling(depositReference);
    },
    onError: (error: Error) => {
      toast({ title: t.deposit.otpErrorTitle, description: error.message, variant: "destructive" });
    },
  });

  const cryptoDepositMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(cryptoAmountUsd);
      if (!amt || amt <= 0) throw new Error("Entrez un montant valide");
      if (cryptoMinDeposit && amt < cryptoMinDeposit) throw new Error(`Le dépôt minimum est de ${cryptoMinDeposit} $ pour ce réseau`);
      const res = await apiRequest("POST", "/api/deposits/crypto", { amountUsd: cryptoAmountUsd, payCurrency: cryptoPayCurrency });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur lors du dépôt crypto");
      return data;
    },
    onSuccess: (data) => {
      setCryptoRef(data.reference || "");
      setCryptoPayAddress(data.payAddress || "");
      setCryptoPayAmount(data.payAmount || 0);
      setCryptoPaymentId(data.paymentId || "");
      setCryptoExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
      setCryptoStatus("waiting");
      // Start polling for payment status every 15s
      if (cryptoPollingRef.current) clearInterval(cryptoPollingRef.current);
      cryptoPollingRef.current = setInterval(async () => {
        try {
          const r = await apiRequest("GET", `/api/transactions?ref=${data.reference}`);
          const txData = await r.json();
          const tx = Array.isArray(txData) ? txData.find((t: any) => t.reference === data.reference) : null;
          if (tx && tx.status === "completed") {
            if (cryptoPollingRef.current) clearInterval(cryptoPollingRef.current);
            setCryptoStatus("success");
            queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          }
        } catch {}
      }, 15000);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const copyCryptoAddress = () => {
    navigator.clipboard.writeText(cryptoPayAddress).then(() => {
      setCryptoAddressCopied(true);
      setTimeout(() => setCryptoAddressCopied(false), 2000);
    });
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleSubmit = (data: DepositFormData) => {
    setPendingDepositData(data);
    setShowConfirmDialog(true);
  };

  const handleConfirmDeposit = () => {
    if (!pendingDepositData) return;
    setShowConfirmDialog(false);
    setShowValidationMessage(false);
    depositMutation.mutate(pendingDepositData);
  };

  const canSubmit = useMemo(() => {
    return (parseFloat(watchedAmount) || 0) > 0 && !!watchedCountryId && !!watchedOperatorId && watchedPhoneNumber.length >= 8;
  }, [watchedAmount, watchedCountryId, watchedOperatorId, watchedPhoneNumber]);

  const resetWizard = () => {
    setShowValidationMessage(false);
    setPaymentStatus("pending");
    setDepositReference("");
    setOtpRequired(false);
    setOtpCode("");
    setWaveUrl(null);
    setIsCancelling(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pollingRef.current) clearInterval(pollingRef.current);
    form.reset();
  };

  const copyRef = () => {
    navigator.clipboard.writeText(depositReference)
      .then(() => toast({ title: t.deposit.refCopied }))
      .catch(() => toast({ title: t.deposit.refCopyFail, variant: "destructive" }));
  };

  const amountNum = parseFloat(watchedAmount) || 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cs = params.get("crypto_status");
    const ref = params.get("ref");
    if (cs === "success") { setCryptoStatus("success"); if (ref) setCryptoRef(ref); setDepositMode("crypto"); }
    else if (cs === "cancelled") { setCryptoStatus("cancelled"); setDepositMode("crypto"); }
  }, []);

  const usdtWallet = wallets?.find(w => w.currency === "USDT");

  const { data: nowPaymentsCurrenciesData } = useQuery<{ currencies: { ticker: string; label: string; network: string; logoUrl: string }[] }>({
    queryKey: ["/api/nowpayments/currencies"],
    enabled: depositMode === "crypto",
    staleTime: 5 * 60 * 1000,
  });
  const cryptoNetworkOptions = nowPaymentsCurrenciesData?.currencies || [];
  const selectedCryptoNetwork = cryptoNetworkOptions.find(o => o.ticker === cryptoPayCurrency);

  const { data: feeSettings } = useQuery<{ cryptoFeePercent: number; cryptoMinDeposit: number }>({
    queryKey: ["/api/public/fee-settings"],
  });
  const cryptoFeePercent = feeSettings?.cryptoFeePercent ?? 2.5;

  const { data: minAmountData } = useQuery<{ min_amount: number }>({
    queryKey: ["/api/nowpayments/min-amount", cryptoPayCurrency],
    queryFn: async () => {
      const res = await fetch(`/api/nowpayments/min-amount?currency_from=usd&currency_to=${cryptoPayCurrency}`);
      if (!res.ok) throw new Error("Indisponible");
      return res.json();
    },
    enabled: depositMode === "crypto" && !!cryptoPayCurrency,
    staleTime: 5 * 60 * 1000,
  });
  const cryptoMinDeposit = minAmountData?.min_amount ?? feeSettings?.cryptoMinDeposit ?? 1;

  const cryptoAmtNum = parseFloat(cryptoAmountUsd) || 0;
  const cryptoFee = cryptoAmtNum * (cryptoFeePercent / 100);
  const cryptoNet = cryptoAmtNum - cryptoFee;

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-4 pb-8">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">{t.deposit.title}</h1>
        </div>

        {/* Balance bar — shows USDT wallet in crypto mode, country wallet otherwise */}
        {(() => {
          if (depositMode === "crypto") {
            const usdtWallet = wallets?.find(w => w.currency === "USDT");
            const usdtBalance = usdtWallet?.balance || "0";
            return (
              <div className="flex items-center gap-3 bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Bitcoin className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Solde USDT actuel</p>
                  <p className="text-base font-bold text-foreground tabular-nums">
                    {parseFloat(usdtBalance).toFixed(4)} USDT
                  </p>
                </div>
              </div>
            );
          }
          const displayCurrency = (selectedCountry?.currency || user?.preferredCurrency || "XAF") as SupportedCurrency;
          const isPrimary = displayCurrency === (user?.preferredCurrency || "XAF");
          const secondaryWallet = wallets?.find(w => w.currency === displayCurrency);
          const displayBalance = isPrimary
            ? (user?.balance || "0")
            : (secondaryWallet?.balance || "0");
          return (
            <div className="flex items-center gap-3 bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20 rounded-2xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {t.deposit.currentBalance}
                  {selectedCountry && ` (${displayCurrency})`}
                </p>
                <p className="text-base font-bold text-foreground tabular-nums">
                  {formatCurrency(displayBalance, displayCurrency)}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Deposit mode tabs */}
        <div className="flex rounded-xl border border-border bg-muted/30 p-1 gap-1">
          <button
            type="button"
            onClick={() => setDepositMode("mobile_money")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${depositMode === "mobile_money" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-mobile-money"
          >
            <Smartphone className="w-4 h-4" />
            Mobile Money
          </button>
          <button
            type="button"
            onClick={() => { setDepositMode("crypto"); setCryptoStatus("idle"); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${depositMode === "crypto" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-crypto"
          >
            <Bitcoin className="w-4 h-4" />
            Crypto (USDT)
          </button>
        </div>

        {/* Crypto deposit section */}
        {depositMode === "crypto" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 pb-6 pt-4 space-y-5">
              {cryptoStatus === "success" ? (
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Paiement confirmé !</h3>
                    <p className="text-sm text-muted-foreground mt-1">Votre portefeuille USDT a été crédité avec succès.</p>
                  </div>
                  {usdtWallet && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-center">
                      <p className="text-xs text-muted-foreground">Solde USDT</p>
                      <p className="text-xl font-bold text-blue-500 tabular-nums">{parseFloat(usdtWallet.balance).toFixed(4)} USDT</p>
                    </div>
                  )}
                  {cryptoRef && (
                    <div className="bg-muted/40 rounded-xl p-3 text-left">
                      <p className="text-xs text-muted-foreground mb-0.5">Référence</p>
                      <p className="font-mono text-sm font-bold text-foreground truncate">{cryptoRef}</p>
                    </div>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => { setCryptoStatus("idle"); setCryptoAmountUsd(""); setCryptoPayAddress(""); }} data-testid="button-crypto-new-deposit">
                    Nouveau dépôt
                  </Button>
                </div>

              ) : cryptoStatus === "waiting" ? (
                <div className="space-y-5 py-2">
                  {/* Header */}
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
                      <Clock className="w-6 h-6 text-blue-500" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">En attente de paiement</h3>
                    <p className="text-xs text-muted-foreground">Envoyez exactement le montant indiqué à l'adresse ci-dessous</p>
                  </div>

                  {/* Amount to send */}
                  <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Montant exact à envoyer</p>
                    <p className="text-3xl font-bold text-primary tabular-nums">{cryptoPayAmount.toFixed(6)}</p>
                    <p className="text-sm font-semibold text-muted-foreground mt-0.5">{selectedCryptoNetwork ? `${selectedCryptoNetwork.label} · ${selectedCryptoNetwork.network}` : cryptoPayCurrency.toUpperCase()}</p>
                  </div>

                  {/* QR Code */}
                  {cryptoPayAddress && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative flex items-center justify-center">
                        {/* Pulsing rings */}
                        <span className="absolute inset-0 rounded-2xl animate-ping bg-primary/20 pointer-events-none" style={{ animationDuration: "1.6s" }} />
                        <span className="absolute inset-[-6px] rounded-[20px] animate-ping bg-primary/10 pointer-events-none" style={{ animationDuration: "1.6s", animationDelay: "0.3s" }} />
                        <div className="relative bg-white rounded-2xl p-3 shadow-md ring-2 ring-primary/40" style={{ animation: "qr-pulse 1.6s ease-in-out infinite" }}>
                          <style>{`
                            @keyframes qr-pulse {
                              0%, 100% { box-shadow: 0 0 0 0 rgba(240,185,11,0.5), 0 0 0 0 rgba(240,185,11,0.25); }
                              50% { box-shadow: 0 0 0 8px rgba(240,185,11,0.15), 0 0 0 16px rgba(240,185,11,0.05); }
                            }
                          `}</style>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(cryptoPayAddress)}&color=000000&bgcolor=FFFFFF`}
                            alt={`QR Code adresse ${selectedCryptoNetwork?.label || cryptoPayCurrency}`}
                            className="w-44 h-44 rounded-xl"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Réseau : <span className="font-semibold text-foreground">{selectedCryptoNetwork?.network || cryptoPayCurrency.toUpperCase()}</span></p>
                    </div>
                  )}

                  {/* Address to copy */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Adresse {selectedCryptoNetwork?.label || cryptoPayCurrency.toUpperCase()}</p>
                    <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-3 border border-border">
                      <p className="font-mono text-xs text-foreground flex-1 break-all leading-relaxed">{cryptoPayAddress}</p>
                      <button
                        type="button"
                        onClick={copyCryptoAddress}
                        className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${cryptoAddressCopied ? "bg-green-500/20 text-green-500" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                        data-testid="button-copy-crypto-address"
                      >
                        {cryptoAddressCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {cryptoAddressCopied ? "Copié !" : "Copier"}
                      </button>
                    </div>
                  </div>

                  {/* Warning */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
                    <ExternalLink className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-amber-500">Important :</span> Envoyez uniquement sur le réseau <strong>{selectedCryptoNetwork?.network || cryptoPayCurrency.toUpperCase()}</strong>. Tout envoi sur un autre réseau sera perdu.
                    </div>
                  </div>

                  {/* Ref + polling indicator */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-xl px-3 py-2">
                    <span className="font-mono truncate flex-1">{cryptoRef}</span>
                    <span className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      Surveillance active
                    </span>
                  </div>

                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
                    if (cryptoPollingRef.current) clearInterval(cryptoPollingRef.current);
                    setCryptoStatus("idle");
                    setCryptoAmountUsd("");
                    setCryptoPayAddress("");
                  }}>
                    Annuler / Nouveau dépôt
                  </Button>
                </div>

              ) : cryptoStatus === "cancelled" ? (
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
                    <XCircle className="w-8 h-8 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Paiement annulé</h3>
                    <p className="text-sm text-muted-foreground mt-1">Le paiement crypto a expiré ou a été annulé. Vous pouvez réessayer.</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => { setCryptoStatus("idle"); setCryptoAmountUsd(""); }} data-testid="button-crypto-retry">
                    Réessayer
                  </Button>
                </div>

              ) : (
                <>

                  {usdtWallet && (
                    <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-3">
                      <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Solde USDT actuel</p>
                        <p className="text-base font-bold text-foreground tabular-nums">{parseFloat(usdtWallet.balance).toFixed(4)} USDT</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Réseau de paiement</label>
                    <Select value={cryptoPayCurrency} onValueChange={setCryptoPayCurrency}>
                      <SelectTrigger className="h-12 rounded-xl" data-testid="select-crypto-network">
                        {selectedCryptoNetwork ? (
                          <div className="flex items-center gap-2.5">
                            <img src={selectedCryptoNetwork.logoUrl} alt={selectedCryptoNetwork.label} className="w-6 h-6 rounded-full shrink-0 object-contain bg-white" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                            <span className="font-semibold">{selectedCryptoNetwork.label}</span>
                            <span className="text-muted-foreground text-sm">· {selectedCryptoNetwork.network}</span>
                          </div>
                        ) : (
                          <SelectValue placeholder="Choisir un réseau" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {cryptoNetworkOptions.map(opt => (
                          <SelectItem key={opt.ticker} value={opt.ticker}>
                            <div className="flex items-center gap-2.5">
                              <img src={opt.logoUrl} alt={opt.label} className="w-5 h-5 rounded-full shrink-0 object-contain bg-white" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                              <span className="font-semibold">{opt.label}</span>
                              <span className="text-muted-foreground text-xs">· {opt.network}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Montant (USDT)</label>
                    <div className="flex rounded-xl border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
                      <span className="flex items-center px-3 bg-muted border-r border-border text-sm font-bold text-muted-foreground shrink-0 whitespace-nowrap">
                        {selectedCryptoNetwork?.label || "USDT"}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="0.01"
                        placeholder="0.00"
                        value={cryptoAmountUsd}
                        onChange={e => setCryptoAmountUsd(e.target.value)}
                        className="flex-1 min-w-0 pr-4 h-12 bg-background text-base font-semibold focus:outline-none"
                        data-testid="input-crypto-amount"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[11, 25, 50, 100, 200].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCryptoAmountUsd(String(v))}
                          className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 font-semibold transition-all"
                        >
                          {v} USDT
                        </button>
                      ))}
                    </div>
                  </div>

                  {cryptoAmtNum > 0 && (
                    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                        <span className="text-sm text-muted-foreground">Montant saisi</span>
                        <span className="text-sm font-semibold tabular-nums">{cryptoAmtNum.toFixed(2)} USDT</span>
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <TrendingDown className="w-3.5 h-3.5" />
                          Frais ({cryptoFeePercent}%)
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-red-500">-{cryptoFee.toFixed(4)} USDT</span>
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between bg-green-500/5">
                        <span className="text-sm font-semibold text-foreground">Crédité (USDT)</span>
                        <span className="text-lg font-bold text-green-500 tabular-nums">{cryptoNet.toFixed(4)} USDT</span>
                      </div>
                    </div>
                  )}

                  {cryptoAmtNum > 0 && cryptoMinDeposit && cryptoAmtNum < cryptoMinDeposit && (
                    <p className="text-xs text-amber-500 font-medium text-center -mt-1">
                      ⚠️ Minimum {cryptoMinDeposit} $ pour {selectedCryptoNetwork?.label || "ce réseau"} ({selectedCryptoNetwork?.network})
                    </p>
                  )}

                  <Button
                    className="w-full h-12 rounded-xl font-bold"
                    size="lg"
                    disabled={cryptoAmtNum < cryptoMinDeposit || cryptoDepositMutation.isPending}
                    onClick={() => cryptoDepositMutation.mutate()}
                    data-testid="button-crypto-deposit"
                  >
                    {cryptoDepositMutation.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Génération de l'adresse…</>
                      : <><Bitcoin className="w-4 h-4 mr-2" />Générer l'adresse {selectedCryptoNetwork?.label || "crypto"}</>
                    }
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Une adresse unique USDT TRC20 sera générée. Pas de redirection externe.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {depositMode === "mobile_money" && isLoadingConfig ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : depositMode === "mobile_money" && !countries?.length ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t.deposit.noCountry}</AlertDescription>
          </Alert>
        ) : depositMode === "mobile_money" ? (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">


            <div className="px-6 pb-6 pt-4">
              {/* STATUS SCREENS */}
              {showValidationMessage ? (
                <div className="text-center py-4 space-y-5">

                  {/* OTP required */}
                  {paymentStatus === "pending" && otpRequired && (
                    <>
                      <div className="relative flex items-center justify-center py-2">
                        <div className="absolute w-20 h-20 rounded-full bg-amber-500/10 animate-pulse" />
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-amber-200 shadow-lg flex items-center justify-center relative z-10">
                          {selectedOperator && getOperatorLogo(selectedOperator.name) ? (
                            <img src={getOperatorLogo(selectedOperator.name)!} alt={selectedOperator.name} className="w-full h-full object-cover" />
                          ) : (
                            <Phone className="w-7 h-7 text-amber-500" />
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{t.deposit.otpRequired}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {otpType === "ussd" && otpUssdCode ? t.deposit.otpUssd : t.deposit.otpSms}
                        </p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
                        <p className="text-xl font-bold text-amber-500 tabular-nums">
                          {watchedAmount ? formatCurrency(parseFloat(watchedAmount), (user?.preferredCurrency || "XAF") as SupportedCurrency) : "—"}
                        </p>
                        {selectedOperator && <p className="text-xs text-muted-foreground mt-0.5">via {selectedOperator.name}</p>}
                      </div>
                      {otpType === "ussd" && otpUssdCode && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl px-5 py-3 inline-block mx-auto">
                          <p className="text-2xl font-mono font-bold tracking-widest text-amber-700 dark:text-amber-300" data-testid="text-ussd-code">{otpUssdCode}</p>
                        </div>
                      )}
                      <div className="space-y-3 w-full max-w-xs mx-auto">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={8}
                          placeholder="Ex : 123456"
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          className="text-center text-2xl font-mono tracking-widest h-14"
                          data-testid="input-otp-code"
                          autoFocus
                        />
                        <Button className="w-full" size="lg" onClick={() => otpMutation.mutate()} disabled={otpCode.length < 4 || otpMutation.isPending} data-testid="button-confirm-otp">
                          {otpMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.deposit.otpValidating}</> : t.deposit.otpConfirm}
                        </Button>
                      </div>
                      <CountdownBar countdown={countdown} max={8 * 60} color="amber" label={t.deposit.expiration} />
                      <RefBadge ref_={depositReference} onCopy={copyRef} label={t.deposit.reference} />
                    </>
                  )}

                  {/* Wave redirect */}
                  {paymentStatus === "pending" && !otpRequired && waveUrl && (
                    <>
                      <div className="relative flex items-center justify-center py-2">
                        <div className="absolute w-20 h-20 rounded-full bg-blue-500/10 animate-pulse" />
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-blue-200 shadow-lg flex items-center justify-center relative z-10">
                          <img src="https://wave.com/favicon.ico" alt="Wave" className="w-10 h-10 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{t.deposit.waveTitle}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{t.deposit.waveDesc}</p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-center">
                        <p className="text-xl font-bold text-blue-500 tabular-nums">
                          {watchedAmount ? formatCurrency(parseFloat(watchedAmount), (user?.preferredCurrency || "XAF") as SupportedCurrency) : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">via Wave</p>
                      </div>
                      <a href={waveUrl} target="_blank" rel="noopener noreferrer" data-testid="button-open-wave">
                        <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 w-full">
                          <ExternalLink className="w-4 h-4" />
                          {t.deposit.waveButton}
                        </Button>
                      </a>
                      <CountdownBar countdown={countdown} max={8 * 60} color="blue" label={t.deposit.expiration} />
                      <RefBadge ref_={depositReference} onCopy={copyRef} label={t.deposit.reference} />
                      <Button variant="outline" size="sm" onClick={handleCancelDeposit} disabled={isCancelling} data-testid="button-cancel-deposit-wave" className="border-red-500/30 text-red-500 hover:bg-red-500/10">
                        <XCircle className="w-4 h-4 mr-2" />{t.deposit.cancelPayment}
                      </Button>
                    </>
                  )}

                  {/* Pending (push notification) */}
                  {paymentStatus === "pending" && !otpRequired && !waveUrl && (
                    <>
                      <div className="relative flex items-center justify-center py-2">
                        <div className="absolute w-20 h-20 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-border shadow-lg flex items-center justify-center relative z-10">
                          {selectedOperator && getOperatorLogo(selectedOperator.name) ? (
                            <img src={getOperatorLogo(selectedOperator.name)!} alt={selectedOperator.name} className="w-full h-full object-cover" />
                          ) : (
                            <Smartphone className="w-7 h-7 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{t.deposit.processingTitle}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{t.deposit.processingDesc}</p>
                      </div>
                      <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 text-center">
                        <p className="text-xl font-bold text-primary tabular-nums">
                          {watchedAmount ? formatCurrency(parseFloat(watchedAmount), (user?.preferredCurrency || "XAF") as SupportedCurrency) : "—"}
                        </p>
                        {selectedOperator && <p className="text-xs text-muted-foreground mt-0.5">via {selectedOperator.name}</p>}
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        {[0, 150, 300].map((delay) => (
                          <span key={delay} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                        ))}
                      </div>
                      <CountdownBar countdown={countdown} max={8 * 60} color="primary" label={t.deposit.expiration} />
                      <RefBadge ref_={depositReference} onCopy={copyRef} label={t.deposit.reference} />
                      <Button variant="outline" size="sm" onClick={handleCancelDeposit} disabled={isCancelling} data-testid="button-cancel-deposit" className="border-red-500/30 text-red-500 hover:bg-red-500/10">
                        <XCircle className="w-4 h-4 mr-2" />{t.deposit.cancelPayment}
                      </Button>
                    </>
                  )}

                  {/* Success */}
                  {paymentStatus === "success" && (
                    <>
                      <div className="relative flex items-center justify-center py-4">
                        <div className="absolute w-28 h-28 rounded-full bg-green-500/10 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center relative z-10">
                          <CheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{t.deposit.successTitle}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{t.deposit.successDesc}</p>
                      </div>
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-4 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{t.deposit.amountReceived}</p>
                        <p className="text-3xl font-bold text-green-500 tabular-nums">
                          {watchedAmount ? formatCurrency(parseFloat(watchedAmount), (user?.preferredCurrency || "XAF") as SupportedCurrency) : "—"}
                        </p>
                      </div>
                      <RefBadge ref_={depositReference} onCopy={copyRef} label={t.deposit.txRef} />
                      <Button size="lg" className="w-full" onClick={resetWizard} data-testid="button-new-deposit">
                        {t.deposit.newDeposit}
                      </Button>
                    </>
                  )}

                  {/* Failed */}
                  {paymentStatus === "failed" && (
                    <>
                      <div className="relative flex items-center justify-center py-4">
                        <div className="absolute w-24 h-24 rounded-full bg-red-500/10" />
                        <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center relative z-10">
                          <XCircle className="w-10 h-10 text-red-500" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{t.deposit.failedTitle}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{failureReason || t.deposit.failedDesc}</p>
                      </div>
                      <RefBadge ref_={depositReference} onCopy={copyRef} label={t.deposit.txRef} />
                      <Button size="lg" className="w-full" onClick={() => { setShowValidationMessage(false); setPaymentStatus("pending"); setDepositReference(""); }} data-testid="button-retry-deposit">
                        {t.deposit.retry}
                      </Button>
                    </>
                  )}
                </div>

              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 animate-in fade-in duration-300">

                    {/* Amount */}
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative flex flex-col items-center">
                              <div className="flex items-center justify-center gap-2 w-full border-b-2 border-primary/30 focus-within:border-primary pb-2 transition-colors">
                                <span className="text-2xl font-semibold text-muted-foreground shrink-0">
                                  {selectedCountry?.currency || user?.preferredCurrency || "XAF"}
                                </span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0"
                                  className="text-5xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30 text-center w-full min-w-0"
                                  {...field}
                                  data-testid="input-deposit-amount"
                                />
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage className="text-center" />
                        </FormItem>
                      )}
                    />

                    {/* Quick amount chips */}
                    <div className="flex flex-wrap justify-center gap-2">
                      {QUICK_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => form.setValue("amount", amt.toString())}
                          className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                            amountNum === amt
                              ? "border-primary bg-primary text-black"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                        >
                          {amt >= 1000 ? `${amt / 1000}K` : amt}
                        </button>
                      ))}
                    </div>

                    {/* Country */}
                    <FormField
                      control={form.control}
                      name="countryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.deposit.chooseCountry}</FormLabel>
                          <Select onValueChange={(val) => { field.onChange(val); form.setValue("operatorId", ""); }} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-country" className="h-14 rounded-xl">
                                {selectedCountry ? (
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xl shrink-0">
                                      {getCountryFlagEmoji(selectedCountry.code)}
                                    </span>
                                    <span className="font-semibold truncate">{selectedCountry.name}</span>
                                    <span className="text-muted-foreground text-sm shrink-0">({selectedCountry.currency})</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">{t.deposit.selectCountry}</span>
                                )}
                              </SelectTrigger>
                            </FormControl>
                            <SearchableSelectContent
                              options={countries.map(c => ({
                                value: c.id,
                                label: c.name,
                                flag: getCountryFlagEmoji(c.code),
                                sub: c.currency,
                              }))}
                            />
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Operator */}
                    <FormField
                      control={form.control}
                      name="operatorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.deposit.operatorMobileLabel}</FormLabel>
                          {!selectedCountry ? (
                            <p className="text-sm text-muted-foreground py-2">{t.deposit.noCountrySelected}</p>
                          ) : selectedCountry.operators.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">{t.deposit.noOperator}</p>
                          ) : (
                            <div className="w-full overflow-hidden">
                              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                                {selectedCountry.operators.map((op) => {
                                  const logo = getOperatorLogo(op.name);
                                  const isSelected = field.value === op.id;
                                  return (
                                    <button
                                      key={op.id}
                                      type="button"
                                      data-testid={`button-operator-${op.id}`}
                                      onClick={() => field.onChange(op.id)}
                                      className={`flex-shrink-0 flex flex-col items-center justify-center gap-2 w-28 h-24 rounded-2xl border-2 transition-all cursor-pointer ${
                                        isSelected
                                          ? "border-primary bg-primary/10 shadow-md"
                                          : "border-border bg-card/50 hover:border-primary/40 hover:bg-muted/30"
                                      }`}
                                    >
                                      {logo
                                        ? <img src={logo} alt={op.name} className="w-12 h-12 object-contain rounded-xl" />
                                        : <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><Smartphone className="w-6 h-6 text-primary" /></div>
                                      }
                                      <span className={`text-xs font-semibold text-center leading-tight px-1 ${isSelected ? "text-primary" : "text-foreground"}`}>{op.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Phone number */}
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.deposit.phoneMobileLabel}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                placeholder="XXX XXX XXX"
                                className="pl-11 h-12 rounded-xl text-base"
                                inputMode="tel"
                                {...field}
                                data-testid="input-phone-number"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isPixPayOtp && (
                      <div className="rounded-xl border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/30 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 font-semibold text-sm">
                          <Hash className="h-4 w-4 shrink-0" />{t.deposit.otpOrangeLabel}
                        </div>
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          Composez <code className="font-mono bg-orange-200 dark:bg-orange-900 px-1 rounded font-bold">{selectedOperator?.otpUssdCode || "#144*82#"}</code> {t.deposit.otpOrangeInstruction}
                        </p>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={8}
                          placeholder={t.deposit.otpPlaceholder}
                          value={pixpayOtpCode}
                          onChange={e => setPixpayOtpCode(e.target.value.replace(/\D/g, ""))}
                          className="text-center text-xl font-mono tracking-widest h-12 border-orange-300 rounded-xl"
                          data-testid="input-pixpay-otp"
                        />
                      </div>
                    )}

                    {/* Fee breakdown */}
                    {feeCalculation && (
                      <div className="rounded-xl border border-border bg-muted/30 overflow-hidden" data-testid="fee-calculator">
                        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                          <span className="text-sm text-muted-foreground">{t.deposit.amountEntered}</span>
                          <span className="text-sm font-semibold tabular-nums">
                            {formatCurrency(feeCalculation.amount.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency)}
                          </span>
                        </div>
                        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5" />
                            {t.deposit.depositFeeLabel} {feeCalculation.feePercentage > 0 ? `(${feeCalculation.feePercentage}%)` : feeCalculation.fixedFee > 0 ? t.deposit.feeFixed : t.deposit.feeFree}
                          </span>
                          <span className={`text-sm font-semibold tabular-nums ${feeCalculation.fee > 0 ? "text-red-500" : "text-green-500"}`}>
                            {feeCalculation.fee > 0 ? `-${formatCurrency(feeCalculation.fee.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency)}` : "Gratuit"}
                          </span>
                        </div>
                        <div className="px-4 py-3 flex items-center justify-between bg-green-500/5">
                          <span className="text-sm font-semibold text-foreground">{t.deposit.creditedLabel}</span>
                          <span className="text-lg font-bold text-green-500 tabular-nums" data-testid="credited-amount">
                            {formatCurrency(feeCalculation.creditedAmount.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency)}
                          </span>
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-12 rounded-xl font-bold"
                      size="lg"
                      disabled={!canSubmit || depositMutation.isPending || (isPixPayOtp && pixpayOtpCode.length < 4)}
                      data-testid="button-deposit-confirm"
                    >
                      {depositMutation.isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t.deposit.processing}</>
                        : <><CreditCard className="w-4 h-4 mr-2" />{t.deposit.confirmBtn}</>
                      }
                    </Button>
                  </form>
                </Form>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Confirm bottom sheet */}
      <BottomSheet open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="text-center text-lg">{t.deposit.confirmTitle}</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border my-2">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.deposit.dialogPhone}</span>
              <span className="text-sm font-medium">{pendingDepositData?.phoneNumber}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.deposit.confirmCountry}</span>
              <span className="text-sm font-medium">{selectedCountry?.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.deposit.confirmOperator}</span>
              <span className="text-sm font-medium">{selectedOperator?.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-muted-foreground">{t.deposit.amountEntered}</span>
              <span className="text-sm font-semibold tabular-nums">
                {feeCalculation ? formatCurrency(feeCalculation.amount.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency) : "—"}
              </span>
            </div>
            {feeCalculation && feeCalculation.fee > 0 && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-muted-foreground">
                  {t.deposit.confirmFee} {feeCalculation.feePercentage > 0 ? `(${feeCalculation.feePercentage}%)` : t.deposit.feeFixed}
                </span>
                <span className="text-sm font-semibold text-red-500 tabular-nums">
                  -{formatCurrency(feeCalculation.fee.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3.5 bg-green-500/5">
              <span className="text-sm font-semibold text-foreground">{t.deposit.creditedLabel}</span>
              <span className="text-base font-bold text-green-500 tabular-nums">
                {feeCalculation ? formatCurrency(feeCalculation.creditedAmount.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency) : "—"}
              </span>
            </div>
          </div>
          <BottomSheetFooter>
            <Button variant="outline" className="flex-1" onClick={() => setShowConfirmDialog(false)}>{t.deposit.back}</Button>
            <Button className="flex-1 font-bold" onClick={handleConfirmDeposit} disabled={depositMutation.isPending} data-testid="button-final-confirm-deposit">
              {depositMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
              {t.deposit.confirmBtn}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </DashboardLayout>
  );
}

function CountdownBar({ countdown, max, color, label }: { countdown: number; max: number; color: string; label: string }) {
  const colorMap: Record<string, string> = {
    amber: "bg-amber-500",
    blue: "bg-blue-500",
    primary: "bg-primary",
  };
  const pct = (countdown / max) * 100;
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" /> {label}
        </span>
        <span className="font-mono font-semibold tabular-nums text-foreground">
          {mins}:{secs.toString().padStart(2, "0")}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${colorMap[color] || "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RefBadge({ ref_, onCopy, label }: { ref_: string; onCopy: () => void; label: string }) {
  if (!ref_) return null;
  return (
    <div className="w-full bg-muted/40 rounded-xl p-3 text-left">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-bold text-foreground truncate">{ref_}</p>
        <button onClick={onCopy} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" data-testid="button-copy-reference">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
