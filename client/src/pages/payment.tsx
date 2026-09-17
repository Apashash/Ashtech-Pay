declare global { interface Window { IziPay?: { open: (opts: { url: string; container?: string; onSuccess?: () => void; onClose?: () => void; onError?: () => void; onExpired?: () => void }) => { close(): void; getIframe(): HTMLIFrameElement | null } } } }

import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelectContent } from "@/components/ui/searchable-select-content";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language";
import type { PaymentLink, SupportedCurrency } from "@shared/schema";
import { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } from "@shared/schema";
import { getImageSrc } from "@/lib/image";
import { 
  Loader2, CheckCircle, XCircle, Shield, 
  Smartphone, CreditCard, ExternalLink, FileText, AlertTriangle,
  User, Mail, Phone, Hash, Clock, Copy, Bitcoin, ChevronDown, Hourglass
} from "lucide-react";
import { getOperatorLogo } from "@/lib/operator-logos";
import { useState, useMemo, useEffect, useRef } from "react";
import { SiPaypal } from "react-icons/si";
import { useIziAssets, coinLogoUrl, networkLogoUrl } from "@/lib/use-crypto-assets";
import { cryptoQrPayload } from "@/lib/crypto-qr";
import { formatCryptoAmount, minimumCryptoAmount } from "@/lib/crypto-minimum";
import { useCoinPrice } from "@/lib/use-coin-price";
import { CoinSelect } from "@/components/ui/coin-select";
import { apiRequest } from "@/lib/queryClient";
import { normalizePaymentLinkRequestError, parsePaymentLinkJson } from "@/lib/payment-link-http";
import { getPawaPayPinInstructions } from "@/lib/pawapay-instructions";

const CRYPTO_COUNTDOWN_SECONDS = 5 * 60;
const PAYMENT_COUNTDOWN_SECONDS = 8 * 60;
// The server may perform one uncached active-conf lookup before the deposit
// request, and PawaPay can take longer while handing an automatic PIN prompt
// to the operator. Do not let Safari abort an initiation that was already
// accepted and is pending provider confirmation.
const PAYMENT_REQUEST_TIMEOUT_MS = 90_000;

const CURRENCY_FLAGS: Record<string, string> = {
  "XAF": "🇨🇲", "XOF": "🇸🇳", "CDF": "🇨🇩",
  "RWF": "🇷🇼",
  "TZS": "🇹🇿", "UGX": "🇺🇬", "INR": "🇮🇳", "USD": "🇺🇸",
};

interface CountryConfig {
  id: string;
  name: string;
  code: string;
  flag: string;
  currency: string;
  exchangeRate: number;
  minDeposit: number;
  maxDeposit: number;
  operators: { id: string; name: string; gateway: string; paymentProvider: string; feePercentage: number; feeFixed: number; afribapayFee?: number; pixpayFee?: number; pawapayFee?: number; ashtechMargin?: number; pixpayOperatorType?: string; otpUssdCode?: string | null; }[];
}

interface DepositConfigResponse {
  countries: CountryConfig[];
  exchangeRates: Record<string, number>;
}

function formatAmount(amount: number, currency: string): string {
  const symbol = (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;
  const useDecimals = ["USD", "INR", "TZS", "UGX", "RWF", "CDF"].includes(currency);
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
  }).format(Math.round(amount));
  if (["USD", "INR"].includes(currency)) return `${symbol}${formatted}`;
  return `${formatted} ${symbol}`;
}

export default function PaymentPage() {
  const [, params] = useRoute("/pay/:slug");
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const p = t.payPage;
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cryptoFirstName, setCryptoFirstName] = useState("");
  const [cryptoLastName, setCryptoLastName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "card" | "paypal" | "crypto" | "">("");
  const [operator, setOperator] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency | "">("");
  
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "failed">("pending");
  const [failureReason, setFailureReason] = useState<string>("");
  const [countdown, setCountdown] = useState(PAYMENT_COUNTDOWN_SECONDS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const countdownDeadlineRef = useRef<number | null>(null);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpType, setOtpType] = useState<"api" | "ussd">("api");
  const [otpUssdCode, setOtpUssdCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [waveUrl, setWaveUrl] = useState<string | null>(null);
  const [pawaPayAuth, setPawaPayAuth] = useState<any | null>(null);
  const [pawaPayPreAuthCode, setPawaPayPreAuthCode] = useState("");
  const [pixpayOtpCode, setPixpayOtpCode] = useState("");
  const [pixpayOtpStep, setPixpayOtpStep] = useState(false);

  // WaaS crypto state for payment-link crypto flow
  const [payCryptoCoin, setPayCryptoCoin] = useState("USDT");
  const [payCryptoNetwork, setPayCryptoNetwork] = useState("TRC20");
  const [payCryptoNetworkTouched, setPayCryptoNetworkTouched] = useState(false);
  const [payCryptoStep, setPayCryptoStep] = useState<"form" | "ready">("form");
  const [payCryptoAddr, setPayCryptoAddr] = useState("");
  const [payCryptoMemo, setPayCryptoMemo] = useState<string | null>(null);
  const [payCryptoRef, setPayCryptoRef] = useState("");
  const [payCryptoAssetCode, setPayCryptoAssetCode] = useState("USDT.TRC20");
  const [payCryptoAmountUsdt, setPayCryptoAmountUsdt] = useState("");
  const [payCryptoFeeBreakdown, setPayCryptoFeeBreakdown] = useState<{
    providerFeePercent: number;
    providerFeeAmountUsdt: number;
    ashtechFeePercent: number;
    ashtechFeeAmountUsdt: number;
    totalFeePercent: number;
    totalFeeAmountUsdt: number;
    creditedAmountUsdt: number;
  } | null>(null);
  const [payCryptoAmount, setPayCryptoAmount] = useState("");
  const [payCryptoShared, setPayCryptoShared] = useState(false);
  const [payCryptoMemoType, setPayCryptoMemoType] = useState<"memo" | "tag">("memo");
  const [payCryptoRefundAddress, setPayCryptoRefundAddress] = useState("");
  const [showPayRefundField, setShowPayRefundField] = useState(false);
  const [payReadyCountdown, setPayReadyCountdown] = useState(CRYPTO_COUNTDOWN_SECONDS);
  const payReadyCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic IziChange asset list (falls back to static if API not configured)
  const { coins: payCoinList, isLoading: cryptoAssetsLoading } = useIziAssets();
  const { priceUsd: payCryptoCoinPrice } = useCoinPrice(payCryptoCoin);
  const hasCryptoAssets = Object.keys(payCoinList).length > 0;
  const payCryptoNetworks = payCoinList[payCryptoCoin]?.networks ?? [];
  const defaultPayCryptoNetwork = payCryptoCoin === "USDT" && payCryptoNetworks.some(net => net.id === "TRC20")
    ? "TRC20"
    : (payCryptoNetworks[0]?.id ?? "TRC20");
  const displayedPayCryptoNetwork = !payCryptoNetworkTouched
    ? defaultPayCryptoNetwork
    : (payCryptoNetworks.some(net => net.id === payCryptoNetwork) ? payCryptoNetwork : defaultPayCryptoNetwork);
  const payCryptoMinimumAmount = minimumCryptoAmount(payCryptoCoinPrice);
  const payCryptoUsdtEquivalent = parseFloat(payCryptoAmount) > 0 && payCryptoCoinPrice > 0
    ? parseFloat(payCryptoAmount) * payCryptoCoinPrice
    : 0;

  const { data: paymentLink, isLoading, error } = useQuery<PaymentLink & { hasPdf?: boolean }>({
    queryKey: ["/api/payment-links/public", params?.slug],
    queryFn: async () => {
      const res = await fetch(`/api/payment-links/public/${params?.slug}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const requestError = new Error(data.message || "Lien de paiement introuvable") as Error & {
          code?: string;
          status?: number;
        };
        requestError.code = data.code;
        requestError.status = res.status;
        throw requestError;
      }
      return data.link ?? data;
    },
    enabled: !!params?.slug,
  });

  const { data: depositConfigData } = useQuery<DepositConfigResponse>({
    queryKey: ["/api/public/deposit-config"],
  });


  const allCountries = depositConfigData?.countries || [];
  const adminExchangeRates = depositConfigData?.exchangeRates || { XAF: 1, XOF: 1 };

  const depositConfig = useMemo(() => {
    const allowed = (paymentLink as any)?.allowedCountries;
    if (!allowed || allowed.length === 0) return allCountries;
    // allowedCountries may contain internal IDs (dashboard) or ISO codes (API) — support both
    const allowedCodes = new Set(
      allowed.map((value: unknown) => String(value).toUpperCase()),
    );
    return allCountries.filter(c =>
      allowedCodes.has(c.id.toUpperCase()) ||
      allowedCodes.has(c.code.toUpperCase()),
    );
  }, [allCountries, paymentLink]);

  const linkCurrency = useMemo(() => (paymentLink?.currency as SupportedCurrency) || "XAF", [paymentLink]);

  const selectedCountryData = useMemo(() => depositConfig.find(c => c.id === country), [depositConfig, country]);
  const minDeposit = Number(selectedCountryData?.minDeposit ?? 100);
  const maxDeposit = Number(selectedCountryData?.maxDeposit ?? 5000000);

  // Auto-switch display currency to the selected country's currency
  useEffect(() => {
    if (selectedCountryData?.currency) {
      setDisplayCurrency(selectedCountryData.currency as SupportedCurrency);
    }
  }, [selectedCountryData]);

  const selectedDisplayCurrency = useMemo(() => displayCurrency || linkCurrency, [displayCurrency, linkCurrency]);

  const displayAmount = useMemo(() => {
    if (!paymentLink) return 0;
    if (paymentLink.isFixedAmount) return parseFloat(paymentLink.amount);
    return customAmount ? parseFloat(customAmount) : 0;
  }, [paymentLink, customAmount]);

  // exchangeRates[currency] = "XAF per 1 unit" (direct rate, e.g. CDF→0.2, USDT→620)
  // amountInXAF  = displayAmount * rate   (multiply to convert currency → XAF)
  // reverse      = amountInXAF  / rate    (divide  to convert XAF → currency)
  const amountInXAF = useMemo(() => {
    if (!paymentLink) return 0;
    if (paymentLink.isFixedAmount) {
      const linkRate = adminExchangeRates[linkCurrency] || 1;
      return displayAmount * linkRate;
    } else {
      const inputRate = adminExchangeRates[selectedDisplayCurrency] || 1;
      return displayAmount * inputRate;
    }
  }, [paymentLink, displayAmount, linkCurrency, selectedDisplayCurrency, adminExchangeRates]);

  const amountInCountryCurrency = useMemo(() => {
    if (!selectedCountryData || amountInXAF <= 0) return 0;
    const countryRate = adminExchangeRates[selectedCountryData.currency] || 1;
    return amountInXAF / countryRate;
  }, [selectedCountryData, amountInXAF, adminExchangeRates]);

  // Fixed payment links are converted to gross USDT by the server using the
  // admin USDT/XAF rate. Mirror that calculation here to warn before submit.
  const fixedCryptoAmountUsdt = paymentLink?.isFixedAmount
    ? amountInXAF / (adminExchangeRates.USDT || 585)
    : 0;

  const amountInLinkCurrency = useMemo(() => {
    if (paymentLink?.isFixedAmount) return displayAmount;
    const linkRate = adminExchangeRates[linkCurrency] || 1;
    return amountInXAF / linkRate;
  }, [paymentLink, displayAmount, amountInXAF, linkCurrency, adminExchangeRates]);

  const convertedDisplayAmount = useMemo(() => {
    if (selectedDisplayCurrency === linkCurrency) return displayAmount;
    const targetRate = adminExchangeRates[selectedDisplayCurrency] || 1;
    return amountInXAF / targetRate;
  }, [displayAmount, selectedDisplayCurrency, linkCurrency, amountInXAF, adminExchangeRates]);

  const operators = useMemo(() => selectedCountryData?.operators || [], [selectedCountryData]);
  const selectedOperatorData = useMemo(() => operators.find(o => o.id === operator), [operators, operator]);

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

  const redirectAfterPayment = (outcome: "success" | "failed", ref: string) => {
    const link: any = paymentLink;
    const target = outcome === "success" ? link?.successUrl : link?.cancelUrl;
    if (!target || typeof target !== "string") return;
    try {
      const url = new URL(target);
      url.searchParams.set("reference", ref);
      url.searchParams.set("status", outcome === "success" ? "success" : "failed");
      const finalUrl = url.toString();
      setTimeout(() => { window.location.href = finalUrl; }, 3000);
    } catch (_) {
      const sep = target.includes("?") ? "&" : "?";
      const finalUrl = `${target}${sep}reference=${encodeURIComponent(ref)}&status=${outcome === "success" ? "success" : "failed"}`;
      setTimeout(() => { window.location.href = finalUrl; }, 3000);
    }
  };

  const startPaymentCountdown = (reset = true) => {
    if (reset || countdownDeadlineRef.current === null) {
      countdownDeadlineRef.current = Date.now() + PAYMENT_COUNTDOWN_SECONDS * 1000;
    }
    if (countdownRef.current) clearInterval(countdownRef.current);
    const updateCountdown = () => {
      const deadline = countdownDeadlineRef.current;
      const remaining = deadline === null
        ? PAYMENT_COUNTDOWN_SECONDS
        : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining > 0) return;
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = null;
      if (pollingRef.current) clearInterval(pollingRef.current);
      setOtpRequired(false);
      setFailureReason("Le délai de confirmation OTP est expiré. Veuillez recommencer.");
      setPaymentStatus("failed");
    };
    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
  };

  const startPaymentPolling = (ref: string, resetCountdown = true) => {
    startPaymentCountdown(resetCountdown);

    if (pollingRef.current) clearInterval(pollingRef.current);
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/transactions/status/${ref}`);
        if (res.ok) {
          const statusData = await res.json();
          if (statusData.authorizationUrl && !waveUrl) {
            setWaveUrl(statusData.authorizationUrl);
            setPawaPayAuth((current: any) => current || {
              authType: statusData.authType || "REDIRECT_AUTH",
              nextStep: statusData.nextStep || undefined,
            });
          }
          if (statusData.status === "completed") {
            setPaymentStatus("success");
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pollingRef.current) clearInterval(pollingRef.current);
            redirectAfterPayment("success", ref);
          } else if (statusData.status === "failed") {
            const persistedFailure = statusData.failureReason?.failureMessage;
            setFailureReason(
              typeof persistedFailure === "string" && persistedFailure.trim()
                ? persistedFailure
                : parseFailureMessage(statusData.description) ||
                  statusData.description ||
                  "Le paiement n'a pas pu être confirmé. Veuillez réessayer.",
            );
            setPaymentStatus("failed");
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pollingRef.current) clearInterval(pollingRef.current);
            redirectAfterPayment("failed", ref);
          }
        }
      } catch (e) { console.error("Error checking payment status:", e); }
    };
    // Check the local transaction immediately. This removes the old five-second
    // blank interval and keeps the browser independent from the provider API.
    void checkStatus();
    pollingRef.current = setInterval(checkStatus, 5000);
  };

  const validatePaymentForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (paymentMethod !== "crypto" && !fullName.trim()) newErrors.fullName = p.errName;
    if (paymentMethod === "crypto" && !cryptoFirstName.trim()) newErrors.cryptoFirstName = "Le prénom est obligatoire.";
    if (paymentMethod === "crypto" && !cryptoLastName.trim()) newErrors.cryptoLastName = "Le nom est obligatoire.";
    if (paymentMethod === "crypto" && !email.trim()) newErrors.email = p.errEmail;
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = p.errEmailInvalid;
    if (!paymentLink?.isFixedAmount && (!customAmount || parseFloat(customAmount) <= 0)) newErrors.amount = p.errAmount;
    if (!paymentMethod) newErrors.paymentMethod = p.errPaymentMethod;
    if (!country) newErrors.country = p.errCountry;
    if (selectedCountryData && paymentMethod !== "crypto" &&
        (amountInCountryCurrency < minDeposit || amountInCountryCurrency > maxDeposit)) {
      newErrors.amount = amountInCountryCurrency < minDeposit
        ? `Le dépôt minimum est de ${formatAmount(minDeposit, selectedCountryData.currency)}.`
        : `Le dépôt maximum est de ${formatAmount(maxDeposit, selectedCountryData.currency)}.`;
    }
    if (paymentMethod !== "crypto") {
      if (paymentMethod === "mobile_money" && !operator) newErrors.operator = p.errOperator;
      if (!phone.trim()) newErrors.phone = p.errPhone;
      else if (phone.replace(/\s/g, "").length < 8) newErrors.phone = p.errPhoneShort;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayClick = () => {
    const isPixpayOtp = selectedOperatorData?.paymentProvider === "pixpay" &&
      selectedOperatorData?.pixpayOperatorType === "otp";
    if (isPixpayOtp) {
      if (validatePaymentForm()) {
        setPixpayOtpStep(true);
        setPixpayOtpCode("");
      }
    } else {
      payMutation.mutate();
    }
  };

  const payMutation = useMutation({
    mutationFn: async () => {
      const newErrors: Record<string, string> = {};
      if (paymentMethod !== "crypto" && !fullName.trim()) newErrors.fullName = p.errName;
      if (paymentMethod === "crypto" && !cryptoFirstName.trim()) newErrors.cryptoFirstName = "Le prénom est obligatoire.";
      if (paymentMethod === "crypto" && !cryptoLastName.trim()) newErrors.cryptoLastName = "Le nom est obligatoire.";
      if (paymentMethod === "crypto" && !email.trim()) newErrors.email = p.errEmail;
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = p.errEmailInvalid;
      if (!paymentLink?.isFixedAmount && (!customAmount || parseFloat(customAmount) <= 0)) newErrors.amount = p.errAmount;
      if (!paymentMethod) newErrors.paymentMethod = p.errPaymentMethod;
      if (!country) newErrors.country = p.errCountry;
      if (selectedCountryData && paymentMethod !== "crypto" &&
          (amountInCountryCurrency < minDeposit || amountInCountryCurrency > maxDeposit)) {
        newErrors.amount = amountInCountryCurrency < minDeposit
          ? `Le dépôt minimum est de ${formatAmount(minDeposit, selectedCountryData.currency)}.`
          : `Le dépôt maximum est de ${formatAmount(maxDeposit, selectedCountryData.currency)}.`;
      }
      if (paymentMethod !== "crypto") {
        if (paymentMethod === "mobile_money" && !operator) newErrors.operator = p.errOperator;
        if (!phone.trim()) newErrors.phone = p.errPhone;
        else if (phone.replace(/\s/g, "").length < 8) newErrors.phone = p.errPhoneShort;
      }
      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) throw new Error(language === "fr" ? "Veuillez corriger les erreurs ci-dessus" : "Please fix the errors above");

      const isPixpayOtpOp = selectedOperatorData?.paymentProvider === "pixpay" &&
        selectedOperatorData?.pixpayOperatorType === "otp";
      const body: any = {
        fullName: fullName.trim() || "Client crypto",
        email, country, phone,
        amount: paymentLink?.isFixedAmount ? convertedDisplayAmount.toString() : customAmount,
        currency: selectedDisplayCurrency,
        paymentMethod,
        operator: paymentMethod === "mobile_money" ? operator : null,
      };
      if (paymentMethod === "crypto") {
        body.firstName = cryptoFirstName.trim();
        body.lastName = cryptoLastName.trim();
      }
      if (isPixpayOtpOp && pixpayOtpCode) {
        body.pixpayOtp = pixpayOtpCode;
      }
      if (pawaPayPreAuthCode) {
        body.preAuthorisationCode = pawaPayPreAuthCode;
      }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PAYMENT_REQUEST_TIMEOUT_MS);
      try {
        const res = await apiRequest(
          "POST",
          `/api/payment-links/${params?.slug}/pay`,
          body,
          { signal: controller.signal },
        );
        return await parsePaymentLinkJson<any>(
          res,
          "Le serveur n'a renvoyé aucune réponse. Veuillez réessayer.",
        );
      } catch (error) {
        throw normalizePaymentLinkRequestError(error);
      } finally {
        window.clearTimeout(timeout);
      }
    },
    onSuccess: async (data) => {
      const ref = data.reference || "";

      setPaymentComplete(true);
      setPaymentReference(ref);
      setOtpCode("");
      setWaveUrl(null);
      setPawaPayAuth(data.pawaPayAuth || null);
      if (data.status === "completed") {
        setPaymentStatus("success");
        toast({ title: "Paiement confirmé", description: data.message });
        if (ref) redirectAfterPayment("success", ref);
        return;
      }
      if (data.status === "failed") {
        setPaymentStatus("failed");
        setFailureReason(data.message || "Le paiement a échoué.");
        if (ref) redirectAfterPayment("failed", ref);
        return;
      }
      setPaymentStatus("pending");
      toast({ title: "Paiement initié", description: data.message });

      const providerAuthorizationUrl = data.authorizationUrl || data.waveUrl ||
        (data.gateway === "pawapay" ? data.redirectUrl : null);
      if (providerAuthorizationUrl) {
        // Wave flow: show Wave link, poll in background
        setWaveUrl(providerAuthorizationUrl);
        setOtpRequired(false);
        startPaymentPolling(ref);
      } else if (data.otpRequired) {
        setOtpRequired(true);
        setOtpType(data.otpType || "api");
        setOtpUssdCode(data.ussdCode || "");
      } else {
        setOtpRequired(false);
        if (ref) startPaymentPolling(ref);
      }

      if (ref && paymentLink?.hasPdfDelivery) {
        try {
          const pdfRes = await fetch(`/api/payment-links/${params?.slug}/download-pdf/${ref}`);
          if (pdfRes.ok) {
            const pdfData = await pdfRes.json();
            if (pdfData.pdfPath) setPdfDownloadUrl(pdfData.pdfPath);
          }
        } catch (e) { console.error("Failed to fetch PDF download URL", e); }
      }
    },
    onError: (error: Error) => {
      const authError = error as Error & { error?: string; pawaPayAuth?: any };
      if (authError.error === "pawa_preauthorisation_required") {
        setPaymentComplete(true);
        setPawaPayAuth(authError.pawaPayAuth || null);
        setPaymentStatus("pending");
        return;
      }
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setPaymentComplete(false);
      if (error.message !== "Veuillez corriger les erreurs ci-dessus" && error.message !== "Please fix the errors above") {
        const providerError = error as Error & {
          provider_code?: unknown;
          provider_status?: unknown;
        };
        const diagnostics = [
          typeof providerError.provider_code === "string"
            ? `Code fournisseur : ${providerError.provider_code}`
            : "",
          providerError.provider_status !== undefined &&
          Number.isFinite(Number(providerError.provider_status))
            ? `Statut : ${providerError.provider_status}`
            : "",
        ].filter(Boolean);
        toast({
          title: "Erreur",
          description: [error.message, diagnostics.join(" · ")].filter(Boolean).join("\n"),
          variant: "destructive",
        });
      }
    },
  });

  const otpMutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await apiRequest(
          "POST",
          `/api/payment-links/${params?.slug}/confirm-otp`,
          { ref: paymentReference, otpCode },
        );
        return await parsePaymentLinkJson<any>(res, "Le serveur n'a renvoyé aucune réponse.");
      } catch (error) {
        throw normalizePaymentLinkRequestError(error);
      }
    },
    onSuccess: () => {
      setOtpRequired(false);
      toast({ title: "OTP validé", description: "Paiement en cours de traitement…" });
      // Keep the original payment deadline; confirming the OTP must not give
      // the transaction another full eight minutes.
      startPaymentPolling(paymentReference, false);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur OTP", description: error.message, variant: "destructive" });
    },
  });

  // WaaS mutation for payment-link crypto address
  const generatePayLinkCryptoMutation = useMutation({
    mutationFn: async () => {
      const net = payCoinList[payCryptoCoin]?.networks.find(n => n.id === displayedPayCryptoNetwork);
      if (!net) throw new Error("Réseau invalide");
      if (!country) throw new Error(p.errCountry);
       if (!cryptoFirstName.trim()) throw new Error("Le prénom est obligatoire.");
       if (!cryptoLastName.trim()) throw new Error("Le nom est obligatoire.");
      if (!email.trim()) throw new Error(p.errEmail);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new Error(p.errEmailInvalid);
      }
       const body: Record<string, string> = {
         assetCode: net.assetCode,
         firstName: cryptoFirstName.trim(),
         lastName: cryptoLastName.trim(),
         email: email.trim(),
       };
      body.country = country;
      if (!(paymentLink as any)?.isFixedAmount && payCryptoAmount) {
        const usdtEquiv = payCryptoCoinPrice > 0
          ? (parseFloat(payCryptoAmount) * payCryptoCoinPrice).toFixed(4)
          : payCryptoAmount;
        if (parseFloat(usdtEquiv) < 1) {
          throw new Error(`Le montant minimum est de ${formatCryptoAmount(minimumCryptoAmount(payCryptoCoinPrice))} ${payCryptoCoin} (soit 1 USDT).`);
        }
        body.amountUsdt = usdtEquiv;
      }
      if (payCryptoRefundAddress.trim())
        body.refundAddress = payCryptoRefundAddress.trim();
      let data: any;
      try {
        const res = await apiRequest(
          "POST",
          `/api/payment-links/${params?.slug}/crypto/address`,
          body,
        );
        data = await parsePaymentLinkJson<any>(
          res,
          "Le serveur n'a renvoyé aucune réponse. Veuillez réessayer.",
        );
      } catch (error) {
        throw normalizePaymentLinkRequestError(error);
      }
      if (net.memoRequired && !data.memo) {
        throw new Error(`Le réseau ${net.label} exige un memo/tag, mais le fournisseur n'en a pas retourné.`);
      }
      return data;
    },
    onSuccess: (data) => {
      const addr: string = data.address || data.depositAddress || data.data?.address || "";
      if (!addr) {
        toast({
          title: "Erreur adresse crypto",
          description: "L'adresse de dépôt n'a pas été reçue. Veuillez réessayer.",
          variant: "destructive",
        });
        return;
      }
      setPayCryptoAddr(addr);
      setPayCryptoMemo(data.memo ?? null);
      setPayCryptoRef(data.reference || "");
      setPayCryptoAssetCode(data.assetCode);
      setPayCryptoAmountUsdt(data.amountUsdt || "");
      setPayCryptoFeeBreakdown(data.providerFeeAmountUsdt != null ? {
        providerFeePercent: Number(data.providerFeePercent || 0),
        providerFeeAmountUsdt: Number(data.providerFeeAmountUsdt || 0),
        ashtechFeePercent: Number(data.ashtechFeePercent || 0),
        ashtechFeeAmountUsdt: Number(data.ashtechFeeAmountUsdt || 0),
        totalFeePercent: Number(data.totalFeePercent || 0),
        totalFeeAmountUsdt: Number(data.totalFeeAmountUsdt || 0),
        creditedAmountUsdt: Number(data.creditedAmountUsdt || 0),
      } : null);
      setPayCryptoShared(data.shared ?? false);
      setPayCryptoMemoType(data.memoType ?? "memo");
      setPayCryptoStep("ready");
      // Keep the crypto UI countdown short and consistent across Pay and Deposit.
      // The server-side 15-minute pending timeout is independent of this display timer.
      setPayReadyCountdown(CRYPTO_COUNTDOWN_SECONDS);
      if (payReadyCountdownRef.current) clearInterval(payReadyCountdownRef.current);
      payReadyCountdownRef.current = setInterval(() => {
        setPayReadyCountdown(prev => {
          if (prev <= 1) { clearInterval(payReadyCountdownRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Keep USDT/TRC20 as the default when the dynamic catalogue loads. If an
  // administrator disables it, fall back to the first active option instead.
  useEffect(() => {
    const availableCoins = Object.keys(payCoinList);
    if (!availableCoins.length) return;
    const activeCoin = payCoinList[payCryptoCoin]
      ? payCryptoCoin
      : (payCoinList.USDT ? "USDT" : availableCoins[0]);
    if (activeCoin !== payCryptoCoin) setPayCryptoCoin(activeCoin);
    const nets = payCoinList[activeCoin]?.networks ?? [];
    if (nets.length && !nets.some(net => net.id === payCryptoNetwork)) {
      setPayCryptoNetwork(
        activeCoin === "USDT" && nets.some(net => net.id === "TRC20")
          ? "TRC20"
          : nets[0].id,
      );
    }
  }, [payCoinList, payCryptoCoin, payCryptoNetwork, payCryptoNetworkTouched]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Start the OTP timer from the rendered state as a safety net. This keeps
  // the timer working even when a mobile browser batches the mutation update.
  useEffect(() => {
    if (otpRequired && paymentStatus === "pending") {
      startPaymentCountdown(false);
    }
  }, [otpRequired, paymentStatus]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetForm = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPaymentComplete(false);
    setPaymentStatus("pending");
    setPaymentReference("");
    setFailureReason("");
    setCountdown(PAYMENT_COUNTDOWN_SECONDS);
    countdownDeadlineRef.current = null;
    setFullName(""); setEmail(""); setCryptoFirstName(""); setCryptoLastName(""); setPhone(""); setCustomAmount("");
    setCountry(""); setOperator(""); setPaymentMethod("");
    setErrors({});
    setOtpRequired(false);
    setOtpCode("");
    setWaveUrl(null);
    setPawaPayAuth(null);
    setPawaPayPreAuthCode("");
    setPayCryptoCoin("USDT");
    setPayCryptoNetwork("TRC20");
    setPayCryptoNetworkTouched(false);
    setPayCryptoStep("form");
    setPayCryptoAddr("");
    setPayCryptoMemo(null);
    setPayCryptoRef("");
    setPayCryptoAssetCode("USDT.TRC20");
    setPayCryptoAmountUsdt("");
    setPayCryptoFeeBreakdown(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !paymentLink) {
    const paymentLinkError = error as (Error & { code?: string; status?: number }) | null;
    const isPaymentLinkBlocked =
      paymentLinkError?.code === "PAYMENT_LINK_BLOCKED" ||
      paymentLinkError?.status === 403;

    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-6">
              {isPaymentLinkBlocked ? (
                <Shield className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              ) : (
                <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              )}
              <h2 className="text-xl font-bold text-foreground mb-2">
                {isPaymentLinkBlocked ? p.linkBlocked : p.linkNotFound}
              </h2>
              <p className="text-muted-foreground mb-6">
                {isPaymentLinkBlocked ? p.linkBlockedDesc : p.linkNotFoundDesc}
              </p>
              <Link href="/"><Button variant="outline">{p.backHome}</Button></Link>
            </CardContent>
          </Card>
        </div>
        <Footer p={p} />
      </div>
    );
  }

  if (pixpayOtpStep && !paymentComplete) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-8 pb-8 space-y-5 text-center">
              {/* Operator logo with amber halo */}
              <div className="relative flex items-center justify-center pt-2">
                <div className="absolute w-24 h-24 rounded-full bg-amber-500/10 animate-pulse" />
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-border shadow-md flex items-center justify-center relative z-10">
                  {selectedOperatorData && getOperatorLogo(selectedOperatorData.name) ? (
                    <img src={getOperatorLogo(selectedOperatorData.name)!} alt={selectedOperatorData.name} className="w-full h-full object-cover" />
                  ) : (
                    <Phone className="w-7 h-7 text-amber-500" />
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <h2 className="text-xl font-bold text-foreground">Code OTP requis</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Composez le code USSD sur votre téléphone pour obtenir votre OTP.
                </p>
              </div>

              {/* Amount card */}
              <div className="w-full bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200/50 dark:border-amber-800/30 px-6 py-4 text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatAmount(displayAmount, (displayCurrency as string) || "XAF")}
                </p>
                {selectedOperatorData && (
                  <p className="text-sm text-muted-foreground mt-1">via {selectedOperatorData.name}</p>
                )}
              </div>

              {/* USSD code */}
              {(selectedOperatorData?.otpUssdCode || "#144*82#") && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl px-5 py-4 inline-block mx-auto">
                  <p className="text-2xl font-mono font-bold tracking-widest text-amber-700 dark:text-amber-300">
                    {selectedOperatorData?.otpUssdCode || "#144*82#"}
                  </p>
                </div>
              )}

              {/* OTP input + buttons */}
              <div className="space-y-3 max-w-xs mx-auto w-full">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="Ex : 123456"
                  value={pixpayOtpCode}
                  onChange={e => setPixpayOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full text-center text-2xl font-mono tracking-widest h-14 border-2 border-amber-400 rounded-md bg-background text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  data-testid="input-pixpay-otp-step"
                  autoFocus
                />
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => payMutation.mutate()}
                  disabled={pixpayOtpCode.length < 4 || payMutation.isPending}
                  data-testid="button-confirm-pixpay-otp"
                >
                  {payMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{p.processing}</>
                    : <><Shield className="w-4 h-4 mr-2" />Confirmer le paiement</>}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => { setPixpayOtpStep(false); setPixpayOtpCode(""); }}
                  disabled={payMutation.isPending}
                  data-testid="button-pixpay-otp-back"
                >
                  ← Retour au formulaire
                </Button>
              </div>

              {/* Animated dots */}
              <div className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>{p.securePayment}</span>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer p={p} />
      </div>
    );
  }

  // ── WaaS crypto address ready ────────────────────────────────────────────
  if (paymentMethod === "crypto" && payCryptoStep === "ready" && payCryptoAddr) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-5">

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bitcoin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{payCryptoAssetCode}</p>
                <p className="text-xs text-muted-foreground">Envoyez exactement le montant en crypto ci-dessous</p>
              </div>
            </div>

            {/* Amount banner */}
            {(payCryptoAmount || payCryptoAmountUsdt) && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-amber-700 dark:text-amber-400">Montant à envoyer (estimé)</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {payCryptoAmount || (
                    payCryptoCoin === "USDT"
                      ? payCryptoAmountUsdt
                      : (payCryptoCoinPrice > 0 && fixedCryptoAmountUsdt > 0
                        ? formatCryptoAmount(fixedCryptoAmountUsdt / payCryptoCoinPrice)
                        : payCryptoAmountUsdt)
                  )} {payCryptoCoin}
                </p>
                {payCryptoAmountUsdt && payCryptoCoin !== "USDT" && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">≈ {payCryptoAmountUsdt} USDT</p>
                )}
              </div>
            )}
            {/* QR code */}
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-border">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(cryptoQrPayload(payCryptoAssetCode, payCryptoAddr, payCryptoMemo, payCryptoMemoType))}&bgcolor=ffffff&color=000000&margin=1`}
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
                <p className="font-mono text-xs font-bold text-foreground break-all flex-1">{payCryptoAddr}</p>
                {(cryptoAssetsLoading || hasCryptoAssets) && <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(payCryptoAddr); toast({ title: "Adresse copiée !" }); }}
                  className="shrink-0 p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                  title="Copier l'adresse"
                >
                  <Copy className="w-4 h-4 text-foreground" />
                </button>}
              </div>
            </div>

            {/* Memo/Tag */}
            {payCryptoMemo && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  ⚠️ {payCryptoMemoType === "tag" ? "Tag de destination" : "Mémo"} obligatoire
                </p>
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5">
                  <p className="font-mono text-sm font-bold text-amber-700 dark:text-amber-300 flex-1">{payCryptoMemo}</p>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(payCryptoMemo!); toast({ title: "Mémo copié !" }); }}
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

            {/* Info banner (shared address) */}
            {payCryptoShared && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5 text-xs text-blue-600 dark:text-blue-400">
                ℹ️ Adresse partagée — envoyez depuis votre propre portefeuille, ne pas utiliser en échange direct.
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
                      strokeDashoffset={`${2 * Math.PI * 22 * (1 - (payReadyCountdown % 60) / 60)}`}
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
                    {String(Math.floor(payReadyCountdown / 3600)).padStart(2, "0")}:
                    {String(Math.floor((payReadyCountdown % 3600) / 60)).padStart(2, "0")}:
                    {String(payReadyCountdown % 60).padStart(2, "0")}
                  </p>
                </div>
              </div>
              {/* Ligne vérification */}
              <div className="flex items-center gap-3 border-t border-border pt-3">
                <Hourglass className="w-5 h-5 text-teal-500 shrink-0" />
                <p className="text-sm text-foreground">Vérification de la transaction blockchain</p>
              </div>
            </div>

            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
              onClick={() => {
                if (payReadyCountdownRef.current) clearInterval(payReadyCountdownRef.current);
                setPayCryptoStep("form");
              }}
            >
              ← Modifier
            </button>
          </div>
        </div>
        <Footer p={p} />
      </div>
    );
  }

  if (paymentComplete) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-6 space-y-4">

              {paymentStatus === "pending" && pawaPayAuth?.authType === "PREAUTH" && !paymentReference && (
                <>
                  <div className="relative flex items-center justify-center pt-2">
                    <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center">
                      <Shield className="w-7 h-7 text-amber-500" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Préautorisation requise</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      Obtenez le code dans le menu USSD de votre opérateur, puis saisissez-le pour continuer.
                    </p>
                  </div>
                  {pawaPayAuth.authTokenInstructions?.channels?.map((channel: any, channelIndex: number) => (
                    <div key={channelIndex} className="w-full rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-left space-y-1">
                      {(channel.instructions?.fr || channel.instructions?.en || []).map((instruction: any, instructionIndex: number) => (
                        <p key={instructionIndex} className="text-sm text-muted-foreground">{instruction.text || instruction.template}</p>
                      ))}
                      {channel.quickLink && (
                        <a href={channel.quickLink} className="inline-flex text-sm font-medium text-primary underline">
                          Ouvrir le menu USSD
                        </a>
                      )}
                    </div>
                  ))}
                  <div className="space-y-3 w-full max-w-xs mx-auto">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={pawaPayPreAuthCode}
                      onChange={e => setPawaPayPreAuthCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="Code de préautorisation"
                      className="text-center text-xl font-mono tracking-widest h-14"
                      data-testid="input-pawapay-preauthorisation"
                      autoFocus
                    />
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => payMutation.mutate()}
                      disabled={pawaPayPreAuthCode.length < 4 || payMutation.isPending}
                      data-testid="button-confirm-pawapay-preauthorisation"
                    >
                      {payMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Traitement…</> : "Continuer le paiement"}
                    </Button>
                  </div>
                </>
              )}

              {paymentStatus === "pending" && otpRequired && (
                <>
                  {/* Operator logo with amber halo */}
                  <div className="relative flex items-center justify-center pt-2">
                    <div className="absolute w-24 h-24 rounded-full bg-amber-500/10 otp-logo-halo" />
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-border shadow-md flex items-center justify-center relative z-10">
                      {selectedOperatorData && getOperatorLogo(selectedOperatorData.name) ? (
                        <img src={getOperatorLogo(selectedOperatorData.name)!} alt={selectedOperatorData.name} className="w-full h-full object-cover" />
                      ) : (
                        <Phone className="w-7 h-7 text-amber-500" />
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Code OTP requis</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      {otpType === "ussd" && otpUssdCode
                        ? "Composez le code USSD ci-dessous pour obtenir votre OTP."
                        : "Un code OTP a été envoyé par SMS sur votre téléphone."}
                    </p>
                  </div>

                  {/* Amount card */}
                  <div className="w-full bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200/50 dark:border-amber-800/30 px-6 py-4 text-center">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {formatAmount(displayAmount, (displayCurrency as string) || "XAF")}
                    </p>
                    {selectedOperatorData && (
                      <p className="text-sm text-muted-foreground mt-1">via {selectedOperatorData.name}</p>
                    )}
                  </div>

                  {/* USSD code block if applicable */}
                  {otpType === "ussd" && otpUssdCode && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl px-5 py-4 inline-block mx-auto">
                      <p className="text-2xl font-mono font-bold tracking-widest text-amber-700 dark:text-amber-300" data-testid="text-ussd-code">
                        {otpUssdCode}
                      </p>
                    </div>
                  )}

                  {/* OTP input + button */}
                  <div className="space-y-3 w-full max-w-xs mx-auto">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      placeholder="Ex : 123456"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full text-center text-2xl font-mono tracking-widest h-14 border rounded-md bg-background text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      data-testid="input-otp-code"
                      autoFocus
                    />
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => otpMutation.mutate()}
                      disabled={otpCode.length < 4 || otpMutation.isPending}
                      data-testid="button-confirm-otp"
                    >
                      {otpMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Validation…</> : "Confirmer le code OTP"}
                    </Button>
                  </div>

                  {/* Animated dots */}
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>

                  {/* Countdown progress bar */}
                  <div className="w-full space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" /> Expiration
                      </span>
                      <span
                        className="font-semibold tabular-nums text-foreground"
                        aria-live="polite"
                      >
                        {formatCountdown(countdown)}
                      </span>
                    </div>
                    <div
                      className="h-2 bg-muted rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={PAYMENT_COUNTDOWN_SECONDS}
                      aria-valuenow={countdown}
                      aria-label="Temps restant avant expiration"
                    >
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(countdown / PAYMENT_COUNTDOWN_SECONDS) * 100}%` }}
                      />
                    </div>
                  </div>

                  {paymentReference && (
                    <div className="w-full bg-muted/30 rounded-lg p-3 text-left">
                      <p className="text-xs text-muted-foreground">Référence de transaction</p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="font-mono text-sm font-bold text-foreground">{paymentReference}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(paymentReference).then(() => toast({ title: "Référence copiée" })).catch(() => toast({ title: "Échec de la copie", variant: "destructive" })); }}
                          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          aria-label="Copier la référence"
                          data-testid="button-copy-reference"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {paymentStatus === "pending" && !otpRequired && waveUrl && (
                <>
                  {/* Wave logo with blue halo */}
                  <div className="relative flex items-center justify-center pt-2">
                    <div className="absolute w-24 h-24 rounded-full bg-blue-500/10 animate-pulse" />
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-border shadow-md flex items-center justify-center relative z-10">
                      <img src="https://wave.com/favicon.ico" alt="Wave" className="w-10 h-10 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Paiement Wave</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      Ouvrez Wave et confirmez votre paiement, puis revenez sur cette page.
                    </p>
                  </div>

                  {/* Amount card */}
                  <div className="w-full bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30 px-6 py-4 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatAmount(displayAmount, (displayCurrency as string) || "XAF")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">via Wave</p>
                  </div>

                  {/* Wave URL button */}
                  <a
                    href={waveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="button-open-wave"
                  >
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 w-full max-w-xs">
                      <ExternalLink className="w-5 h-5" />
                      Payer avec Wave
                    </Button>
                  </a>

                  {/* Animated dots */}
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>

                  {/* Countdown progress bar */}
                  <div className="w-full space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" /> Expiration
                      </span>
                      <span className="font-semibold tabular-nums text-foreground" aria-live="polite">
                        {formatCountdown(countdown)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(countdown / PAYMENT_COUNTDOWN_SECONDS) * 100}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">La transaction sera automatiquement annulée si non confirmée.</p>

                  {paymentReference && (
                    <div className="w-full bg-muted/30 rounded-lg p-3 text-left">
                      <p className="text-xs text-muted-foreground">Référence de transaction</p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="font-mono text-sm font-bold text-foreground">{paymentReference}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(paymentReference).then(() => toast({ title: "Référence copiée" })).catch(() => toast({ title: "Échec de la copie", variant: "destructive" })); }}
                          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          aria-label="Copier la référence"
                          data-testid="button-copy-reference"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {paymentStatus === "pending" && !otpRequired && !waveUrl && (
                <>
                  {/* Operator logo with halo */}
                  <div className="relative flex items-center justify-center pt-2">
                    <div className="absolute w-24 h-24 rounded-full bg-blue-500/20 animate-ping" />
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-border shadow-md flex items-center justify-center relative z-10">
                      {selectedOperatorData && getOperatorLogo(selectedOperatorData.name) ? (
                        <img src={getOperatorLogo(selectedOperatorData.name)!} alt={selectedOperatorData.name} className="w-full h-full object-cover" />
                      ) : (
                        <Smartphone className="w-7 h-7 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Transaction en cours</h2>
                    <p className="text-muted-foreground text-sm mt-1">Veuillez confirmer le paiement sur votre téléphone.</p>
                  </div>

                  {/* Amount card */}
                  <div className="w-full bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30 px-6 py-4 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatAmount(displayAmount, (displayCurrency as string) || "XAF")}
                    </p>
                    {selectedOperatorData && (
                      <p className="text-sm text-muted-foreground mt-1">via {selectedOperatorData.name}</p>
                    )}
                  </div>
                  {pawaPayAuth?.authType === "PROVIDER_AUTH" && (
                    <div className="w-full rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-left space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {pawaPayAuth.pinPrompt === "MANUAL"
                          ? "Confirmez la demande sur votre téléphone."
                          : "Une demande de confirmation va apparaître sur votre téléphone."}
                      </p>
                      {getPawaPayPinInstructions(pawaPayAuth).map((instruction, index) => (
                        <p key={index} className="text-sm text-muted-foreground">{instruction.text || instruction.template}</p>
                      ))}
                    </div>
                  )}

                  {/* Animated dots */}
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>

                  {/* Countdown progress bar */}
                  <div className="w-full space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" /> Expiration
                      </span>
                      <span className="font-semibold tabular-nums text-foreground" aria-live="polite">
                        {formatCountdown(countdown)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(countdown / PAYMENT_COUNTDOWN_SECONDS) * 100}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">La transaction sera automatiquement annulée si non confirmée.</p>

                  {paymentReference && (
                    <div className="w-full bg-muted/30 rounded-lg p-3 text-left">
                      <p className="text-xs text-muted-foreground">Référence de transaction</p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="font-mono text-sm font-bold text-foreground">{paymentReference}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(paymentReference).then(() => toast({ title: "Référence copiée" })).catch(() => toast({ title: "Échec de la copie", variant: "destructive" })); }}
                          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          aria-label="Copier la référence"
                          data-testid="button-copy-reference"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {paymentStatus === "success" && (
                <>
                  {/* Animated success icon */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-28 h-28 rounded-full bg-green-500/10 animate-ping" style={{ animationDuration: "2s" }} />
                    <div className="absolute w-24 h-24 rounded-full bg-green-500/15" />
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center relative z-10">
                      <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Paiement confirmé</h2>
                    <p className="text-muted-foreground text-sm mt-1">Votre paiement a été reçu avec succès. Merci pour votre confiance !</p>
                  </div>
                  {/* Amount summary */}
                  <div className="w-full bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200/50 dark:border-green-800/30 px-6 py-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Montant reçu</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatAmount(displayAmount, selectedDisplayCurrency)}</p>
                  </div>
                  {/* Reference */}
                  {paymentReference && (
                    <div className="w-full bg-muted/30 rounded-lg p-3 text-left">
                      <p className="text-xs text-muted-foreground">Référence de transaction</p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="font-mono text-sm font-bold text-foreground">{paymentReference}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(paymentReference).then(() => toast({ title: "Référence copiée" })).catch(() => toast({ title: "Échec de la copie", variant: "destructive" })); }}
                          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          aria-label="Copier la référence"
                          data-testid="button-copy-reference"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={resetForm}
                    data-testid="button-new-payment"
                  >
                    Retour à l'accueil
                  </Button>
                </>
              )}
              {paymentStatus === "failed" && (
                <>
                  {/* Failure icon */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-24 h-24 rounded-full bg-red-500/10" />
                    <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center relative z-10">
                      <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Paiement échoué</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      {failureReason || "Le paiement n'a pas pu être confirmé. Veuillez réessayer."}
                    </p>
                  </div>
                  {paymentReference && (
                    <div className="w-full bg-muted/30 rounded-lg p-3 text-left">
                      <p className="text-xs text-muted-foreground">Référence de transaction</p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="font-mono text-sm font-bold text-foreground">{paymentReference}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(paymentReference).then(() => toast({ title: "Référence copiée" })).catch(() => toast({ title: "Échec de la copie", variant: "destructive" })); }}
                          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          aria-label="Copier la référence"
                          data-testid="button-copy-reference"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={resetForm}
                    size="lg"
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold"
                    data-testid="button-retry-payment"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Réessayer
                  </Button>
                </>
              )}
              {paymentLink?.hasPdfDelivery && paymentStatus === "success" && (
                <div className="pt-4 border-t">
                  {pdfDownloadUrl ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-center space-y-3">
                      <FileText className="w-8 h-8 text-amber-500 mx-auto" />
                      <p className="text-sm font-medium">Votre document est prêt</p>
                      <p className="text-xs text-muted-foreground">Un email avec ce lien a également été envoyé à votre adresse</p>
                      <a
                        href={pdfDownloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-amber-500 text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-amber-400 transition-colors"
                        data-testid="link-pdf-download"
                      >
                        <FileText className="w-4 h-4" />
                        Accéder au document →
                      </a>
                    </div>
                  ) : (
                    <div className="text-sm text-amber-500 bg-amber-500/10 p-3 rounded-lg">
                      <p className="flex items-center gap-2"><FileText className="w-4 h-4" />Le lien vers votre document sera disponible après confirmation du paiement</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <Footer p={p} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-transparent pointer-events-none" />
      
      <header className="flex justify-between items-center px-4 py-2 relative z-10 border-b border-border/60 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="AshTech Pay" className="h-14 object-contain" data-testid="img-logo" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2 border-border bg-muted/50 hover:bg-muted font-medium" data-testid="button-language-selector">
              <img src="/language-icon.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
              <span className="text-sm font-semibold">{language === "fr" ? "FR" : "EN"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={() => setLanguage("fr")}
              className={`flex items-center gap-2 cursor-pointer ${language === "fr" ? "font-semibold text-primary" : ""}`}
              data-testid="lang-option-fr"
            >
              <img src="/language-icon.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
              <span>Français</span>
              {language === "fr" && <span className="ml-auto text-primary text-xs">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage("en")}
              className={`flex items-center gap-2 cursor-pointer ${language === "en" ? "font-semibold text-primary" : ""}`}
              data-testid="lang-option-en"
            >
              <img src="/language-icon.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
              <span>English</span>
              {language === "en" && <span className="ml-auto text-primary text-xs">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      
      <div className="flex-1 flex items-start justify-center p-4 relative z-10">
        <Card className="w-full max-w-lg overflow-hidden">
          <CardHeader className="text-center pb-0">
            <CardTitle className="text-2xl" data-testid="text-payment-title">{paymentLink.title}</CardTitle>
          </CardHeader>
          {paymentLink.imagePath && (
            <div className="w-full mt-4 px-4">
              <img
                src={getImageSrc(paymentLink.imagePath)}
                alt={paymentLink.title}
                className="block w-auto max-w-full h-auto max-h-32 sm:max-h-48 md:max-h-56 mx-auto object-contain rounded-lg bg-muted"
                data-testid="img-payment-link"
              />
            </div>
          )}
          {paymentLink.description && (
            <p className="text-sm text-muted-foreground text-center px-6 pt-4" data-testid="text-payment-description">{paymentLink.description}</p>
          )}
          {paymentLink.hasPdfDelivery && (
            <div className="flex items-center gap-2 text-amber-500 text-sm bg-amber-500/10 p-3 mx-4 mt-4 rounded-lg">
              <FileText className="w-4 h-4 shrink-0" />
              <span>{p.pdfDelivery}</span>
            </div>
          )}
          
          <CardContent className="space-y-5">

            {/* Country — first field */}
            <div className="space-y-2">
              <Label htmlFor="country">{p.country} *</Label>
              <Select value={country} onValueChange={(val) => { setCountry(val); setOperator(""); setErrors(p => ({...p, country: undefined as any})); }}>
                <SelectTrigger data-testid="select-country" className={`h-14 ${errors.country ? "border-red-500" : ""}`}>
                  {selectedCountryData ? (
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xl shrink-0">
                        {selectedCountryData.flag}
                      </span>
                      <span className="font-semibold truncate">{selectedCountryData.name}</span>
                      <span className="text-muted-foreground text-sm shrink-0">({selectedCountryData.currency})</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">{p.selectCountry}</span>
                  )}
                </SelectTrigger>
                <SearchableSelectContent
                  options={depositConfig.map(c => ({
                    value: c.id,
                    label: c.name,
                    flag: c.flag,
                    sub: c.currency,
                  }))}
                />
              </Select>
              {errors.country && <p className="text-xs text-red-500">{errors.country}</p>}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>{p.paymentMethod} *</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={`flex flex-col items-center gap-1.5 h-auto py-3 px-2 rounded-lg border-2 transition-all w-full ${paymentMethod === "mobile_money" ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"}`}
                  onClick={() => { setPaymentMethod("mobile_money"); setErrors(prev => ({...prev, paymentMethod: undefined as any})); }}
                  data-testid="button-payment-mobile"
                >
                  <img src="/payment-mobile-money.jpeg" alt="Mobile Money" className="w-12 h-12 rounded-md object-contain bg-white" loading="eager" decoding="async" />
                  <span className="text-xs font-medium">Mobile Money</span>
                </button>
                <button
                  type="button"
                  className={`flex flex-col items-center gap-1.5 h-auto py-3 px-2 rounded-lg border-2 transition-all w-full ${paymentMethod === "crypto" ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"}`}
                  onClick={() => {
                    setPaymentMethod("crypto");
                    setPayCryptoCoin("USDT");
                    setPayCryptoNetwork("TRC20");
                    setPayCryptoNetworkTouched(false);
                    setPayCryptoAssetCode("USDT.TRC20");
                    setErrors(prev => ({...prev, paymentMethod: undefined as any}));
                  }}
                  data-testid="button-payment-crypto"
                >
                  <img src="/payment-crypto.jpeg" alt="Crypto" className="w-12 h-12 rounded-md object-contain bg-white" loading="eager" decoding="async" />
                  <span className="text-xs font-medium">Crypto</span>
                </button>
                <button
                  type="button"
                  className={`flex flex-col items-center gap-1.5 h-auto py-3 px-2 rounded-lg border-2 transition-all w-full ${paymentMethod === "paypal" ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"}`}
                  onClick={() => setPaymentMethod("paypal")}
                  data-testid="button-payment-paypal"
                >
                  <img src="/payment-paypal.jpeg" alt="PayPal / Card" className="w-12 h-12 rounded-md object-contain bg-white" loading="eager" decoding="async" />
                  <span className="text-xs font-medium">PayPal / Card</span>
                </button>
              </div>
              {errors.paymentMethod && <p className="text-xs text-red-500">{errors.paymentMethod}</p>}
            </div>

            {paymentMethod === "paypal" && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-500 text-sm">{p.paypalUnavailable}</p>
                  <p className="text-sm text-muted-foreground">{p.paypalUnavailableDesc}</p>
                </div>
              </div>
            )}


            {/* Operator */}
            {paymentMethod === "mobile_money" && country && operators.length > 0 && (
              <div className="space-y-2">
                <Label>{p.operator} *</Label>
                <div className="w-full overflow-hidden">
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  {operators.map((op) => {
                    const logo = getOperatorLogo(op.name);
                    const isSelected = operator === op.id;
                    const isOrangeMoney = op.name.toLowerCase().includes("orange");
                    return (
                      <button
                        key={op.id}
                        type="button"
                        data-testid={`button-operator-${op.id}`}
                        onClick={() => { setOperator(op.id); setErrors(p => ({...p, operator: undefined as any})); }}
                        className={`flex-shrink-0 flex flex-col items-center justify-center gap-2 w-28 h-24 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-white hover:border-primary/40 hover:bg-muted/30"
                        }`}
                      >
                        {logo ? (
                          <img src={logo} alt={op.name} className={`${isOrangeMoney ? "w-16 h-12" : "w-12 h-12"} object-contain rounded-lg bg-white`} loading="eager" decoding="async" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Smartphone className="w-6 h-6 text-primary" />
                          </div>
                        )}
                        <span className={`text-xs font-medium text-center leading-tight px-1 ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {op.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                </div>
                {errors.operator && <p className="text-xs text-red-500">{errors.operator}</p>}
                <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2.5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                    Instructions selon l’opérateur
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-xs text-blue-950">
                      <thead>
                        <tr className="border-b border-blue-200/70 text-[10px] uppercase tracking-wide text-blue-700">
                          <th className="py-1.5 pr-3 font-semibold">Opérateur</th>
                          <th className="py-1.5 font-semibold">Action à effectuer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-200/50">
                        {operators.map((op) => {
                          const instruction = op.pixpayOperatorType === "otp"
                            ? `Composer ${op.otpUssdCode || "le code USSD retourné"} pour obtenir l’OTP`
                            : op.pixpayOperatorType === "wave"
                              ? "Ouvrir la redirection Wave"
                              : "Valider la demande USSD Push sur le téléphone";
                          return (
                            <tr key={`instruction-${op.id}`}>
                              <td className="py-1.5 pr-3 font-medium">{op.name}</td>
                              <td className="py-1.5">{instruction}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === "mobile_money" && country && operators.length === 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center text-sm text-muted-foreground">
                {p.noOperator}
              </div>
            )}

            {/* ══ CRYPTO FORM — deposit-style ══ */}
            {paymentMethod === "crypto" && hasCryptoAssets ? (
              <>
                {/* ── Coin selector ── */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.cryptoCurrency}</p>
                  <CoinSelect
                    value={payCryptoCoin}
                    onChange={coin => {
                      setPayCryptoCoin(coin);
                      setPayCryptoNetworkTouched(false);
                    }}
                    coinList={payCoinList}
                    coinLogoUrl={coinLogoUrl}
                  />
                </div>

                {/* ── Network selector ── */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.network}</p>
                  <div className="relative">
                    <select
                      value={displayedPayCryptoNetwork}
                      onChange={e => {
                        setPayCryptoNetwork(e.target.value);
                        setPayCryptoNetworkTouched(true);
                      }}
                      className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
                    >
                      {(payCoinList[payCryptoCoin]?.networks ?? []).map(net => (
                        <option key={net.id} value={net.id}>{net.label}</option>
                      ))}
                    </select>
                    {/* network chain logo overlay */}
                    <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                      <img
                        src={networkLogoUrl(displayedPayCryptoNetwork)}
                        alt={displayedPayCryptoNetwork}
                        className="w-6 h-6 object-contain"
                        onLoad={(e) => { (e.target as HTMLImageElement).style.display = ""; }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">▼</div>
                  </div>
                  {payCoinList[payCryptoCoin]?.networks.find(n => n.id === displayedPayCryptoNetwork)?.memoRequired && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                       ⚠️ {p.memoRequired}
                    </p>
                  )}
                </div>

                {/* ── Amount in selected coin — only for non-fixed links ── */}
                {!paymentLink.isFixedAmount ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                       {p.cryptoAmount} ({payCryptoCoin})
                    </label>
                    <div className="flex rounded-xl border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
                      <span className="flex items-center px-3 bg-muted border-r border-border text-sm font-bold text-muted-foreground shrink-0">
                        {payCryptoCoin}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={payCryptoMinimumAmount || 0}
                        step="any"
                        placeholder={payCryptoMinimumAmount ? formatCryptoAmount(payCryptoMinimumAmount) : "0.00"}
                        value={payCryptoAmount}
                        onChange={e => setPayCryptoAmount(e.target.value)}
                        className="flex-1 min-w-0 px-4 h-12 bg-background text-base font-semibold focus:outline-none"
                      />
                    </div>
                    {/* USDT equivalent estimate */}
                    {parseFloat(payCryptoAmount) > 0 && payCryptoCoinPrice > 0 && (
                      <p className="text-xs text-muted-foreground px-1">
                        ≈ <span className="font-semibold text-foreground">{(parseFloat(payCryptoAmount) * payCryptoCoinPrice).toFixed(2)} USDT</span>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground px-1">
                      {p.cryptoMinimum} : <span className="font-semibold text-foreground">
                        {payCryptoMinimumAmount ? `${formatCryptoAmount(payCryptoMinimumAmount)} ${payCryptoCoin}` : "1 USDT"}
                      </span> (1 USDT, {p.beforeFees})
                    </p>
                    {/* Quick-select presets (click sets coin equivalent of USDT amount) */}
                    <div className="flex gap-2 flex-wrap">
                      {["10", "50", "100", "250", "500"].map(v => {
                        const usdtVal = parseFloat(v);
                        const coinVal = payCryptoCoinPrice > 0 ? usdtVal / payCryptoCoinPrice : 0;
                        return (
                          <button
                            key={v}
                            type="button"
                            disabled={coinVal <= 0}
                            onClick={() => setPayCryptoAmount(coinVal < 1 ? coinVal.toFixed(6) : coinVal.toFixed(2))}
                            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 font-semibold transition-all disabled:opacity-40"
                          >
                            ~{v} USDT
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Fixed amount — show reference */
                  <div className="bg-muted/30 rounded-xl px-4 py-3 text-center space-y-0.5">
                    <p className="text-xs text-muted-foreground">{p.fixedAmount}</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-payment-amount">
                      {formatCryptoAmount(fixedCryptoAmountUsdt)} USDT
                    </p>
                    <p className="text-xs text-muted-foreground">
                      = {formatAmount(amountInXAF, "XAF")}
                    </p>
                    {fixedCryptoAmountUsdt > 0 && fixedCryptoAmountUsdt < 1 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                        {p.minimumCryptoWarning}
                      </p>
                    )}
                  </div>
                )}

                {/* ── Customer identity ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prénom *</label>
                    <Input
                      type="text"
                      placeholder="Ada"
                      value={cryptoFirstName}
                      onChange={(e) => { setCryptoFirstName(e.target.value); setErrors(p => ({...p, cryptoFirstName: undefined as any})); }}
                      className={errors.cryptoFirstName ? "border-red-500" : ""}
                      data-testid="input-crypto-first-name"
                    />
                    {errors.cryptoFirstName && <p className="text-xs text-red-500">{errors.cryptoFirstName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nom *</label>
                    <Input
                      type="text"
                      placeholder="Lovelace"
                      value={cryptoLastName}
                      onChange={(e) => { setCryptoLastName(e.target.value); setErrors(p => ({...p, cryptoLastName: undefined as any})); }}
                      className={errors.cryptoLastName ? "border-red-500" : ""}
                      data-testid="input-crypto-last-name"
                    />
                    {errors.cryptoLastName && <p className="text-xs text-red-500">{errors.cryptoLastName}</p>}
                  </div>
                </div>

                {/* ── Email ── */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.email} *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrors(p => ({...p, email: undefined as any})); }}
                      className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
                      data-testid="input-email"
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>

                {/* ── Refund address (collapsible) ── */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPayRefundField(v => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    {showPayRefundField ? "▲" : "▼"} {p.refundAddress} ({p.optional})
                  </button>
                  {showPayRefundField && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {p.refundHint}
                      </p>
                      <input
                        type="text"
                        placeholder="0x... ou adresse crypto"
                        value={payCryptoRefundAddress}
                        onChange={e => setPayCryptoRefundAddress(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  )}
                </div>

                {/* ── Generate button ── */}
                <Button
                  className="w-full h-12 rounded-xl font-bold"
                  size="lg"
                  onClick={() => {
                    const errs: Record<string, string> = {};
                     if (!cryptoFirstName.trim()) errs.cryptoFirstName = "Le prénom est obligatoire.";
                     if (!cryptoLastName.trim()) errs.cryptoLastName = "Le nom est obligatoire.";
                    if (!email.trim()) errs.email = p.errEmail;
                    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = p.errEmailInvalid;
                    if (!country) errs.country = p.errCountry;
                    if (Object.keys(errs).length > 0) { setErrors(prev => ({ ...prev, ...errs })); return; }
                    generatePayLinkCryptoMutation.mutate();
                  }}
                  disabled={generatePayLinkCryptoMutation.isPending || (
                    (paymentLink.isFixedAmount && fixedCryptoAmountUsdt < 1) ||
                    (!paymentLink.isFixedAmount &&
                      (!payCryptoMinimumAmount || payCryptoUsdtEquivalent < 1))
                  )}
                  data-testid="button-pay"
                >
                  {generatePayLinkCryptoMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{p.generatingAddress}</>
                    : <><Bitcoin className="w-4 h-4 mr-2" />{p.generateAddress}</>
                  }
                </Button>
              </>
            ) : paymentMethod === "crypto" && !cryptoAssetsLoading ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {p.noCryptoNetwork}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* ── Amount (non-crypto) ── */}
                {paymentLink.isFixedAmount ? (
                  <div className="space-y-3">
                    <div className="bg-muted/30 border border-border rounded-xl p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-1">{p.amountToPay}</p>
                      <p className="text-3xl font-bold text-foreground" data-testid="text-payment-amount">
                        {formatAmount(convertedDisplayAmount, selectedDisplayCurrency)}
                      </p>
                      {selectedDisplayCurrency !== linkCurrency && (adminExchangeRates[selectedDisplayCurrency] || 0) > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">= {formatAmount(displayAmount, linkCurrency)}</p>
                      )}
                    </div>
                    {errors.amount && <p className="text-xs text-red-500 text-center">{errors.amount}</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="amount">{p.amountToPayCurrency} ({CURRENCY_SYMBOLS[selectedDisplayCurrency]}) *</Label>
                    <Input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      placeholder={p.enterAmount}
                      value={customAmount}
                      onChange={(e) => { setCustomAmount(e.target.value); setErrors(p => ({...p, amount: undefined as any})); }}
                      className={`text-xl h-12 text-center ${errors.amount ? "border-red-500" : ""}`}
                      data-testid="input-payment-amount"
                    />
                    {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                    {selectedDisplayCurrency !== linkCurrency && customAmount && (adminExchangeRates[selectedDisplayCurrency] || 0) > 0 && (
                      <p className="text-xs text-muted-foreground text-center">≈ {formatAmount(amountInLinkCurrency, linkCurrency)}</p>
                    )}
                  </div>
                )}

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">{p.fullName} *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder={p.fullNamePlaceholder}
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); setErrors(p => ({...p, fullName: undefined as any})); }}
                      className={`pl-10 ${errors.fullName ? "border-red-500" : ""}`}
                      data-testid="input-full-name"
                    />
                  </div>
                  {errors.fullName && <p className="text-xs text-red-500">{errors.fullName}</p>}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrors(p => ({...p, email: undefined as any})); }}
                      className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
                      data-testid="input-email"
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone">{p.phone} *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="text"
                      inputMode="numeric"
                      placeholder={p.phonePlaceholder}
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setErrors(p => ({...p, phone: undefined as any})); }}
                      className={`pl-10 ${errors.phone ? "border-red-500" : ""}`}
                      data-testid="input-phone"
                    />
                  </div>
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                </div>

                {/* Summary */}
                <div className="rounded-lg border bg-primary/5 border-primary/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{p.totalAmount}</span>
                    <span className="text-2xl font-bold text-primary" data-testid="text-payment-amount">
                      {formatAmount(paymentLink.isFixedAmount ? convertedDisplayAmount : displayAmount, selectedDisplayCurrency)}
                    </span>
                  </div>
                </div>

                {/* Submit */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePayClick}
                  disabled={payMutation.isPending}
                  data-testid="button-pay"
                >
                  {payMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{p.processing}</>
                  ) : (
                    <><Shield className="w-4 h-4 mr-2" />{p.payNow}</>
                  )}
                </Button>
              </>
            )}
            
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>{p.securePayment}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Footer p={p} />
    </div>
  );
}

function Footer({ p }: { p: { poweredBy: string; discover: string; secureLabel: string } }) {
  return (
    <footer className="border-t border-border bg-white/70 py-6 px-4">
      <div className="max-w-lg mx-auto text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.png" alt="AshTech Pay" className="h-20 w-auto" />
        </div>
        <p className="text-sm text-muted-foreground">
          {p.poweredBy} <span className="font-semibold text-foreground">Ashtech Pay</span>
        </p>
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-2">
            <ExternalLink className="w-4 h-4" />
            {p.discover}
          </Button>
        </Link>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{p.secureLabel}</span>
          <span>•</span>
          <span>© 2026 Ashtech Pay</span>
        </div>
      </div>
    </footer>
  );
}
