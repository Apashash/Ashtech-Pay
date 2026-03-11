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
import { CreditCard, Loader2, Globe, AlertCircle, Phone, CheckCircle, XCircle, ArrowLeft, ArrowRight, Smartphone } from "lucide-react";
import { z } from "zod";
import { useState, useEffect, useMemo, useRef } from "react";
import { formatCurrency } from "@/lib/currency";
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
  ashtechMargin?: number;
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

    const isAfribaPay = (selectedOperator.paymentProvider || "swychr") === "afribapay";

    let feePercentage = 0;
    let fee = 0;

    if (isAfribaPay) {
      const afribapayFee = selectedOperator.afribapayFee || 3;
      const ashtechMargin = selectedOperator.ashtechMargin || 2;
      feePercentage = afribapayFee + ashtechMargin;
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
    };
  }, [watchedAmount, selectedOperator]);

  useEffect(() => {
    if (watchedCountryId !== prevCountryId) {
      form.setValue("operatorId", "");
      setPrevCountryId(watchedCountryId);
    }
  }, [watchedCountryId, prevCountryId, form]);

  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      const res = await apiRequest("POST", "/api/deposits", {
        amount: data.amount,
        paymentMethod: "mobile_money",
        operatorId: data.operatorId,
        countryId: data.countryId,
        phoneNumber: data.phoneNumber,
        description: data.description,
      });
      return res.json();
    },
    onSuccess: (data) => {
      // If Swychr returns a checkout URL, redirect to the hosted payment page
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      
      const ref = data.reference || data.transaction?.reference || "";
      setShowValidationMessage(true);
      setDepositReference(ref);
      setPaymentStatus("pending");
      setCountdown(8 * 60);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
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
      }, 5000);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
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
                  {paymentStatus === "pending" && (
                    <>
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Validation en cours...</h3>
                        <p className="text-muted-foreground">
                          Veuillez valider le paiement sur votre téléphone.
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
                              <FormLabel>Pays</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-country" className="h-12">
                                    <Globe className="w-4 h-4 text-muted-foreground mr-2" />
                                    <SelectValue placeholder="Sélectionner un pays" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {countries.map((country) => (
                                    <SelectItem key={country.id} value={country.id}>
                                      {country.name} ({country.code})
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
                              <FormLabel>Opérateur</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                value={field.value}
                                disabled={!selectedCountry || selectedCountry.operators.length === 0}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-operator" className="h-12">
                                    <Smartphone className="w-4 h-4 text-muted-foreground mr-2" />
                                    <SelectValue placeholder={
                                      !selectedCountry 
                                        ? "Choisir un pays d'abord" 
                                        : selectedCountry.operators.length === 0 
                                          ? "Aucun opérateur disponible"
                                          : "Sélectionner un opérateur"
                                    } />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {selectedCountry?.operators.map((operator) => (
                                    <SelectItem key={operator.id} value={operator.id}>
                                      {operator.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

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
                            size="lg"
                            onClick={goToPreviousStep}
                          >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Retour
                          </Button>
                          <Button 
                            type="submit" 
                            className="flex-1" 
                            size="lg" 
                            disabled={depositMutation.isPending} 
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
