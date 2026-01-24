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
import { CreditCard, Loader2, Globe, Smartphone, AlertCircle, Phone, CheckCircle, XCircle } from "lucide-react";
import { z } from "zod";
import { useState, useEffect, useMemo, useRef } from "react";
import { formatCurrency } from "@/lib/currency";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OperatorConfig {
  id: string;
  name: string;
  type: string;
  feePercentage: number;
  fixedFee: number;
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

export default function DepositPage() {
  const { toast } = useToast();
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

    const feePercentage = selectedOperator.feePercentage || 0;
    const fixedFee = selectedOperator.fixedFee || 0;
    
    let fee = 0;
    if (feePercentage > 0) {
      fee = (amount * feePercentage) / 100;
    } else if (fixedFee > 0) {
      fee = fixedFee;
    }
    
    if (selectedOperator.minFee !== null && fee < selectedOperator.minFee) {
      fee = selectedOperator.minFee;
    }
    if (selectedOperator.maxFee !== null && fee > selectedOperator.maxFee) {
      fee = selectedOperator.maxFee;
    }
    
    const creditedAmount = amount - fee;
    
    return {
      amount,
      fee,
      creditedAmount: creditedAmount > 0 ? creditedAmount : 0,
      feePercentage,
      fixedFee,
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
      setShowValidationMessage(true);
      setDepositReference(data.reference || "");
      setPaymentStatus("pending");
      setCountdown(8 * 60);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (showValidationMessage && depositReference && paymentStatus === "pending") {
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
      
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/transactions/status/${depositReference}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === "completed") {
              setPaymentStatus("success");
              if (pollingRef.current) clearInterval(pollingRef.current);
              if (countdownRef.current) clearInterval(countdownRef.current);
              queryClient.invalidateQueries({ queryKey: ["/api/user"] });
              queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            } else if (data.status === "failed") {
              setPaymentStatus("failed");
              if (pollingRef.current) clearInterval(pollingRef.current);
              if (countdownRef.current) clearInterval(countdownRef.current);
            }
          }
        } catch (e) {
          console.error("Error checking deposit status:", e);
        }
      }, 5000);
      
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [showValidationMessage, depositReference, paymentStatus]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = (data: DepositFormData) => {
    setShowValidationMessage(false);
    depositMutation.mutate(data);
  };

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
              <CardDescription>Remplissez les informations pour recharger votre compte</CardDescription>
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
                        <p className="text-2xl font-mono font-bold text-primary">{formatCountdown(countdown)}</p>
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
                        onClick={() => {
                          setShowValidationMessage(false);
                          setPaymentStatus("pending");
                          setDepositReference("");
                          form.reset();
                        }}
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
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="countryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pays</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-country">
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
                                <SelectTrigger data-testid="select-operator">
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
                    </div>

                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro de téléphone</FormLabel>
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

                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Montant (XAF)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="10000" 
                              className="text-2xl h-14"
                              {...field} 
                              data-testid="input-deposit-amount"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {feeCalculation && (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-3" data-testid="fee-calculator">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Montant saisi</span>
                          <span className="font-medium">{formatCurrency(feeCalculation.amount.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Frais de dépôt {feeCalculation.feePercentage > 0 ? `(${feeCalculation.feePercentage}%)` : "(Gratuit)"}
                          </span>
                          <span className={`font-medium ${feeCalculation.fee > 0 ? "text-red-500" : "text-green-500"}`}>
                            {feeCalculation.fee > 0 ? `-${formatCurrency(feeCalculation.fee.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency)}` : "0 XAF"}
                          </span>
                        </div>
                        <div className="border-t pt-3 flex items-center justify-between">
                          <span className="font-medium text-foreground">Montant crédité</span>
                          <span className="text-lg font-bold text-green-500" data-testid="credited-amount">
                            {formatCurrency(feeCalculation.creditedAmount.toString(), (selectedCountry?.currency || "XAF") as SupportedCurrency)}
                          </span>
                        </div>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optionnel)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ajouter une note..."
                              {...field} 
                              data-testid="input-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full" 
                      size="lg" 
                      disabled={depositMutation.isPending} 
                      data-testid="button-deposit-confirm"
                    >
                      {depositMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Traitement en cours...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Recharger
                        </>
                      )}
                    </Button>
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
