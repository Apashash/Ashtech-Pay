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
import { CreditCard, Loader2, AlertCircle, Phone, CheckCircle, XCircle, Smartphone, ExternalLink, Hash, Clock, Copy, TrendingDown, Bitcoin, DollarSign, Hourglass } from "lucide-react";
import { SearchableSelectContent } from "@/components/ui/searchable-select-content";
import { useLanguage } from "@/lib/language";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import { getOperatorLogo } from "@/lib/operator-logos";
import { z } from "zod";
import { useState, useEffect, useMemo, useRef } from "react";
import { formatCurrency } from "@/lib/currency";
import { getCountryFlagEmoji } from "@/lib/country-flags";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CoinSelect } from "@/components/ui/coin-select";
import { cryptoQrPayload } from "@/lib/crypto-qr";
import { formatCryptoAmount, minimumCryptoAmount } from "@/lib/crypto-minimum";

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

// ── Dynamic IziChange crypto-asset list ────────────────────────────────────────
import { useIziAssets, coinLogoUrl, networkLogoUrl } from "@/lib/use-crypto-assets";
import { useCoinPrice } from "@/lib/use-coin-price";

const CRYPTO_COUNTDOWN_SECONDS = 35;

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
  // ── Crypto / WaaS state ──────────────────────────────────────────────────
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [cryptoRef, setCryptoRef] = useState("");
  const [cryptoCoin, setCryptoCoin] = useState("USDT");
  const [cryptoNetwork, setCryptoNetwork] = useState("TRC20");
  const [cryptoNetworkTouched, setCryptoNetworkTouched] = useState(false);
  const [refundAddress, setRefundAddress] = useState("");
  const [showRefundField, setShowRefundField] = useState(false);
  const [cryptoStep, setCryptoStep] = useState<"form" | "ready" | "waiting">("form");
  const [cryptoAddr, setCryptoAddr] = useState("");
  const [cryptoMemo, setCryptoMemo] = useState<string | null>(null);
  const [cryptoMemoType, setCryptoMemoType] = useState<string | null>(null);
  const [cryptoShared, setCryptoShared] = useState(false);
  const [cryptoAssetCode, setCryptoAssetCode] = useState("");
  const [cryptoFeeBreakdown, setCryptoFeeBreakdown] = useState<{
    providerFeePercent: number;
    providerFeeAmountUsdt: number;
    ashtechFeePercent: number;
    ashtechFeeAmountUsdt: number;
    totalFeePercent: number;
    totalFeeAmountUsdt: number;
    creditedAmountUsdt: number;
  } | null>(null);
  const [cryptoCountdown, setCryptoCountdown] = useState(CRYPTO_COUNTDOWN_SECONDS);
  const cryptoCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const [cryptoReadyCountdown, setCryptoReadyCountdown] = useState(CRYPTO_COUNTDOWN_SECONDS);
  const cryptoReadyCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic IziChange asset list (falls back to static if API not configured)
  const { coins: cryptoCoinList, isLoading: cryptoAssetsLoading } = useIziAssets();
  const { priceUsd: cryptoCoinPrice, isLoading: coinPriceLoading } = useCoinPrice(cryptoCoin);
  const cryptoNetworks = cryptoCoinList[cryptoCoin]?.networks ?? [];
  const defaultCryptoNetwork = cryptoCoin === "USDT" && cryptoNetworks.some(net => net.id === "TRC20")
    ? "TRC20"
    : (cryptoNetworks[0]?.id ?? "TRC20");
  const displayedCryptoNetwork = !cryptoNetworkTouched
    ? defaultCryptoNetwork
    : (cryptoNetworks.some(net => net.id === cryptoNetwork) ? cryptoNetwork : defaultCryptoNetwork);

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

  const generateCryptoAddressMutation = useMutation({
    mutationFn: async () => {
      const net = cryptoCoinList[cryptoCoin]?.networks.find(n => n.id === displayedCryptoNetwork);
      if (!net) throw new Error("Réseau invalide");
      const amt = parseFloat(cryptoAmount);
      if (!amt || amt <= 0) throw new Error("Entrez un montant valide");
      if (cryptoCoinPrice <= 0) throw new Error("Prix du coin introuvable, veuillez patienter…");
      const usdtEquiv = (amt * cryptoCoinPrice).toFixed(4);
      if (parseFloat(usdtEquiv) < 1) {
        throw new Error(`Le montant minimum est de ${formatCryptoAmount(minimumCryptoAmount(cryptoCoinPrice))} ${cryptoCoin} (soit 1 USDT).`);
      }
      const res = await apiRequest("POST", "/api/deposits/crypto/address", {
        assetCode: net.assetCode,
        amount: usdtEquiv,
        currency: "USDT",
        ...(refundAddress ? { refundAddress } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur lors de la génération");
      if (net.memoRequired && !data.memo) {
        throw new Error(`Le réseau ${net.label} exige un memo/tag, mais le fournisseur n'en a pas retourné.`);
      }
      return data;
    },
    onSuccess: (data) => {
      setCryptoAddr(data.address);
      setCryptoMemo(data.memo ?? null);
      setCryptoMemoType(data.memoType ?? null);
      setCryptoShared(data.shared ?? false);
      setCryptoAssetCode(data.assetCode);
      setCryptoRef(data.reference || "");
      setCryptoFeeBreakdown(data.providerFeeAmountUsdt != null ? {
        providerFeePercent: Number(data.providerFeePercent || 0),
        providerFeeAmountUsdt: Number(data.providerFeeAmountUsdt || 0),
        ashtechFeePercent: Number(data.ashtechFeePercent || 0),
        ashtechFeeAmountUsdt: Number(data.ashtechFeeAmountUsdt || 0),
        totalFeePercent: Number(data.totalFeePercent || 0),
        totalFeeAmountUsdt: Number(data.totalFeeAmountUsdt || 0),
        creditedAmountUsdt: Number(data.creditedAmountUsdt || 0),
      } : null);
      setCryptoStep("ready");
      // Keep the crypto UI countdown short and consistent with the payment page.
      // The server-side 15-minute pending timeout is independent of this timer.
      setCryptoReadyCountdown(CRYPTO_COUNTDOWN_SECONDS);
      if (cryptoReadyCountdownRef.current) clearInterval(cryptoReadyCountdownRef.current);
      cryptoReadyCountdownRef.current = setInterval(() => {
        setCryptoReadyCountdown(prev => {
          if (prev <= 1) { clearInterval(cryptoReadyCountdownRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (cryptoCountdownRef.current) clearInterval(cryptoCountdownRef.current);
      if (cryptoReadyCountdownRef.current) clearInterval(cryptoReadyCountdownRef.current);
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

  // Keep the selected coin and network valid when admin filtering changes the catalogue.
  useEffect(() => {
    const availableCoins = Object.keys(cryptoCoinList);
    if (!availableCoins.length) return;
    const activeCoin = cryptoCoinList[cryptoCoin] ? cryptoCoin : availableCoins[0];
    if (activeCoin !== cryptoCoin) setCryptoCoin(activeCoin);
    const nets = cryptoCoinList[activeCoin]?.networks ?? [];
    if (nets.length && !nets.some(net => net.id === cryptoNetwork)) {
      const preferredNetwork = nets.some(net => net.id === "TRC20")
        ? "TRC20"
        : nets[0].id;
      setCryptoNetwork(preferredNetwork);
    }
  }, [cryptoCoinList, cryptoCoin, cryptoNetwork, cryptoNetworkTouched]);

  const usdtWallet = wallets?.find(w => w.currency === "USDT");

  const { data: feeSettings } = useQuery<{ cryptoFeePercent: number }>({
    queryKey: ["/api/public/fee-settings", watchedCountryId],
    queryFn: async () => {
      const suffix = watchedCountryId ? `?country=${encodeURIComponent(watchedCountryId)}` : "";
      const response = await fetch(`/api/public/fee-settings${suffix}`);
      if (!response.ok) throw new Error("Impossible de charger les frais crypto");
      return response.json();
    },
  });
  const cryptoFeePercent = feeSettings?.cryptoFeePercent ?? 2.5;
  const cryptoProviderFeePercent = (feeSettings as any)?.cryptoProviderFeePercent ?? 0;
  const cryptoAshtechFeePercent = (feeSettings as any)?.cryptoAshtechFeePercent ?? (cryptoFeePercent - cryptoProviderFeePercent);

  const cryptoAmtNum = parseFloat(cryptoAmount) || 0; // amount in selected coin
  const cryptoUsdtEquiv = cryptoCoinPrice > 0 ? cryptoAmtNum * cryptoCoinPrice : 0; // USDT value
  const cryptoMinimumAmount = minimumCryptoAmount(cryptoCoinPrice);
  const cryptoFee = (cryptoUsdtEquiv * cryptoFeePercent) / 100;
  const cryptoNet = cryptoUsdtEquiv - cryptoFee;
  const hasCryptoAssets = Object.keys(cryptoCoinList).length > 0;

  const userCurrency = (user?.preferredCurrency || "XOF") as SupportedCurrency;

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
          {cryptoAssetsLoading || hasCryptoAssets ? <button
            type="button"
            onClick={() => {
              setDepositMode("crypto");
              setCryptoCoin("USDT");
              setCryptoNetwork("TRC20");
              setCryptoNetworkTouched(false);
              setCryptoAssetCode("USDT.TRC20");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${depositMode === "crypto" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-crypto"
          >
            <Bitcoin className="w-4 h-4" />
            Crypto (USDT)
          </button> : null}
        </div>

        {/* ── Crypto deposit section ────────────────────────────────────────── */}
        {depositMode === "crypto" && hasCryptoAssets ? (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 pb-6 pt-4 space-y-5">

              {/* ── STEP: waiting for blockchain confirmation ── */}
              {cryptoStep === "waiting" ? (
                <div className="text-center py-6 space-y-5">

                  {/* Icon animé */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-24 h-24 rounded-full bg-amber-500/10 animate-ping" style={{ animationDuration: "2s" }} />
                    <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center relative z-10">
                      <Clock className="w-7 h-7 text-amber-500" />
                    </div>
                  </div>

                  {/* Titre */}
                  <div>
                    <h3 className="text-lg font-bold text-foreground">En attente de confirmation</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Surveillance automatique de la blockchain en cours…
                    </p>
                  </div>

                  {/* Montant */}
                  {cryptoAmtNum > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">Montant envoyé</p>
                      <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {cryptoAmtNum.toFixed(cryptoAmtNum < 1 ? 6 : 4)} {cryptoCoin}
                      </p>
                      {cryptoCoin !== "USDT" && cryptoUsdtEquiv > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">≈ {cryptoUsdtEquiv.toFixed(2)} USDT</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{cryptoAssetCode}</p>
                    </div>
                  )}

                  {/* Étapes */}
                  <div className="w-full space-y-2 text-left">
                    {/* Étape 1 — Envoyé */}
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Fonds envoyés</span>
                    </div>
                    {/* Connecteur */}
                    <div className="ml-3.5 w-px h-4 bg-border" />
                    {/* Étape 2 — Confirmation blockchain */}
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
                        <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground">Confirmation blockchain</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {[0, 150, 300].map((d) => (
                            <span key={d} className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Connecteur */}
                    <div className="ml-3.5 w-px h-4 bg-border" />
                    {/* Étape 3 — Créditement */}
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-muted-foreground">3</span>
                      </div>
                      <span className="text-sm text-muted-foreground">Créditement automatique</span>
                    </div>
                  </div>

                  {/* Barre de progression */}
                  <CountdownBar
                    countdown={cryptoCountdown}
                    max={CRYPTO_COUNTDOWN_SECONDS}
                    color="amber"
                    label="Temps de surveillance estimé"
                  />

                  {/* Référence */}
                  {cryptoRef && (
                    <div className="bg-muted/40 rounded-xl p-3 text-left w-full">
                      <p className="text-xs text-muted-foreground mb-0.5">Référence</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs font-bold text-foreground truncate flex-1">{cryptoRef}</p>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(cryptoRef); toast({ title: "Référence copiée" }); }}
                          className="shrink-0 p-1 rounded hover:bg-muted"
                        ><Copy className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (cryptoCountdownRef.current) clearInterval(cryptoCountdownRef.current);
                      setCryptoStep("form");
                      setCryptoAmount("");
                      setCryptoAddr("");
                      setCryptoMemo(null);
                      setCryptoRef("");
                      setRefundAddress("");
                    }}
                  >
                    Nouveau dépôt
                  </Button>
                </div>

              /* ── STEP: address ready, show QR ── */
              ) : cryptoStep === "ready" ? (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bitcoin className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{cryptoAssetCode}</p>
                      <p className="text-xs text-muted-foreground">Envoyez exactement le montant en crypto ci-dessous</p>
                    </div>
                  </div>

                  {/* QR code */}
                  <div className="flex justify-center">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-border">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(cryptoQrPayload(cryptoAssetCode, cryptoAddr, cryptoMemo, cryptoMemoType))}&bgcolor=ffffff&color=000000&margin=1`}
                        alt="QR code adresse"
                        width={180}
                        height={180}
                        className="rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adresse de dépôt</p>
                    <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5 border border-border">
                      <p className="font-mono text-xs font-bold text-foreground break-all flex-1">{cryptoAddr}</p>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(cryptoAddr); toast({ title: "Adresse copiée !" }); }}
                        className="shrink-0 p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                        title="Copier l'adresse"
                      >
                        <Copy className="w-4 h-4 text-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Memo/Tag (for XRP, TON, etc.) */}
                  {cryptoMemo && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        ⚠️ {cryptoMemoType === "tag" ? "Tag de destination" : "Mémo"} obligatoire
                      </p>
                      <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5">
                        <p className="font-mono text-sm font-bold text-amber-700 dark:text-amber-300 flex-1">{cryptoMemo}</p>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(cryptoMemo!); toast({ title: "Mémo copié !" }); }}
                          className="shrink-0 p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 transition-colors"
                        >
                          <Copy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </button>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Sans ce mémo, vos fonds seront perdus définitivement.
                      </p>
                    </div>
                  )}

                  {/* Amount reminder */}
                  {cryptoAmtNum > 0 && (
                    <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-1.5">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-muted-foreground">Envoyez exactement</span>
                        <span className="text-foreground">{cryptoAmtNum.toFixed(cryptoAmtNum < 1 ? 6 : 4)} {cryptoCoin}</span>
                      </div>
                      {cryptoCoin !== "USDT" && cryptoUsdtEquiv > 0 && (
                        <p className="text-xs text-muted-foreground text-right">≈ {cryptoUsdtEquiv.toFixed(2)} USDT</p>
                      )}
                      <div className="flex justify-between text-xs font-semibold text-muted-foreground border-t border-border pt-1.5">
                        <span>Total des frais ({cryptoFeeBreakdown?.totalFeePercent ?? cryptoFeePercent}%)</span>
                        <span className="text-red-500">-{(cryptoFeeBreakdown?.totalFeeAmountUsdt ?? cryptoFee).toFixed(4)} USDT</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border pt-1.5">
                        <span className="text-muted-foreground font-medium">Montant net crédité</span>
                        <span className="font-bold text-green-500">{(cryptoFeeBreakdown?.creditedAmountUsdt ?? cryptoNet).toFixed(4)} USDT</span>
                      </div>
                    </div>
                  )}

                  {/* ── Spinner TEMPS RESTANT ── */}
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-4">
                    {/* Ligne countdown */}
                    <div className="flex items-center gap-4">
                      {/* Arc spinner */}
                      <div className="relative flex items-center justify-center shrink-0">
                        <svg width="52" height="52" viewBox="0 0 52 52" className="absolute" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
                          <circle
                            cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 22}`}
                            strokeDashoffset={`${2 * Math.PI * 22 * (1 - (cryptoReadyCountdown % 60) / 60)}`}
                            className="text-teal-500 transition-all duration-1000"
                          />
                        </svg>
                        <div
                          className="w-[52px] h-[52px] rounded-full border-[3px] border-transparent border-t-teal-500 animate-spin"
                          style={{ animationDuration: "1.2s" }}
                        />
                      </div>
                      {/* Temps */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Temps restant</p>
                        <p className="text-2xl font-bold tabular-nums text-teal-500 leading-tight">
                          {String(Math.floor(cryptoReadyCountdown / 3600)).padStart(2, "0")}:
                          {String(Math.floor((cryptoReadyCountdown % 3600) / 60)).padStart(2, "0")}:
                          {String(cryptoReadyCountdown % 60).padStart(2, "0")}
                        </p>
                      </div>
                    </div>
                    {/* Ligne vérification */}
                    <div className="flex items-center gap-3 border-t border-border pt-3">
                      <Hourglass className="w-5 h-5 text-teal-500 shrink-0" />
                      <p className="text-sm text-foreground">Vérification de la transaction blockchain</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <Button
                    className="w-full h-12 rounded-xl font-bold"
                    onClick={() => {
                      if (cryptoReadyCountdownRef.current) clearInterval(cryptoReadyCountdownRef.current);
                      setCryptoStep("waiting");
                      setCryptoCountdown(CRYPTO_COUNTDOWN_SECONDS);
                      if (cryptoCountdownRef.current) clearInterval(cryptoCountdownRef.current);
                      cryptoCountdownRef.current = setInterval(() => {
                        setCryptoCountdown(prev => {
                          if (prev <= 1) { clearInterval(cryptoCountdownRef.current!); return 0; }
                          return prev - 1;
                        });
                      }, 1000);
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    J'ai envoyé les fonds
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
                    onClick={() => {
                      if (cryptoReadyCountdownRef.current) clearInterval(cryptoReadyCountdownRef.current);
                      setCryptoStep("form");
                    }}
                  >
                    ← Modifier
                  </button>
                </div>

              /* ── STEP: form ── */
              ) : (
                <>
                  {/* ── Crypto selector dropdown ── */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cryptomonnaie</p>
                    <CoinSelect
                      value={cryptoCoin}
                      onChange={v => {
                        setCryptoCoin(v as any);
                        setCryptoNetworkTouched(false);
                      }}
                      coinList={cryptoCoinList}
                      coinLogoUrl={coinLogoUrl}
                    />
                  </div>

                  {/* ── Network selector dropdown ── */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Réseau</p>
                    <div className="relative">
                      <select
                        value={displayedCryptoNetwork}
                        onChange={e => {
                          setCryptoNetwork(e.target.value);
                          setCryptoNetworkTouched(true);
                        }}
                        className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
                      >
                        {(cryptoCoinList[cryptoCoin]?.networks ?? []).map(net => (
                          <option key={net.id} value={net.id}>{net.label}</option>
                        ))}
                      </select>
                      {/* network chain logo overlay */}
                      <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                        <img
                          src={networkLogoUrl(displayedCryptoNetwork)}
                          alt={displayedCryptoNetwork}
                          className="w-6 h-6 object-contain"
                          onLoad={(e) => { (e.target as HTMLImageElement).style.display = ""; }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">▼</div>
                    </div>
                    {/* Warning for memo chains */}
                    {cryptoCoinList[cryptoCoin]?.networks.find(n => n.id === displayedCryptoNetwork)?.memoRequired && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ Ce réseau nécessite un mémo/tag — il sera affiché avec l'adresse.
                      </p>
                    )}
                  </div>

                  {/* ── Amount in selected coin ── */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Montant ({cryptoCoin})
                    </label>
                    <div className="flex rounded-xl border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
                      <span className="flex items-center px-3 bg-muted border-r border-border text-sm font-bold text-muted-foreground shrink-0">
                        {cryptoCoin}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={cryptoMinimumAmount || 0}
                        step="any"
                        placeholder={cryptoMinimumAmount ? formatCryptoAmount(cryptoMinimumAmount) : "0.00"}
                        value={cryptoAmount}
                        onChange={e => setCryptoAmount(e.target.value)}
                        className="flex-1 min-w-0 px-4 h-12 bg-background text-base font-semibold focus:outline-none"
                        data-testid="input-crypto-amount"
                      />
                    </div>
                    {/* USDT equivalent estimate */}
                    {cryptoAmtNum > 0 && cryptoUsdtEquiv > 0 && (
                      <p className="text-xs text-muted-foreground px-1">
                        ≈ <span className="font-semibold text-foreground">{cryptoUsdtEquiv.toFixed(2)} USDT</span>
                        {coinPriceLoading && <span className="ml-1 opacity-60">(chargement…)</span>}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground px-1">
                      Minimum : <span className="font-semibold text-foreground">
                        {cryptoMinimumAmount ? `${formatCryptoAmount(cryptoMinimumAmount)} ${cryptoCoin}` : "1 USDT"}
                      </span> (soit 1 USDT, avant frais)
                    </p>
                    {/* Quick-select presets (expressed as USDT equivalents, click sets coin amount) */}
                    <div className="flex gap-2 flex-wrap">
                      {["10", "50", "100", "250", "500"].map(v => {
                        const usdtVal = parseFloat(v);
                        const coinVal = cryptoCoinPrice > 0 ? usdtVal / cryptoCoinPrice : 0;
                        return (
                          <button
                            key={v}
                            type="button"
                            disabled={coinVal <= 0}
                            onClick={() => setCryptoAmount(coinVal < 1 ? coinVal.toFixed(6) : coinVal.toFixed(2))}
                            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 font-semibold transition-all disabled:opacity-40"
                          >
                            ~{v} USDT
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Fee summary (USDT) ── */}
                  {cryptoAmtNum > 0 && (
                    <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-muted-foreground border-t border-border pt-1.5">
                        <span>Total des frais ({cryptoFeePercent}%)</span>
                        <span className="font-semibold text-red-500">-{cryptoFee.toFixed(4)} USDT</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border pt-1.5">
                        <span className="text-muted-foreground font-medium">Montant net crédité</span>
                        <span className="font-bold text-green-500">{cryptoNet.toFixed(4)} USDT</span>
                      </div>
                    </div>
                  )}

                  {/* Refund address (collapsible) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowRefundField(v => !v)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      {showRefundField ? "▲" : "▼"} Adresse de remboursement (optionnel)
                    </button>
                    {showRefundField && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          En cas de problème, Ashtechpay utilisera cette adresse pour vous rembourser.
                        </p>
                        <input
                          type="text"
                          placeholder="0x... ou adresse crypto"
                          value={refundAddress}
                          onChange={e => setRefundAddress(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    )}
                  </div>

                  {/* Generate button */}
                  <Button
                    className="w-full h-12 rounded-xl font-bold"
                    size="lg"
                    disabled={!cryptoAmtNum || !cryptoMinimumAmount || cryptoUsdtEquiv < 1 || generateCryptoAddressMutation.isPending}
                    onClick={() => generateCryptoAddressMutation.mutate()}
                    data-testid="button-crypto-generate"
                  >
                    {generateCryptoAddressMutation.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Génération…</>
                      : <><Bitcoin className="w-4 h-4 mr-2" />Générer l'adresse de paiement</>
                    }
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : depositMode === "crypto" && !cryptoAssetsLoading ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aucun réseau crypto n’est actuellement disponible. Demandez à l’administrateur d’activer au moins un réseau.
            </AlertDescription>
          </Alert>
        ) : null}

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
                              options={(countries ?? []).map(c => ({
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
