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
  Smartphone, CreditCard, ExternalLink, FileText, AlertTriangle, Globe
} from "lucide-react";
import { useState, useMemo } from "react";
import { SiPaypal } from "react-icons/si";
import logoImage from "@assets/image_1768087588517.png";

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

function convertCurrency(amountXAF: number, targetCurrency: SupportedCurrency): number {
  const rate = EXCHANGE_RATES[targetCurrency];
  return amountXAF * rate;
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

  const displayAmount = useMemo(() => {
    if (!paymentLink) return 0;
    const amount = paymentLink.isFixedAmount 
      ? parseFloat(paymentLink.amount) 
      : (customAmount ? parseFloat(customAmount) : 0);
    return amount;
  }, [paymentLink, customAmount]);

  const selectedDisplayCurrency = useMemo(() => {
    return displayCurrency || linkCurrency;
  }, [displayCurrency, linkCurrency]);

  const convertedDisplayAmount = useMemo(() => {
    if (selectedDisplayCurrency === linkCurrency) return displayAmount;
    const linkRate = adminExchangeRates[linkCurrency] || 1;
    const targetRate = adminExchangeRates[selectedDisplayCurrency] || 1;
    const amountInXAF = displayAmount / linkRate;
    return amountInXAF * targetRate;
  }, [displayAmount, selectedDisplayCurrency, linkCurrency, adminExchangeRates]);

  const convertedAmount = useMemo(() => {
    if (!country || countryCurrency === linkCurrency) return null;
    const linkRate = adminExchangeRates[linkCurrency] || 1;
    const countryRate = adminExchangeRates[countryCurrency] || 1;
    const amountInXAF = displayAmount / linkRate;
    return amountInXAF * countryRate;
  }, [displayAmount, countryCurrency, linkCurrency, country, adminExchangeRates]);

  const operators = useMemo(() => {
    return selectedCountryData?.operators || [];
  }, [selectedCountryData]);

  const selectedOperatorData = useMemo(() => {
    return operators.find(o => o.id === operator);
  }, [operators, operator]);

  const feeCalculation = useMemo(() => {
    if (!selectedOperatorData || displayAmount <= 0) return null;
    const feePercent = selectedOperatorData.feePercentage || 0;
    const feeFixed = selectedOperatorData.feeFixed || 0;
    const feeAmount = (displayAmount * feePercent / 100) + feeFixed;
    const totalAmount = displayAmount + feeAmount;
    return { feePercent, feeFixed, feeAmount, totalAmount };
  }, [selectedOperatorData, displayAmount]);

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
          amount: paymentLink?.isFixedAmount ? paymentLink.amount : customAmount,
          paymentMethod,
          operator: paymentMethod === "mobile_money" ? operator : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur de paiement");
      return data;
    },
    onSuccess: async (data) => {
      setPaymentComplete(true);
      setPaymentReference(data.reference || "");
      toast({
        title: "Paiement initié",
        description: data.message,
      });
      
      if (data.reference && paymentLink?.hasPdf) {
        try {
          const pdfRes = await fetch(`/api/payment-links/${params?.slug}/download-pdf/${data.reference}`);
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

  const canSubmit = useMemo(() => {
    if (!fullName || !email || !country || !phone || !paymentMethod) return false;
    if (!paymentLink?.isFixedAmount && (!customAmount || parseFloat(customAmount) <= 0)) return false;
    if (paymentMethod === "mobile_money" && !operator) return false;
    return true;
  }, [fullName, email, country, phone, paymentMethod, operator, paymentLink, customAmount]);

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
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Paiement initié</h2>
              <p className="text-muted-foreground">
                Vous recevrez une demande de paiement sur votre téléphone. Veuillez confirmer le paiement pour finaliser la transaction.
              </p>
              {paymentReference && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Référence</p>
                  <p className="font-mono font-bold text-foreground">{paymentReference}</p>
                </div>
              )}
              <div className="text-2xl font-bold text-primary">
                {formatAmount(displayAmount, linkCurrency)}
              </div>
              
              {paymentLink?.hasPdf && (
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
              Suivez les instructions ci-dessous pour effectuer votre paiement
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
          </CardHeader>
          
          <CardContent className="space-y-4">
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
                  onChange={(e) => setCustomAmount(e.target.value)}
                  data-testid="input-payment-amount"
                />
                {selectedDisplayCurrency !== linkCurrency && customAmount && (
                  <p className="text-xs text-muted-foreground">
                    = {formatAmount(displayAmount, linkCurrency)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet *</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Votre nom complet"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                data-testid="input-full-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Pays *</Label>
              <Select value={country} onValueChange={(val) => { setCountry(val); setOperator(""); }}>
                <SelectTrigger data-testid="select-country">
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
              <Label htmlFor="phone">Numéro de téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+237 6XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
              />
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
                  <SelectTrigger data-testid="select-operator">
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
            
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending || !canSubmit || paymentMethod !== "mobile_money"}
              data-testid="button-pay"
            >
              {payMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement en cours...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Payer {displayAmount > 0 ? formatAmount(displayAmount, linkCurrency) : ""}
                </>
              )}
            </Button>
            
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
              <Shield className="w-4 h-4" />
              <span>Paiement sécurisé - Vos données sont protégées</span>
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
