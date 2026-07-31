declare global { interface Window { IziPay?: { open: (opts: { url: string; container?: string; onSuccess?: () => void; onClose?: () => void; onError?: () => void; onExpired?: () => void }) => { close(): void; getIframe(): HTMLIFrameElement | null } } } }

import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Smartphone, CreditCard, ExternalLink, FileText, AlertTriangle, Globe,
  User, Mail, Phone, Hash, Clock, Copy, Bitcoin, ChevronDown
} from "lucide-react";
import { getOperatorLogo } from "@/lib/operator-logos";
import { useState, useMemo, useEffect, useRef } from "react";
import { SiPaypal } from "react-icons/si";

const CURRENCY_FLAGS: Record<SupportedCurrency, string> = {
  "XAF": "🇨🇲", "XOF": "🇸🇳", "CDF": "🇨🇩", "GHS": "🇬🇭",
  "NGN": "🇳🇬", "KES": "🇰🇪", "RWF": "🇷🇼", "GNF": "🇬🇳",
  "TZS": "🇹🇿", "UGX": "🇺🇬", "INR": "🇮🇳", "USD": "🇺🇸",
};

interface CountryConfig {
  id: string;
  name: string;
  code: string;
  flag: string;
  currency: string;
  exchangeRate: number;
  operators: { id: string; name: string; gateway: string; paymentProvider: string; feePercentage: number; feeFixed: number; afribapayFee?: number; pixpayFee?: number; ashtechMargin?: number; pixpayOperatorType?: string; otpUssdCode?: string | null; }[];
}

interface DepositConfigResponse {
  countries: CountryConfig[];
  exchangeRates: Record<string, number>;
}

function formatAmount(amount: number, currency: string): string {
  const symbol = (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;
  const useDecimals = ["USD", "GHS", "KES", "NGN", "INR", "TZS", "UGX", "RWF", "CDF", "GNF"].includes(currency);
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
  }).format(Math.round(amount));
  if (["USD", "NGN", "GHS", "KES", "INR"].includes(currency)) return `${symbol}${formatted}`;
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
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "card" | "paypal" | "crypto" | "">("");
  const [operator, setOperator] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency | "">("");
  
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "failed">("pending");
  const [failureReason, setFailureReason] = useState<string>("");
  const [countdown, setCountdown] = useState(8 * 60);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpType, setOtpType] = useState<"api" | "ussd">("api");
  const [otpUssdCode, setOtpUssdCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [waveUrl, setWaveUrl] = useState<string | null>(null);
  const [pixpayOtpCode, setPixpayOtpCode] = useState("");
  const [pixpayOtpStep, setPixpayOtpStep] = useState(false);

  const [cryptoPaymentUrl, setCryptoPaymentUrl] = useState<string | null>(null);
  const cryptoSucceededRef = useRef(false);

  const { data: paymentLink, isLoading, error } = useQuery<PaymentLink & { hasPdf?: boolean }>({
    queryKey: ["/api/payment-links/public", params?.slug],
    queryFn: async () => {
      const res = await fetch(`/api/payment-links/public/${params?.slug}`);
      if (!res.ok) throw new Error("Lien de paiement introuvable");
      const data = await res.json();
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
    return allCountries.filter(c => allowed.includes(c.id) || allowed.includes(c.code));
  }, [allCountries, paymentLink]);

  const linkCurrency = useMemo(() => (paymentLink?.currency as SupportedCurrency) || "XAF", [paymentLink]);

  const selectedCountryData = useMemo(() => depositConfig.find(c => c.id === country), [depositConfig, country]);

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

  const startPaymentPolling = (ref: string) => {
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
        const res = await fetch(`/api/transactions/status/${ref}`);
        if (res.ok) {
          const statusData = await res.json();
          if (statusData.status === "completed") {
            setPaymentStatus("success");
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pollingRef.current) clearInterval(pollingRef.current);
            redirectAfterPayment("success", ref);
          } else if (statusData.status === "failed") {
            setFailureReason(parseFailureMessage(statusData.description));
            setPaymentStatus("failed");
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pollingRef.current) clearInterval(pollingRef.current);
            redirectAfterPayment("failed", ref);
          }
        }
      } catch (e) { console.error("Error checking payment status:", e); }
    }, 5000);
  };

  const validatePaymentForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (paymentMethod !== "crypto" && !fullName.trim()) newErrors.fullName = p.errName;
    if (!email.trim()) newErrors.email = p.errEmail;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = p.errEmailInvalid;
    if (!paymentLink?.isFixedAmount && (!customAmount || parseFloat(customAmount) <= 0)) newErrors.amount = p.errAmount;
    if (!paymentMethod) newErrors.paymentMethod = p.errPaymentMethod;
    if (paymentMethod !== "crypto") {
      if (!country) newErrors.country = p.errCountry;
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
      if (!email.trim()) newErrors.email = p.errEmail;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = p.errEmailInvalid;
      if (!paymentLink?.isFixedAmount && (!customAmount || parseFloat(customAmount) <= 0)) newErrors.amount = p.errAmount;
      if (!paymentMethod) newErrors.paymentMethod = p.errPaymentMethod;
      if (paymentMethod !== "crypto") {
        if (!country) newErrors.country = p.errCountry;
        if (paymentMethod === "mobile_money" && !operator) newErrors.operator = p.errOperator;
        if (!phone.trim()) newErrors.phone = p.errPhone;
        else if (phone.replace(/\s/g, "").length < 8) newErrors.phone = p.errPhoneShort;
      }
      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) throw new Error(language === "fr" ? "Veuillez corriger les erreurs ci-dessus" : "Please fix the errors above");

      const isPixpayOtpOp = selectedOperatorData?.paymentProvider === "pixpay" &&
        selectedOperatorData?.pixpayOperatorType === "otp";
      const body: any = {
        fullName: fullName.trim() || email,
        email, country, phone,
        amount: paymentLink?.isFixedAmount ? convertedDisplayAmount.toString() : customAmount,
        currency: selectedDisplayCurrency,
        paymentMethod,
        operator: paymentMethod === "mobile_money" ? operator : null,
      };
      if (isPixpayOtpOp && pixpayOtpCode) {
        body.pixpayOtp = pixpayOtpCode;
      }
      const res = await fetch(`/api/payment-links/${params?.slug}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur de paiement");
      return data;
    },
    onSuccess: async (data) => {
      const ref = data.reference || "";

      // ── Crypto IziChange flow (inline embed — no redirect, no popup) ─────────
      if (data.paymentUrl) {
        setPaymentReference(ref);
        cryptoSucceededRef.current = false;
        setCryptoPaymentUrl(data.paymentUrl); // triggers inline container rendering
        const openInline = () => {
          if (!window.IziPay) { setTimeout(openInline, 300); return; }
          window.IziPay.open({
            url: data.paymentUrl,
            container: "#izipay-payment-checkout",
            onSuccess: () => {
              cryptoSucceededRef.current = true;
              setCryptoPaymentUrl(null);
              setPaymentStatus("success");
              setPaymentComplete(true);
              redirectAfterPayment("success", ref);
            },
            onClose: () => {
              // keep inline container visible until user explicitly cancels
            },
            onError: () => {
              toast({ title: "Erreur de paiement", description: "Le paiement a échoué. Veuillez réessayer.", variant: "destructive" });
              setCryptoPaymentUrl(null);
            },
            onExpired: () => {
              toast({ title: "Paiement expiré", description: "Veuillez réessayer.", variant: "destructive" });
              setCryptoPaymentUrl(null);
            },
          });
        };
        openInline();
        return;
      }

      setPaymentComplete(true);
      setPaymentReference(ref);
      setOtpCode("");
      setWaveUrl(null);
      toast({ title: "Paiement initié", description: data.message });

      if (data.waveUrl) {
        // Wave flow: show Wave link, poll in background
        setWaveUrl(data.waveUrl);
        setOtpRequired(false);
        startPaymentPolling(ref);
      } else if (data.otpRequired) {
        setOtpRequired(true);
        setOtpType(data.otpType || "api");
        setOtpUssdCode(data.ussdCode || "");
      } else {
        setOtpRequired(false);
        startPaymentPolling(ref);
      }

      if (ref && paymentLink?.hasPdf) {
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
      if (error.message !== "Veuillez corriger les erreurs ci-dessus" && error.message !== "Please fix the errors above") {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      }
    },
  });

  const otpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payment-links/${params?.slug}/confirm-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: paymentReference, otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Code OTP invalide");
      return data;
    },
    onSuccess: () => {
      setOtpRequired(false);
      toast({ title: "OTP validé", description: "Paiement en cours de traitement…" });
      startPaymentPolling(paymentReference);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur OTP", description: error.message, variant: "destructive" });
    },
  });

  // Load IziPay embed.js once
  useEffect(() => {
    if (document.querySelector('script[src*="izichange.com/embed.js"]')) return;
    const script = document.createElement("script");
    script.src = "https://checkout.pay.izichange.com/embed.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetForm = () => {
    setPaymentComplete(false);
    setPaymentStatus("pending");
    setPaymentReference("");
    setFailureReason("");
    setFullName(""); setEmail(""); setPhone(""); setCustomAmount("");
    setCountry(""); setOperator(""); setPaymentMethod("");
    setErrors({});
    setOtpRequired(false);
    setOtpCode("");
    setWaveUrl(null);
    cryptoSucceededRef.current = false;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !paymentLink) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-6">
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">{p.linkNotFound}</h2>
              <p className="text-muted-foreground mb-6">{p.linkNotFoundDesc}</p>
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

  // ── Crypto inline checkout (no redirect, no popup) ───────────────────────
  if (cryptoPaymentUrl) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              <span>Chargement du checkout IziChange…</span>
            </div>
            {/* IziChange checkout embedded inline — pas de redirection */}
            <div
              id="izipay-payment-checkout"
              className="w-full rounded-2xl overflow-hidden border border-border bg-white"
              style={{ minHeight: 480 }}
            />
            <button
              className="w-full text-sm text-muted-foreground hover:text-foreground py-2 transition-colors"
              onClick={() => setCryptoPaymentUrl(null)}
            >
              ← Annuler le paiement
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

              {paymentStatus === "pending" && otpRequired && (
                <>
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
                      <span className="font-semibold tabular-nums text-foreground">{countdown}s</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(countdown / (8 * 60)) * 100}%` }}
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
                      <span className="font-semibold tabular-nums text-foreground">{countdown}s</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(countdown / (8 * 60)) * 100}%` }}
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
                      <span className="font-semibold tabular-nums text-foreground">{countdown}s</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(countdown / (8 * 60)) * 100}%` }}
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
      
      <header className="flex justify-between items-center px-5 py-4 relative z-10 border-b border-border/60 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="AshTech Pay" className="h-24 object-contain" data-testid="img-logo" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 border-border bg-muted/50 hover:bg-muted font-medium" data-testid="button-language-selector">
              <Globe className="w-4 h-4 text-primary" />
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
              <span>🇫🇷</span>
              <span>Français</span>
              {language === "fr" && <span className="ml-auto text-primary text-xs">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage("en")}
              className={`flex items-center gap-2 cursor-pointer ${language === "en" ? "font-semibold text-primary" : ""}`}
              data-testid="lang-option-en"
            >
              <span>🇬🇧</span>
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
            <div className="w-full overflow-hidden mt-4">
              <img src={getImageSrc(paymentLink.imagePath)} alt={paymentLink.title} className="w-full h-52 object-cover" data-testid="img-payment-link" />
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
              <Label htmlFor="country">Pays *</Label>
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
                  onClick={() => { setPaymentMethod("crypto"); setErrors(prev => ({...prev, paymentMethod: undefined as any})); }}
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
                          <img src={logo} alt={op.name} className="w-12 h-12 object-contain rounded-lg bg-white" loading="eager" decoding="async" />
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
              </div>
            )}

            {paymentMethod === "mobile_money" && country && operators.length === 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center text-sm text-muted-foreground">
                {p.noOperator}
              </div>
            )}

            {/* Amount */}
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
                  {paymentMethod === "crypto" && (
                    <p className="mt-2 text-xs text-muted-foreground">Paiement via IziChange · Le crypto est sélectionné dans la fenêtre de paiement</p>
                  )}
                </div>
              </div>
            ) : paymentMethod === "crypto" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="amount">{p.amountToPayCurrency} ({CURRENCY_SYMBOLS[selectedDisplayCurrency]}) *</Label>
                  <Input
                    id="amount"
                    type="number"
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
                  <p className="text-xs text-muted-foreground text-center">Paiement via IziChange · Le crypto est sélectionné dans la fenêtre de paiement</p>
                </div>
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

            {/* Name — hidden for crypto */}
            {paymentMethod !== "crypto" && (
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
            )}

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

            {/* Phone — hidden for crypto */}
            {paymentMethod !== "crypto" && (
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
            )}

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
