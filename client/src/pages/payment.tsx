import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { PaymentLink, SupportedCurrency } from "@shared/schema";
import { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } from "@shared/schema";
import { getImageSrc } from "@/lib/image";
import { 
  Loader2, CheckCircle, XCircle, Shield, 
  Smartphone, CreditCard, ExternalLink, FileText, AlertTriangle, Globe,
  User, Mail, Phone, Hash
} from "lucide-react";
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
  operators: { id: string; name: string; gateway: string; paymentProvider: string; feePercentage: number; feeFixed: number; afribapayFee?: number; pixpayFee?: number; ashtechMargin?: number; pixpayOperatorType?: string; }[];
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
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "card" | "paypal" | "">("");
  const [operator, setOperator] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency | "">("");
  
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "failed">("pending");
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
    return allCountries.filter(c => allowed.includes(c.id));
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

  const amountInXAF = useMemo(() => {
    if (!paymentLink) return 0;
    if (paymentLink.isFixedAmount) {
      const linkRate = adminExchangeRates[linkCurrency] || 1;
      return displayAmount / linkRate;
    } else {
      const inputRate = adminExchangeRates[selectedDisplayCurrency] || 1;
      return displayAmount / inputRate;
    }
  }, [paymentLink, displayAmount, linkCurrency, selectedDisplayCurrency, adminExchangeRates]);

  const amountInLinkCurrency = useMemo(() => {
    if (paymentLink?.isFixedAmount) return displayAmount;
    const linkRate = adminExchangeRates[linkCurrency] || 1;
    return amountInXAF * linkRate;
  }, [paymentLink, displayAmount, amountInXAF, linkCurrency, adminExchangeRates]);

  const convertedDisplayAmount = useMemo(() => {
    if (selectedDisplayCurrency === linkCurrency) return displayAmount;
    const targetRate = adminExchangeRates[selectedDisplayCurrency] || 1;
    return amountInXAF * targetRate;
  }, [displayAmount, selectedDisplayCurrency, linkCurrency, amountInXAF, adminExchangeRates]);

  const operators = useMemo(() => selectedCountryData?.operators || [], [selectedCountryData]);
  const selectedOperatorData = useMemo(() => operators.find(o => o.id === operator), [operators, operator]);

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
          } else if (statusData.status === "failed") {
            setPaymentStatus("failed");
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
      } catch (e) { console.error("Error checking payment status:", e); }
    }, 5000);
  };

  const validatePaymentForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = "Le nom est requis";
    if (!email.trim()) newErrors.email = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Email invalide";
    if (!paymentLink?.isFixedAmount && (!customAmount || parseFloat(customAmount) <= 0)) newErrors.amount = "Le montant doit être supérieur à 0";
    if (!country) newErrors.country = "Veuillez sélectionner votre pays";
    if (!paymentMethod) newErrors.paymentMethod = "Veuillez choisir un mode de paiement";
    if (paymentMethod === "mobile_money" && !operator) newErrors.operator = "Veuillez sélectionner un opérateur";
    if (!phone.trim()) newErrors.phone = "Le numéro est requis";
    else if (phone.replace(/\s/g, "").length < 8) newErrors.phone = "Numéro trop court";
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
      if (!fullName.trim()) newErrors.fullName = "Le nom est requis";
      if (!email.trim()) newErrors.email = "L'email est requis";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Email invalide";
      if (!paymentLink?.isFixedAmount && (!customAmount || parseFloat(customAmount) <= 0)) newErrors.amount = "Le montant doit être supérieur à 0";
      if (!country) newErrors.country = "Veuillez sélectionner votre pays";
      if (!paymentMethod) newErrors.paymentMethod = "Veuillez choisir un mode de paiement";
      if (paymentMethod === "mobile_money" && !operator) newErrors.operator = "Veuillez sélectionner un opérateur";
      if (!phone.trim()) newErrors.phone = "Le numéro est requis";
      else if (phone.replace(/\s/g, "").length < 8) newErrors.phone = "Numéro trop court";
      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) throw new Error("Veuillez corriger les erreurs ci-dessus");

      const isPixpayOtpOp = selectedOperatorData?.paymentProvider === "pixpay" &&
        selectedOperatorData?.pixpayOperatorType === "otp";
      const body: any = {
        fullName, email, country, phone,
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
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      const ref = data.reference || "";
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
      if (error.message !== "Veuillez corriger les erreurs ci-dessus") {
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
    setFullName(""); setEmail(""); setPhone(""); setCustomAmount("");
    setCountry(""); setOperator(""); setPaymentMethod("");
    setErrors({});
    setOtpRequired(false);
    setOtpCode("");
    setWaveUrl(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !paymentLink) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-6">
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Lien introuvable</h2>
              <p className="text-muted-foreground mb-6">Ce lien de paiement n'existe pas ou a expiré.</p>
              <Link href="/"><Button variant="outline">Retour à l'accueil</Button></Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (pixpayOtpStep && !paymentComplete) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-8 pb-8 space-y-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/10 flex items-center justify-center">
                <Hash className="w-8 h-8 text-orange-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">Code OTP requis</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Composez{" "}
                  <span className="font-mono font-bold text-orange-500 bg-orange-100 dark:bg-orange-950/40 px-2 py-0.5 rounded">
                    #144*82#
                  </span>{" "}
                  sur votre téléphone pour obtenir votre code OTP, puis saisissez-le ci-dessous.
                </p>
              </div>
              <div className="space-y-4 max-w-xs mx-auto w-full">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="Code OTP"
                  value={pixpayOtpCode}
                  onChange={e => setPixpayOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full text-center text-2xl font-mono tracking-widest h-14 border-2 border-orange-400 rounded-md bg-background text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  data-testid="input-pixpay-otp-step"
                  autoFocus
                />
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  size="lg"
                  onClick={() => payMutation.mutate()}
                  disabled={pixpayOtpCode.length < 4 || payMutation.isPending}
                  data-testid="button-confirm-pixpay-otp"
                >
                  {payMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Traitement...</>
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
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                <Shield className="w-4 h-4" />
                <span>Paiement sécurisé — Vos données sont protégées</span>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (paymentComplete) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-6 space-y-4">
              {paymentStatus === "pending" && otpRequired && (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-amber-500" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Code OTP requis</h2>
                  {otpType === "ussd" && otpUssdCode ? (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-sm">
                        Pour obtenir votre code OTP, composez le code USSD suivant sur votre téléphone :
                      </p>
                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl px-5 py-4 inline-block mx-auto">
                        <p className="text-2xl font-mono font-bold tracking-widest text-amber-700 dark:text-amber-300" data-testid="text-ussd-code">
                          {otpUssdCode}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Après avoir composé ce code, entrez ci-dessous le code OTP reçu.
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Un code OTP a été envoyé par SMS sur votre téléphone. Entrez-le ci-dessous pour confirmer le paiement.
                    </p>
                  )}
                  <div className="space-y-3 w-full max-w-xs mx-auto">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      placeholder="Ex : 123456"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full text-center text-2xl font-mono tracking-widest h-14 border rounded-md bg-background text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-primary"
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
                </>
              )}
              {paymentStatus === "pending" && !otpRequired && waveUrl && (
                <>
                  <div className="w-20 h-20 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
                    <img src="https://wave.com/favicon.ico" alt="Wave" className="w-10 h-10 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Paiement Wave</h2>
                  <p className="text-muted-foreground text-sm">
                    Cliquez sur le bouton ci-dessous pour ouvrir l'interface Wave et confirmer votre paiement. Revenez ensuite sur cette page.
                  </p>
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
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Attente de confirmation Wave…</span>
                  </div>
                </>
              )}
              {paymentStatus === "pending" && !otpRequired && !waveUrl && (
                <>
                  <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
                  <h2 className="text-xl font-bold text-foreground">Validation en cours...</h2>
                  <p className="text-muted-foreground">Validez le paiement sur votre téléphone via USSD.</p>
                  <p className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                    ⏱ Le traitement peut prendre <strong>1 à 5 minutes</strong>. La page se mettra à jour automatiquement dès confirmation.
                  </p>
                  <p className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                    ✅ Si vous avez déjà confirmé le paiement sur votre téléphone, vous pouvez quitter cette page. Le reste du traitement se fait en arrière-plan.
                  </p>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Temps restant</p>
                    <p className="text-2xl font-mono font-bold text-red-500">{formatCountdown(countdown)}</p>
                  </div>
                </>
              )}
              {paymentStatus === "success" && (
                <>
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                  <h2 className="text-xl font-bold text-foreground">Paiement confirmé</h2>
                  <p className="text-muted-foreground">Votre paiement a été reçu avec succès. Merci pour votre confiance !</p>
                </>
              )}
              {paymentStatus === "failed" && (
                <>
                  <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                  <h2 className="text-xl font-bold text-foreground">Paiement échoué</h2>
                  <p className="text-muted-foreground">Le paiement n'a pas pu être confirmé. Veuillez réessayer.</p>
                  <Button onClick={resetForm} className="mt-4">Réessayer</Button>
                </>
              )}
              {paymentReference && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Référence</p>
                  <p className="font-mono font-bold text-foreground">{paymentReference}</p>
                </div>
              )}
              <div className="text-2xl font-bold text-primary">{formatAmount(displayAmount, selectedDisplayCurrency)}</div>
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
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <header className="flex justify-between items-center px-4 py-4 relative z-10">
        <div className="bg-black rounded-xl px-3 py-1.5">
          <img src="/logo.png" alt="Ashtech Pay Afrique" className="h-9 object-contain" data-testid="img-logo" />
        </div>
        <Select value={displayCurrency || linkCurrency} onValueChange={(val) => setDisplayCurrency(val as SupportedCurrency)}>
          <SelectTrigger className="w-auto gap-2 bg-muted/50 border-border">
            <Globe className="w-4 h-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((curr) => (
              <SelectItem key={curr} value={curr}>{CURRENCY_FLAGS[curr]} {curr}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <span>Un lien de téléchargement vous sera envoyé après le paiement</span>
            </div>
          )}
          
          <CardContent className="space-y-5">

            {/* Country — first field */}
            <div className="space-y-2">
              <Label htmlFor="country">Pays *</Label>
              <Select value={country} onValueChange={(val) => { setCountry(val); setOperator(""); setErrors(p => ({...p, country: undefined as any})); }}>
                <SelectTrigger data-testid="select-country" className={`h-12 ${errors.country ? "border-red-500" : ""}`}>
                  <Globe className="w-4 h-4 text-muted-foreground mr-2" />
                  <SelectValue placeholder="Sélectionnez votre pays" />
                </SelectTrigger>
                <SelectContent>
                  {depositConfig.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.flag} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.country && <p className="text-xs text-red-500">{errors.country}</p>}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Mode de paiement *</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === "mobile_money" ? "default" : "outline"}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                  onClick={() => { setPaymentMethod("mobile_money"); setErrors(p => ({...p, paymentMethod: undefined as any})); }}
                  data-testid="button-payment-mobile"
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-xs">Mobile Money</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "card" ? "default" : "outline"}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                  onClick={() => setPaymentMethod("card")}
                  data-testid="button-payment-card"
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs">Carte bancaire</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "paypal" ? "default" : "outline"}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                  onClick={() => setPaymentMethod("paypal")}
                  data-testid="button-payment-paypal"
                >
                  <SiPaypal className="w-5 h-5" />
                  <span className="text-xs">PayPal</span>
                </Button>
              </div>
              {errors.paymentMethod && <p className="text-xs text-red-500">{errors.paymentMethod}</p>}
            </div>

            {(paymentMethod === "card" || paymentMethod === "paypal") && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-500 text-sm">Non disponible</p>
                  <p className="text-sm text-muted-foreground">
                    {paymentMethod === "card"
                      ? "Le paiement par carte bancaire n'est pas encore disponible. Veuillez utiliser Mobile Money."
                      : "Le paiement par PayPal n'est pas encore disponible. Veuillez utiliser Mobile Money."}
                  </p>
                </div>
              </div>
            )}

            {/* Operator */}
            {paymentMethod === "mobile_money" && country && operators.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="operator">Opérateur Mobile Money *</Label>
                <Select value={operator} onValueChange={(val) => { setOperator(val); setErrors(p => ({...p, operator: undefined as any})); }}>
                  <SelectTrigger data-testid="select-operator" className={`h-12 ${errors.operator ? "border-red-500" : ""}`}>
                    <Smartphone className="w-4 h-4 text-muted-foreground mr-2" />
                    <SelectValue placeholder="Sélectionnez votre opérateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.operator && <p className="text-xs text-red-500">{errors.operator}</p>}
              </div>
            )}

            {paymentMethod === "mobile_money" && country && operators.length === 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center text-sm text-muted-foreground">
                Aucun opérateur disponible pour ce pays
              </div>
            )}

            {/* Amount */}
            {paymentLink.isFixedAmount ? (
              <div className="bg-muted/30 border border-border rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Montant à payer</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-payment-amount">
                  {formatAmount(convertedDisplayAmount, selectedDisplayCurrency)}
                </p>
                {selectedDisplayCurrency !== linkCurrency && (
                  <p className="text-sm text-muted-foreground mt-1">= {formatAmount(displayAmount, linkCurrency)}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="amount">Montant à payer ({CURRENCY_SYMBOLS[selectedDisplayCurrency]}) *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Entrez le montant"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setErrors(p => ({...p, amount: undefined as any})); }}
                  className={`text-xl h-12 text-center ${errors.amount ? "border-red-500" : ""}`}
                  data-testid="input-payment-amount"
                />
                {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                {selectedDisplayCurrency !== linkCurrency && customAmount && (
                  <p className="text-xs text-muted-foreground text-center">≈ {formatAmount(amountInLinkCurrency, linkCurrency)}</p>
                )}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Votre nom complet"
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
              <Label htmlFor="phone">Numéro de téléphone Mobile Money *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="XXXX XXX XXX"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setErrors(p => ({...p, phone: undefined as any})); }}
                  className={`pl-10 ${errors.phone ? "border-red-500" : ""}`}
                  data-testid="input-phone"
                />
              </div>
              {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
            </div>

            {/* Summary */}
            <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Montant total</span>
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
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Traitement...</>
              ) : (
                <><Shield className="w-4 h-4 mr-2" />Payer maintenant</>
              )}
            </Button>
            
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Paiement sécurisé — Vos données sont protégées</span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 py-6 px-4">
      <div className="max-w-lg mx-auto text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="bg-black rounded-xl px-3 py-1.5">
            <img src="/logo.png" alt="Ashtech Pay" className="h-9 w-auto" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Propulsé par <span className="font-semibold text-foreground">Ashtech Pay</span>
        </p>
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-2">
            <ExternalLink className="w-4 h-4" />
            Découvrir Ashtech Pay
          </Button>
        </Link>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Shield className="w-3 h-3" />Paiement sécurisé</span>
          <span>•</span>
          <span>© 2026 Ashtech Pay</span>
        </div>
      </div>
    </footer>
  );
}
