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
import { Send, Phone, User as UserIcon, Globe, Loader2, ArrowRight, AlertCircle, Shield, Info } from "lucide-react";
import { z } from "zod";
import { formatCurrency } from "@/lib/currency";
import { useMemo, useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation, Link } from "wouter";

interface OperatorConfig {
  id: string;
  name: string;
  type: string;
  feePercentage: number;
  feeFixed: number;
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

const sendFormSchema = z.object({
  recipientName: z.string().min(2, "Nom du destinataire requis"),
  recipientPhone: z.string().min(8, "Numéro de téléphone invalide"),
  countryId: z.string().min(1, "Veuillez sélectionner un pays"),
  operatorId: z.string().min(1, "Veuillez sélectionner un opérateur"),
  amount: z.string().min(1, "Montant requis").refine(v => parseFloat(v) > 0, "Le montant doit être supérieur à 0"),
  description: z.string().optional(),
});

type SendFormData = z.infer<typeof sendFormSchema>;

export default function SendMoneyPage() {
  const { toast } = useToast();
  
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const balance = parseFloat(user?.balance || "0");
  
  const { data: countries, isLoading: isLoadingConfig } = useQuery<CountryConfig[]>({
    queryKey: ["/api/transfers/config"],
  });

  const form = useForm<SendFormData>({
    resolver: zodResolver(sendFormSchema),
    defaultValues: { 
      recipientName: "", 
      recipientPhone: "", 
      countryId: "",
      operatorId: "",
      amount: "", 
      description: "" 
    },
  });

  const watchedCountryId = form.watch("countryId");
  const watchedOperatorId = form.watch("operatorId");
  const watchedAmount = form.watch("amount");
  
  const [feePreview, setFeePreview] = useState<{
    feeAmount: number;
    feePercentage: number;
    totalAmount: number;
    isLoading: boolean;
  }>({ feeAmount: 0, feePercentage: 0, totalAmount: 0, isLoading: false });
  
  const selectedCountry = useMemo(() => {
    return countries?.find(c => c.id === watchedCountryId);
  }, [countries, watchedCountryId]);
  
  const selectedOperator = useMemo(() => {
    return selectedCountry?.operators.find(o => o.id === watchedOperatorId);
  }, [selectedCountry, watchedOperatorId]);
  
  const [prevCountryId, setPrevCountryId] = useState<string>("");
  
  useEffect(() => {
    if (watchedCountryId !== prevCountryId) {
      form.setValue("operatorId", "");
      setPrevCountryId(watchedCountryId);
    }
  }, [watchedCountryId, prevCountryId, form]);

  const amountValue = parseFloat(watchedAmount) || 0;
  
  const fetchFeePreview = useCallback(async () => {
    if (!watchedOperatorId || amountValue <= 0) {
      setFeePreview({ feeAmount: 0, feePercentage: 0, totalAmount: 0, isLoading: false });
      return;
    }
    
    setFeePreview(prev => ({ ...prev, isLoading: true }));
    
    try {
      const res = await apiRequest("POST", "/api/transfers/calculate-fee", {
        operatorId: watchedOperatorId,
        amount: amountValue.toString(),
      });
      const data = await res.json();
      
      // Ensure we use the fee details from the operator config if API returns 0 but config has values
      let feeAmount = data.feeAmount;
      let feePercentage = data.feePercentage;
      
      if (feeAmount === 0 && selectedOperator) {
        const configFeePercent = selectedOperator.feePercentage || 0;
        const configFeeFixed = selectedOperator.feeFixed || 0;
        const minPayoutCharge = selectedOperator.minFee || 0;
        
        const percentageFee = (amountValue * configFeePercent / 100);
        feeAmount = Math.max(percentageFee + configFeeFixed, minPayoutCharge);
        feePercentage = configFeePercent;
      }

      setFeePreview({
        feeAmount: feeAmount,
        feePercentage: feePercentage,
        totalAmount: amountValue + feeAmount,
        isLoading: false,
      });
    } catch {
      setFeePreview(prev => ({ ...prev, isLoading: false }));
    }
  }, [watchedOperatorId, amountValue, selectedOperator]);
  
  useEffect(() => {
    const timer = setTimeout(fetchFeePreview, 300);
    return () => clearTimeout(timer);
  }, [fetchFeePreview]);

  const sendMutation = useMutation({
    mutationFn: async (data: SendFormData) => {
      const res = await apiRequest("POST", "/api/transfers/send", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ 
        title: "Transfert initié", 
        description: "Votre transaction est en cours de vérification par notre équipe" 
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const canSubmit = amountValue > 0 && 
    feePreview.totalAmount <= balance && 
    feePreview.totalAmount > 0 &&
    watchedCountryId && 
    watchedOperatorId &&
    !sendMutation.isPending &&
    !feePreview.isLoading;

  const [, setLocation] = useLocation();
  const isVerified = user?.isVerified;

  if (user && !isVerified) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Envoyer de l'argent</h1>
            <p className="text-muted-foreground">Envoyez de l'argent à un destinataire via Mobile Money ou autres opérateurs</p>
          </div>
          
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Shield className="w-8 h-8 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Compte non vérifié</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Pour envoyer de l'argent, vous devez d'abord vérifier votre compte. 
                La vérification permet de sécuriser vos transactions et d'accéder à toutes les fonctionnalités.
              </p>
              <Button 
                onClick={() => setLocation("/dashboard/kyc")}
                className="mt-4"
                data-testid="button-go-to-kyc"
              >
                <Shield className="w-4 h-4 mr-2" />
                Passer la vérification
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Envoyer de l'argent</h1>
          <p className="text-muted-foreground">Envoyez de l'argent à un destinataire via Mobile Money ou autres opérateurs</p>
        </div>

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
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Nouveau transfert
                </CardTitle>
                <CardDescription>Remplissez les informations du destinataire</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((d) => sendMutation.mutate(d))} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="recipientName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom du destinataire</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input 
                                  placeholder="Jean Dupont"
                                  className="pl-10"
                                  {...field} 
                                  data-testid="input-recipient-name"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="recipientPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Numéro de téléphone</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input 
                                  placeholder="+237 6XX XXX XXX"
                                  className="pl-10"
                                  {...field} 
                                  data-testid="input-recipient-phone"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="countryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pays de destination</FormLabel>
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
                                    {operator.name} ({operator.feePercentage}% frais)
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
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Montant à envoyer (XAF)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="10000" 
                              className="text-2xl h-14"
                              {...field} 
                              data-testid="input-amount"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note (optionnel)</FormLabel>
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
                      disabled={!canSubmit}
                      data-testid="button-send-confirm"
                    >
                      {sendMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Envoyer {amountValue > 0 ? formatCurrency(amountValue, (user?.preferredCurrency || "XAF") as SupportedCurrency) : ""}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <div className="space-y-4">

              <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground mb-1">Votre solde</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(balance, (user?.preferredCurrency || "XAF") as SupportedCurrency)}
                  </p>
                </CardContent>
              </Card>

              {amountValue > 0 && selectedOperator && (
                <Card>
                  <CardContent className="p-6 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Résumé du transfert
                      {feePreview.isLoading && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Montant à envoyer</span>
                      <span className="font-medium">
                        {formatCurrency(amountValue, (user?.preferredCurrency || "XAF") as SupportedCurrency)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">
                        Frais ({feePreview.feePercentage || selectedOperator.feePercentage}%)
                      </span>
                      <span className="font-medium text-orange-500">
                        {formatCurrency(feePreview.feeAmount, (user?.preferredCurrency || "XAF") as SupportedCurrency)}
                      </span>
                    </div>
                    
                    <div className="border-t border-border pt-3 flex items-center justify-between">
                      <span className="font-medium text-foreground">Total débité</span>
                      <span className="font-bold text-lg">
                        {formatCurrency(feePreview.totalAmount, (user?.preferredCurrency || "XAF") as SupportedCurrency)}
                      </span>
                    </div>
                    
                    {feePreview.totalAmount > balance && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Solde insuffisant</AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="flex items-center justify-center gap-2 pt-2 text-muted-foreground">
                      <span>{formatCurrency(balance, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                      <ArrowRight className="w-4 h-4" />
                      <span className={feePreview.totalAmount > balance ? "text-destructive" : ""}>
                        {formatCurrency(Math.max(0, balance - feePreview.totalAmount), (user?.preferredCurrency || "XAF") as SupportedCurrency)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-foreground mb-2">Information</p>
                  <p className="text-sm text-muted-foreground">
                    Les transferts externes nécessitent une vérification par notre équipe.
                    Le destinataire recevra les fonds sous 24h après validation.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        
        <div className="flex justify-end mt-8">
          <Link href="/dashboard/fee-details">
            <Button variant="outline" size="sm" className="gap-2">
              <Info className="w-4 h-4" />
              Détails des frais
            </Button>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
