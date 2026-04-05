import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, SupportedCurrency } from "@shared/schema";
import { CreditCard, Loader2, Globe, AlertCircle, Phone, CheckCircle, XCircle, ArrowLeft, ArrowRight, Smartphone, ExternalLink, Hash } from "lucide-react";
import { getOperatorLogo } from "@/lib/operator-logos";
import { z } from "zod";
import { useState, useEffect, useMemo, useRef } from "react";
import { formatCurrency } from "@/lib/currency";
import { getCountryFlagEmoji } from "@/lib/country-flags";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

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
  pixpayOperatorType?: string; // 'ussd' | 'otp' | 'wave'
  otpUssdCode?: string | null; // USSD code to dial to get OTP (PixPay Orange CI/SN/ML/BF)
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
  countryId: z.string().min(1, "Veuillez sélectionner un pays"),
  operatorId: z.string().min(1, "Veuillez sélectionner un opérateur"),
  phoneNumber: z.string().min(8, "Numéro de téléphone invalide"),
  amount: z.string().min(1, "Montant requis").refine(v => parseFloat(v) > 0, "Le montant doit être supérieur à 0"),
  description: z.string().optional(),
});

type DepositFormData = z.infer<typeof depositFormSchema>;

const STEPS = [
  { id: 1, title: "Montant", description: "Entrez le montant" },
  { id: 2, title: "Pays & Opérateur", description: "Sélectionnez votre pays" },
  { id: 3, title: "Confirmation", description: "Vérifiez et validez" },
];

export default function DepositPage() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [showValidationMessage, setShowValidationMessage] = useState(false);
  const [depositReference, setDepositReference] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "failed">("pending");
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
  
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  
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
    if (amount <= 0 || !selectedOperator) {
      return null;
    }

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
      if (selectedOperator.minFee !== null && fee < (selectedOperator.minFee ?? 0)) {
        fee = selectedOperator.minFee ?? 0;
      }
      if (selectedOperator.maxFee !== null && fee > (selectedOperator.maxFee ?? Infinity)) {
        fee = selectedOperator.maxFee ?? fee;
      }
    }

    const creditedAmount = amount - fee;

    return {
      amount,
      fee,
      creditedAmount: creditedAmount > 0 ? creditedAmount : 0,
      feePercentage,
      fixedFee: selectedOperator.fixedFee || 0,
      isAfribaPay,
      isPixPay,
    };
  }, [watchedAmount, selectedOperator]);

  useEffect(() => {
    if (watchedCountryId !== prevCountryId) {
      form.setValue("operatorId", "");
      setPrevCountryId(watchedCountryId);
    }
  }, [watchedCountryId, prevCountryId, form]);

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
        const res = await fetch(`/api/transactions/status/${ref}`);
        if (res.ok) {
          const statusData = await res.json();
          if (statusData.status === "completed") {
            setPaymentStatus("success");
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pollingRef.current) clearInterval(pollingRef.current);
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          } else if (statusData.status === "failed") {
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
      try {
        await apiRequest("POST", `/api/transactions/cancel/${depositReference}`, {});
      } catch {}
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
      // For PixPay OTP operators, include the OTP code in the initial call
      if (isPixPayOtp && pixpayOtpCode) {
        payload.pixpayOtp = pixpayOtpCode;
      }
      const res = await apiRequest("POST", "/api/deposits", payload);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      
      const ref = data.reference || data.transaction?.reference || "";
      setShowValidationMessage(true);
      setDepositReference(ref);
      setPaymentStatus("pending");
      setOtpCode("");
      setWaveUrl(null);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

      if (data.waveUrl) {
        // Wave flow: show Wave link, start polling in background
        setWaveUrl(data.waveUrl);
        setOtpRequired(false);
        startDepositPolling(ref);
      } else if (data.otpRequired) {
        // OTP flow: wait for user to enter OTP before polling
        setOtpRequired(true);
        setOtpType(data.otpType || "api");
        setOtpUssdCode(data.ussdCode || "");
      } else {
        // USSD flow: start countdown + polling immediately
        setOtpRequired(false);
        startDepositPolling(ref);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const otpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deposits/confirm-otp", {
        ref: depositReference,
        otpCode,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Code OTP invalide");
      }
      return res.json();
    },
    onSuccess: () => {
      setOtpRequired(false);
      toast({ title: "OTP validé", description: "Paiement en cours de traitement…" });
      startDepositPolling(depositReference);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur OTP", description: error.message, variant: "destructive" });
    },
  });

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

  const handleSubmit = (data: DepositFormData) => {
    setShowValidationMessage(false);
    depositMutation.mutate(data);
  };

  const canProceedToStep2 = useMemo(() => {
    const amount = parseFloat(watchedAmount) || 0;
    return amount > 0;
  }, [watchedAmount]);

  const canProceedToStep3 = useMemo(() => {
    if (!watchedCountryId || !watchedOperatorId) return false;
    if (selectedCountry && selectedCountry.operators.length === 0) return false;
    return true;
  }, [watchedCountryId, watchedOperatorId, selectedCountry]);

  const goToNextStep = async () => {
    if (currentStep === 1) {
      const isValid = await form.trigger(["amount"]);
      if (!isValid) return;
    }
    if (currentStep === 2) {
      const isValid = await form.trigger(["countryId", "operatorId"]);
      if (!isValid) return;
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

  const progressPercentage = (currentStep / 3) * 100;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recharger mon compte</h1>
          <p className="text-muted-foreground">Ajoutez de l'argent à votre portefeuille via Mobile Money</p>
        </div>

        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Solde actuel</p>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(user?.balance || "0", (user?.preferredCurrency || "XAF") as SupportedCurrency)}</p>
          </CardContent>
        </Card>

        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !countries?.length ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aucun pays ou opérateur n'est actuellement disponible. Veuillez réessayer plus tard.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Nouveau dépôt
              </CardTitle>
              <CardDescription>Suivez les étapes pour recharger votre compte</CardDescription>
              
              {!showValidationMessage && (
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
              )}
            </CardHeader>
            <CardContent>
              {showValidationMessage ? (
                <div className="text-center py-8 space-y-4">
                  {paymentStatus === "pending" && otpRequired && (
                    <>
                      <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Phone className="w-8 h-8 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Code OTP requis</h3>
                        {otpType === "ussd" && otpUssdCode ? (
                          <div className="space-y-3">
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
                            Un code OTP a été envoyé par SMS sur votre téléphone. Entrez-le ci-dessous pour valider votre paiement.
                          </p>
                        )}
                      </div>
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
                      {depositReference && (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">Référence</p>
                          <p className="font-mono font-bold text-foreground">{depositReference}</p>
                        </div>
                      )}
                    </>
                  )}

                  {paymentStatus === "pending" && !otpRequired && waveUrl && (
                    <>
                      <div className="w-20 h-20 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
                        <img src="https://wave.com/favicon.ico" alt="Wave" className="w-10 h-10 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Paiement Wave</h3>
                        <p className="text-muted-foreground text-sm">
                          Cliquez sur le bouton ci-dessous pour ouvrir l'interface Wave et confirmer votre paiement. Revenez ensuite sur cette page.
                        </p>
                      </div>
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
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Attente de confirmation Wave…</span>
                      </div>
                      {depositReference && (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">Référence</p>
                          <p className="font-mono font-bold text-foreground">{depositReference}</p>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelDeposit}
                        disabled={isCancelling}
                        data-testid="button-cancel-deposit-wave"
                        className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Annuler le paiement
                      </Button>
                    </>
                  )}

                  {paymentStatus === "pending" && !otpRequired && !waveUrl && (
                    <>
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Validation en cours...</h3>
                        <p className="text-muted-foreground">
                          Validez le paiement sur votre téléphone via USSD.
                        </p>
                        <p className="text-sm text-muted-foreground mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                          ⏱ Le traitement peut prendre <strong>1 à 5 minutes</strong>. La page se mettra à jour automatiquement dès que le paiement est confirmé.
                        </p>
                        <p className="text-sm text-muted-foreground mt-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                          ✅ Si vous avez déjà confirmé le paiement sur votre téléphone, vous pouvez quitter cette page. Le reste du traitement se fait en arrière-plan et votre solde sera crédité automatiquement.
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 inline-block">
                        <p className="text-sm text-muted-foreground mb-1">Temps restant</p>
                        <p className="text-2xl font-mono font-bold text-red-500">{formatCountdown(countdown)}</p>
                      </div>
                      {depositReference && (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">Référence</p>
                          <p className="font-mono font-bold text-foreground">{depositReference}</p>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelDeposit}
                        disabled={isCancelling}
                        data-testid="button-cancel-deposit"
                        className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Annuler le paiement
                      </Button>
                    </>
                  )}
                  
                  {paymentStatus === "success" && (
                    <>
                      <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Dépôt confirmé</h3>
                        <p className="text-muted-foreground">
                          Votre dépôt a été crédité sur votre compte avec succès !
                        </p>
                      </div>
                      {depositReference && (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">Référence</p>
                          <p className="font-mono font-bold text-foreground">{depositReference}</p>
                        </div>
                      )}
                      <Button 
                        variant="outline" 
                        onClick={resetWizard}
                        data-testid="button-new-deposit"
                      >
                        Faire un nouveau dépôt
                      </Button>
                    </>
                  )}
                  
                  {paymentStatus === "failed" && (
                    <>
                      <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                        <XCircle className="w-8 h-8 text-red-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Dépôt échoué</h3>
                        <p className="text-muted-foreground">
                          Le paiement n'a pas pu être confirmé. Veuillez réessayer.
                        </p>
                      </div>
                      {depositReference && (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">Référence</p>
                          <p className="font-mono font-bold text-foreground">{depositReference}</p>
                        </div>
                      )}
                      <Button 
                        onClick={() => {
                          setShowValidationMessage(false);
                          setPaymentStatus("pending");
                          setDepositReference("");
                        }}
                        data-testid="button-retry-deposit"
                      >
                        Réessayer
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                    {currentStep === 1 && (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <CreditCard className="w-8 h-8 text-primary" />
                          </div>
                          <h3 className="text-lg font-semibold">Quel montant souhaitez-vous déposer ?</h3>
                          <p className="text-sm text-muted-foreground">Entrez le montant souhaité</p>
                        </div>

                        <FormField
                          control={form.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Montant ({user?.preferredCurrency || "XAF"})</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="10000" 
                                  className="text-2xl h-14 text-center"
                                  {...field} 
                                  data-testid="input-deposit-amount"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

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
                      <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <Globe className="w-8 h-8 text-primary" />
                          </div>
                          <h3 className="text-lg font-semibold">Sélectionnez votre pays et opérateur</h3>
                          <p className="text-sm text-muted-foreground">Choisissez votre fournisseur Mobile Money</p>
                        </div>

                        <FormField
                          control={form.control}
                          name="countryId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Choisir le pays</FormLabel>
                              <Select onValueChange={(val) => { field.onChange(val); form.setValue("operatorId", ""); }} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-country" className="h-14">
                                    {selectedCountry ? (
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xl shrink-0">
                                          {getCountryFlagEmoji(selectedCountry.code)}
                                        </span>
                                        <span className="font-semibold truncate">{selectedCountry.name}</span>
                                        <span className="text-muted-foreground text-sm shrink-0">({selectedCountry.currency})</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">Sélectionner un pays</span>
                                    )}
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {countries.map((country) => (
                                    <SelectItem key={country.id} value={country.id}>
                                      <span className="flex items-center gap-2">
                                        <span>{getCountryFlagEmoji(country.code)}</span>
                                        <span>{country.name}</span>
                                        <span className="text-muted-foreground text-xs">({country.currency})</span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="operatorId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Opérateur Mobile Money</FormLabel>
                              {!selectedCountry ? (
                                <p className="text-sm text-muted-foreground py-2">Choisissez un pays d'abord</p>
                              ) : selectedCountry.operators.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">Aucun opérateur disponible</p>
                              ) : (
                                <div className="w-full overflow-hidden">
                                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                                  {selectedCountry.operators.map((op) => {
                                    const logo = getOperatorLogo(op.name);
                                    const isSelected = field.value === op.id;
                                    return (
                                      <button
                                        key={op.id}
                                        type="button"
                                        data-testid={`button-operator-${op.id}`}
                                        onClick={() => field.onChange(op.id)}
                                        className={`flex-shrink-0 flex flex-col items-center justify-center gap-2 w-28 h-24 rounded-xl border-2 transition-all cursor-pointer ${
                                          isSelected
                                            ? "border-primary bg-primary/10 shadow-sm"
                                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                                        }`}
                                      >
                                        {logo ? (
                                          <img src={logo} alt={op.name} className="w-12 h-12 object-contain rounded-lg" />
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
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex gap-3">
                          <Button 
                            type="button"
                            variant="outline"
                            className="flex-1" 
                            size="md"
                            onClick={goToPreviousStep}
                          >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Retour
                          </Button>
                          <Button 
                            type="button"
                            className="flex-1" 
                            size="md"
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
                      <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                          </div>
                          <h3 className="text-lg font-semibold">Confirmez votre dépôt</h3>
                          <p className="text-sm text-muted-foreground">Entrez votre numéro et validez</p>
                        </div>

                        <FormField
                          control={form.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Numéro de téléphone Mobile Money</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input 
                                    placeholder="6XX XXX XXX"
                                    className="pl-10"
                                    {...field} 
                                    data-testid="input-phone-number"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* PixPay OTP — Orange CI / SN / ML / BF */}
                        {isPixPayOtp && (
                          <div className="rounded-lg border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/30 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 font-semibold text-sm">
                              <Hash className="h-4 w-4 shrink-0" />
                              Code OTP requis — Orange Money
                            </div>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              Composez <code className="font-mono bg-orange-200 dark:bg-orange-900 px-1 rounded font-bold">{selectedOperator?.otpUssdCode || "#144*82#"}</code> sur votre téléphone pour obtenir votre code OTP, puis saisissez-le ci-dessous.
                            </p>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={8}
                              placeholder="Votre code OTP"
                              value={pixpayOtpCode}
                              onChange={e => setPixpayOtpCode(e.target.value.replace(/\D/g, ""))}
                              className="text-center text-xl font-mono tracking-widest h-12 border-orange-300"
                              data-testid="input-pixpay-otp"
                            />
                          </div>
                        )}

                        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Pays</span>
                            <span className="font-medium">{selectedCountry?.name}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Opérateur</span>
                            <span className="font-medium">{selectedOperator?.name}</span>
                          </div>
                        </div>

                        {feeCalculation && (
                          <div className="rounded-lg border bg-muted/30 p-4 space-y-3" data-testid="fee-calculator">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Montant saisi</span>
                              <span className="font-medium">{formatCurrency(feeCalculation.amount.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Frais de dépôt {feeCalculation.feePercentage > 0 
                                  ? `(${feeCalculation.feePercentage}%)`
                                  : feeCalculation.fixedFee > 0 ? "(fixe)" : "(Gratuit)"}
                              </span>
                              <span className={`font-medium ${feeCalculation.fee > 0 ? "text-red-500" : "text-green-500"}`}>
                                {feeCalculation.fee > 0 ? `-${formatCurrency(feeCalculation.fee.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency)}` : "0 XAF"}
                              </span>
                            </div>
                            <div className="border-t pt-3 flex items-center justify-between">
                              <span className="font-medium text-foreground">Montant crédité</span>
                              <span className="text-xl font-bold text-green-500" data-testid="credited-amount">
                                {formatCurrency(feeCalculation.creditedAmount.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency)}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <Button 
                            type="button"
                            variant="outline"
                            className="flex-1" 
                            size="md"
                            onClick={goToPreviousStep}
                          >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Retour
                          </Button>
                          <Button 
                            type="submit" 
                            className="flex-1" 
                            size="md" 
                            disabled={depositMutation.isPending || (isPixPayOtp && pixpayOtpCode.length < 4)} 
                            data-testid="button-deposit-confirm"
                          >
                            {depositMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Traitement...
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Confirmer
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
