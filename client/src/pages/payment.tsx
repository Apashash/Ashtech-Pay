import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { PaymentLink, SupportedCurrency } from "@shared/schema";
import { CURRENCY_SYMBOLS, EXCHANGE_RATES, SUPPORTED_CURRENCIES } from "@shared/schema";
import { 
  Loader2, CheckCircle, XCircle, Shield, 
  Smartphone, CreditCard, ExternalLink, FileText, AlertTriangle, Globe,
  ArrowLeft, ArrowRight, User, Mail, Phone
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { SiPaypal } from "react-icons/si";
import logoImage from "@assets/image_1768087588517.png";
import { Progress } from "@/components/ui/progress";

const CURRENCY_FLAGS: Record<SupportedCurrency, string> = {
  "XAF": "🇨🇲",
  "XOF": "🇸🇳", 
  "CDF": "🇨🇩",
  "USD": "🇺🇸",
  "EUR": "🇪🇺",
};

interface CountryConfig {
  id: string;
  name: string;
  code: string;
  flag: string;
  currency: string;
  exchangeRate: number;
  operators: {
    id: string;
    name: string;
    gateway: "soleapay" | "winipay";
    feePercentage: number;
    feeFixed: number;
  }[];
}

interface DepositConfigResponse {
  countries: CountryConfig[];
  exchangeRates: Record<string, number>;
}

function formatAmount(amount: number, currency: SupportedCurrency): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: currency === "USD" || currency === "EUR" ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
  
  if (currency === "USD" || currency === "EUR") {
    return `${symbol}${formatted}`;
  }
  return `${formatted} ${symbol}`;
}

const STEPS = [
  { id: 1, title: "Informations", description: "Vos coordonnées" },
  { id: 2, title: "Pays & Opérateur", description: "Mode de paiement" },
  { id: 3, title: "Confirmation", description: "Valider le paiement" },
];

export default function PaymentPage() {
  const [, params] = useRoute("/pay/:slug");
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const { data: paymentLink, isLoading, error } = useQuery<PaymentLink & { hasPdf?: boolean }>({
    queryKey: ["/api/payment-links/public", params?.slug],
    queryFn: async () => {
      const res = await fetch(`/api/payment-links/public/${params?.slug}`);
      if (!res.ok) throw new Error("Lien de paiement introuvable");
      return res.json();
    },
    enabled: !!params?.slug,
  });

  const { data: depositConfigData } = useQuery<DepositConfigResponse>({
    queryKey: ["/api/public/deposit-config"],
  });
  
  const depositConfig = depositConfigData?.countries || [];
  const adminExchangeRates = depositConfigData?.exchangeRates || { XAF: 1, XOF: 1 };

  const linkCurrency = useMemo(() => {
    return (paymentLink?.currency as SupportedCurrency) || "XAF";
  }, [paymentLink]);

  const selectedCountryData = useMemo(() => {
    return depositConfig.find(c => c.id === country);
  }, [depositConfig, country]);

  const countryCurrency = useMemo(() => {
    if (selectedCountryData?.currency) {
      return selectedCountryData.currency as SupportedCurrency;
    }
    return linkCurrency;
  }, [selectedCountryData, linkCurrency]);

  const selectedDisplayCurrency = useMemo(() => {
    return displayCurrency || linkCurrency;
  }, [displayCurrency, linkCurrency]);

  const displayAmount = useMemo(() => {
    if (!paymentLink) return 0;
    if (paymentLink.isFixedAmount) {
      return parseFloat(paymentLink.amount);
    }
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

  const operators = useMemo(() => {
    return selectedCountryData?.operators || [];
  }, [selectedCountryData]);

  const selectedOperatorData = useMemo(() => {
    return operators.find(o => o.id === operator);
  }, [operators, operator]);

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payment-links/${params?.slug}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          country,
          phone,
          amount: paymentLink?.isFixedAmount ? paymentLink.amount : amountInLinkCurrency.toString(),
          paymentMethod,
          operator: paymentMethod === "mobile_money" ? operator : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur de paiement");
      return data;
    },
    onSuccess: async (data) => {
      // If WinniPay returns a checkout URL, redirect to it
      if (data.checkoutUrl && data.gateway === "winipay") {
        window.location.href = data.checkoutUrl;
        return;
      }
      
      const ref = data.reference || "";
      setPaymentComplete(true);
      setPaymentReference(ref);
      setCountdown(8 * 60);
      toast({
        title: "Paiement initié",
        description: data.message,
      });
      
      // Start countdown timer directly
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
      
      // Start polling for payment status
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
        } catch (e) {
          console.error("Error checking payment status:", e);
        }
      }, 5000);
      
      if (ref && paymentLink?.hasPdf) {
        try {
          const pdfRes = await fetch(`/api/payment-links/${params?.slug}/download-pdf/${ref}`);
          if (pdfRes.ok) {
            const pdfData = await pdfRes.json();
            if (pdfData.pdfPath) {
              setPdfDownloadUrl(pdfData.pdfPath);
            }
          }
        } catch (e) {
          console.error("Failed to fetch PDF download URL", e);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [step1Errors, setStep1Errors] = useState<{fullName?: string; email?: string; phone?: string; amount?: string}>({});

  const validateStep1 = () => {
    const errors: typeof step1Errors = {};
    if (!fullName.trim()) errors.fullName = "Le nom est requis";
    if (!email.trim()) errors.email = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Email invalide";
    if (!paymentLink?.isFixedAmount && (!customAmount || parseFloat(customAmount) <= 0)) {
      errors.amount = "Le montant doit être supérieur à 0";
    }
    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const [step3Errors, setStep3Errors] = useState<{phone?: string}>({});

  const validateStep3 = () => {
    const errors: typeof step3Errors = {};
    if (!phone.trim()) errors.phone = "Le numéro est requis";
    else if (phone.replace(/\s/g, "").length < 8) errors.phone = "Numéro trop court";
    setStep3Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const canProceedToStep2 = useMemo(() => {
    if (!fullName || !email) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    if (!paymentLink?.isFixedAmount && (!customAmount || displayAmount <= 0)) return false;
    return true;
  }, [fullName, email, paymentLink, customAmount, displayAmount]);

  const canProceedToStep3 = useMemo(() => {
    if (!country || !paymentMethod) return false;
    if (paymentMethod === "mobile_money") {
      if (!operator) return false;
      if (operators.length === 0) return false;
    }
    return true;
  }, [country, paymentMethod, operator, operators]);

  const canSubmit = useMemo(() => {
    if (!phone.trim() || phone.replace(/\s/g, "").length < 8) return false;
    return canProceedToStep2 && canProceedToStep3 && paymentMethod === "mobile_money";
  }, [canProceedToStep2, canProceedToStep3, paymentMethod, phone]);

  // Cleanup on unmount only
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

  const goToNextStep = () => {
    if (currentStep === 1) {
      const isValid = validateStep1();
      if (!isValid) return;
    }
    if (currentStep === 2 && paymentMethod === "mobile_money") {
      // If WinniPay, skip step 3 and call API directly (no phone number needed upfront)
      if (selectedOperatorData?.gateway === "winipay") {
        payMutation.mutate();
        return;
      }
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setPaymentComplete(false);
    setPaymentStatus("pending");
    setPaymentReference("");
    setFullName("");
    setEmail("");
    setPhone("");
    setCustomAmount("");
    setCountry("");
    setOperator("");
    setPaymentMethod("");
    setStep1Errors({});
  };

  const progressPercentage = (currentStep / 3) * 100;

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
              <p className="text-muted-foreground mb-6">
                Ce lien de paiement n'existe pas ou a expiré.
              </p>
              <Link href="/">
                <Button variant="outline">Retour à l'accueil</Button>
              </Link>
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
              {paymentStatus === "pending" && (
                <>
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Validation en cours...</h2>
                  <p className="text-muted-foreground">
                    Veuillez valider le paiement sur votre téléphone.
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
                  <p className="text-muted-foreground">
                    Votre paiement a été reçu avec succès. Merci pour votre confiance !
                  </p>
                </>
              )}
              
              {paymentStatus === "failed" && (
                <>
                  <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                  <h2 className="text-xl font-bold text-foreground">Paiement échoué</h2>
                  <p className="text-muted-foreground">
                    Le paiement n'a pas pu être confirmé. Veuillez réessayer ou contacter le support.
                  </p>
                  <Button 
                    onClick={resetWizard}
                    className="mt-4"
                  >
                    Réessayer
                  </Button>
                </>
              )}
              
              {paymentReference && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Référence</p>
                  <p className="font-mono font-bold text-foreground">{paymentReference}</p>
                </div>
              )}
              <div className="text-2xl font-bold text-primary">
                {formatAmount(displayAmount, selectedDisplayCurrency)}
              </div>
              
              {paymentLink?.hasPdf && paymentStatus === "success" && (
                <div className="pt-4 border-t">
                  {pdfDownloadUrl ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">
                        Votre document est prêt à télécharger
                      </p>
                      <a 
                        href={pdfDownloadUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <Button className="gap-2">
                          <FileText className="w-4 h-4" />
                          Télécharger le PDF
                        </Button>
                      </a>
                    </>
                  ) : (
                    <div className="text-sm text-amber-500 bg-amber-500/10 p-3 rounded-lg">
                      <p className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Le PDF sera disponible après confirmation de votre paiement
                      </p>
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
        <img src={logoImage} alt="Ashtech Pay Afrique" className="h-12 object-contain" data-testid="img-logo" />
        <Select value={displayCurrency || linkCurrency} onValueChange={(val) => setDisplayCurrency(val as SupportedCurrency)}>
          <SelectTrigger className="w-auto gap-2 bg-muted/50 border-border">
            <Globe className="w-4 h-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((curr) => (
              <SelectItem key={curr} value={curr}>
                {CURRENCY_FLAGS[curr]} {curr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>
      
      <div className="flex-1 flex items-start justify-center p-4 relative z-10">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center space-y-3 pb-4">
            <CardTitle className="text-2xl" data-testid="text-payment-title">
              {paymentLink.title}
            </CardTitle>
            <CardDescription>
              Suivez les étapes pour effectuer votre paiement
            </CardDescription>
            
            {paymentLink.imagePath && (
              <div className="w-full rounded-lg overflow-hidden border border-border">
                <img 
                  src={paymentLink.imagePath} 
                  alt={paymentLink.title}
                  className="w-full h-48 object-cover"
                />
              </div>
            )}
            
            {paymentLink.description && (
              <p className="text-muted-foreground text-sm">{paymentLink.description}</p>
            )}

            {paymentLink.hasPdf && (
              <div className="flex items-center gap-2 text-amber-500 text-sm bg-amber-500/10 p-2 rounded-lg">
                <FileText className="w-4 h-4" />
                <span>Un document PDF sera disponible après le paiement</span>
              </div>
            )}

            <div className="pt-4">
              <div className="flex justify-between text-sm mb-2">
                {STEPS.map((step) => (
                  <div 
                    key={step.id} 
                    className={`flex flex-col items-center ${
                      step.id === currentStep 
                        ? "text-primary font-medium" 
                        : step.id < currentStep 
                          ? "text-green-500" 
                          : "text-muted-foreground"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                      step.id === currentStep 
                        ? "bg-primary text-primary-foreground" 
                        : step.id < currentStep 
                          ? "bg-green-500 text-white" 
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {step.id < currentStep ? <CheckCircle className="w-4 h-4" /> : step.id}
                    </div>
                    <span className="text-xs hidden sm:block">{step.title}</span>
                  </div>
                ))}
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {currentStep === 1 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="text-center mb-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <User className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold">Vos informations</h3>
                  <p className="text-sm text-muted-foreground">Entrez vos coordonnées et le montant</p>
                </div>

                {paymentLink.isFixedAmount ? (
                  <div className="bg-muted/30 border border-border rounded-xl p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Montant à payer</p>
                    <p className="text-3xl font-bold text-foreground" data-testid="text-payment-amount">
                      {formatAmount(convertedDisplayAmount, selectedDisplayCurrency)}
                    </p>
                    {selectedDisplayCurrency !== linkCurrency && (
                      <p className="text-sm text-muted-foreground mt-1">
                        = {formatAmount(displayAmount, linkCurrency)}
                      </p>
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
                      onChange={(e) => { setCustomAmount(e.target.value); setStep1Errors(prev => ({...prev, amount: undefined})); }}
                      className={`text-xl h-12 text-center ${step1Errors.amount ? "border-red-500" : ""}`}
                      data-testid="input-payment-amount"
                    />
                    {step1Errors.amount && <p className="text-xs text-red-500">{step1Errors.amount}</p>}
                    {selectedDisplayCurrency !== linkCurrency && customAmount && (
                      <p className="text-xs text-muted-foreground text-center">
                        ≈ {formatAmount(amountInLinkCurrency, linkCurrency)}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="fullName">Nom complet *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Votre nom complet"
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); setStep1Errors(prev => ({...prev, fullName: undefined})); }}
                      className={`pl-10 ${step1Errors.fullName ? "border-red-500" : ""}`}
                      data-testid="input-full-name"
                    />
                  </div>
                  {step1Errors.fullName && <p className="text-xs text-red-500">{step1Errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setStep1Errors(prev => ({...prev, email: undefined})); }}
                      className={`pl-10 ${step1Errors.email ? "border-red-500" : ""}`}
                      data-testid="input-email"
                    />
                  </div>
                  {step1Errors.email && <p className="text-xs text-red-500">{step1Errors.email}</p>}
                </div>

                <Button 
                  type="button"
                  className="w-full" 
                  size="lg"
                  onClick={goToNextStep}
                  disabled={!canProceedToStep2}
                >
                  Continuer
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="text-center mb-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Globe className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold">Mode de paiement</h3>
                  <p className="text-sm text-muted-foreground">Choisissez votre pays et opérateur</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Pays *</Label>
                  <Select value={country} onValueChange={(val) => { setCountry(val); setOperator(""); }}>
                    <SelectTrigger data-testid="select-country" className="h-12">
                      <Globe className="w-4 h-4 text-muted-foreground mr-2" />
                      <SelectValue placeholder="Sélectionnez votre pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {depositConfig.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.flag} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Mode de paiement *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={paymentMethod === "mobile_money" ? "default" : "outline"}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                      onClick={() => setPaymentMethod("mobile_money")}
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
                </div>

                {(paymentMethod === "card" || paymentMethod === "paypal") && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-500 text-sm">Non disponible</p>
                      <p className="text-sm text-muted-foreground">
                        {paymentMethod === "card" 
                          ? "Le paiement par carte bancaire n'est pas encore disponible. Veuillez utiliser Mobile Money."
                          : "Le paiement par PayPal n'est pas encore disponible. Veuillez utiliser Mobile Money."
                        }
                      </p>
                    </div>
                  </div>
                )}

                {paymentMethod === "mobile_money" && country && operators.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="operator">Opérateur Mobile Money *</Label>
                    <Select value={operator} onValueChange={setOperator}>
                      <SelectTrigger data-testid="select-operator" className="h-12">
                        <Smartphone className="w-4 h-4 text-muted-foreground mr-2" />
                        <SelectValue placeholder="Sélectionnez votre opérateur" />
                      </SelectTrigger>
                      <SelectContent>
                        {operators.map((op) => (
                          <SelectItem key={op.id} value={op.id}>
                            {op.name}
                            {op.feePercentage > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">({op.feePercentage}%)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {paymentMethod === "mobile_money" && country && operators.length === 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 text-center text-sm text-muted-foreground">
                    Aucun opérateur disponible pour ce pays
                  </div>
                )}

                <div className="flex gap-3">
                  <Button 
                    type="button"
                    variant="outline"
                    className="flex-1" 
                    size="lg"
                    onClick={goToPreviousStep}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour
                  </Button>
                  <Button 
                    type="button"
                    className="flex-1" 
                    size="lg"
                    onClick={goToNextStep}
                    disabled={!canProceedToStep3}
                  >
                    Continuer
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="text-center mb-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                    <CheckCircle className="w-7 h-7 text-green-500" />
                  </div>
                  <h3 className="font-semibold">Confirmez votre paiement</h3>
                  <p className="text-sm text-muted-foreground">Entrez votre numéro et validez</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Numéro de téléphone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+237 6XX XXX XXX"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setStep3Errors(prev => ({...prev, phone: undefined})); }}
                      className={`pl-10 ${step3Errors.phone ? "border-red-500" : ""}`}
                      data-testid="input-phone"
                    />
                  </div>
                  {step3Errors.phone && <p className="text-xs text-red-500">{step3Errors.phone}</p>}
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nom</span>
                    <span className="font-medium">{fullName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{email}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pays</span>
                    <span className="font-medium">{selectedCountryData?.flag} {selectedCountryData?.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Opérateur</span>
                    <span className="font-medium">{selectedOperatorData?.name}</span>
                  </div>
                </div>

                <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">Montant total</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatAmount(displayAmount, selectedDisplayCurrency)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    type="button"
                    variant="outline"
                    className="flex-1" 
                    size="lg"
                    onClick={goToPreviousStep}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour
                  </Button>
                  <Button 
                    className="flex-1" 
                    size="lg"
                    onClick={() => payMutation.mutate()}
                    disabled={payMutation.isPending || !canSubmit}
                    data-testid="button-pay"
                  >
                    {payMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Traitement...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Payer maintenant
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                  <Shield className="w-4 h-4" />
                  <span>Paiement sécurisé - Vos données sont protégées</span>
                </div>
              </div>
            )}
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
          <img src={logoImage} alt="Ashtech Pay" className="h-12 w-auto rounded-lg" />
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
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Paiement sécurisé
          </span>
          <span>•</span>
          <span>© 2026 Ashtech Pay</span>
        </div>
      </div>
    </footer>
  );
}
