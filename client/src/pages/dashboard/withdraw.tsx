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
import { withdrawSchema, type SupportedCurrency, type WithdrawalNumber } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { Wallet, Smartphone, Building2, Loader2, CheckCircle, AlertCircle, Phone, Plus, Settings, Globe, Shield } from "lucide-react";
import { z } from "zod";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/currency";
import { Link, useLocation } from "wouter";

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

const withdrawMethods = [
  { id: "mobile_money", name: "Mobile Money", icon: Smartphone, description: "Orange, MTN, Wave, Airtel..." },
  { id: "bank_transfer", name: "Virement bancaire", icon: Building2, description: "Vers votre compte bancaire" },
];

export default function WithdrawPage() {
  const [selectedMethod, setSelectedMethod] = useState<string>("mobile_money");
  const [selectedNumber, setSelectedNumber] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedOperator, setSelectedOperator] = useState<string>("");
  const { toast } = useToast();
  
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const balance = parseFloat(user?.balance || "0");

  const { data: withdrawalNumbers = [] } = useQuery<WithdrawalNumber[]>({
    queryKey: ["/api/withdrawal-numbers"],
  });

  const { data: countriesConfig = [] } = useQuery<CountryConfig[]>({
    queryKey: ["/api/transfers/config?type=withdrawal"],
  });
  
  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: "", paymentMethod: "mobile_money", accountDetails: "", countryId: "", operatorId: "" },
  });

  const selectedCountryData = countriesConfig.find(c => c.id === selectedCountry);
  const operators = selectedCountryData?.operators || [];
  const selectedOperatorData = operators.find(o => o.id === selectedOperator);

  useEffect(() => {
    if (selectedNumber && withdrawalNumbers.length > 0) {
      const number = withdrawalNumbers.find(n => n.id === selectedNumber);
      if (number) {
        form.setValue("accountDetails", number.phoneNumber);
      }
    }
  }, [selectedNumber, withdrawalNumbers, form]);

  useEffect(() => {
    setSelectedOperator("");
    form.setValue("countryId", selectedCountry);
    form.setValue("operatorId", "");
  }, [selectedCountry, form]);

  useEffect(() => {
    form.setValue("operatorId", selectedOperator);
  }, [selectedOperator, form]);

  const withdrawMutation = useMutation({
    mutationFn: async (data: z.infer<typeof withdrawSchema>) => {
      const res = await apiRequest("POST", "/api/withdrawals", { 
        ...data, 
        paymentMethod: selectedMethod,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Retrait demandé", description: "Votre demande de retrait a été enregistrée" });
      form.reset();
      setSelectedNumber("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const [, setLocation] = useLocation();
  const isVerified = user?.isVerified;

  const watchedAmount = form.watch("amount");
  const watchedAccountDetails = form.watch("accountDetails");
  const amountValue = parseFloat(watchedAmount || "0");
  const isAmountValid = amountValue >= 1000 && amountValue <= balance;
  const isMobileMoneyValid = selectedMethod === "mobile_money" ? (!!selectedCountry && !!selectedOperator && !!watchedAccountDetails) : true;
  const isBankTransferValid = selectedMethod === "bank_transfer" ? !!watchedAccountDetails : true;
  const isSubmitDisabled = withdrawMutation.isPending || !isAmountValid || !isMobileMoneyValid || !isBankTransferValid;

  if (user && !isVerified) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Retirer de l'argent</h1>
            <p className="text-muted-foreground">Retirez vos fonds vers votre compte</p>
          </div>
          
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Shield className="w-8 h-8 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Compte non vérifié</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Pour effectuer des retraits, vous devez d'abord vérifier votre compte. 
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
          <h1 className="text-2xl font-bold text-foreground">Retirer de l'argent</h1>
          <p className="text-muted-foreground">Retirez vos fonds vers votre compte</p>
        </div>

        <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Solde disponible</p>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(balance, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</p>
              </div>
              <Wallet className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        {balance < 1000 && (
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <p className="text-sm text-foreground">Solde insuffisant. Le montant minimum de retrait est de 1,000 XAF.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Mode de retrait</CardTitle>
              <CardDescription>Comment souhaitez-vous recevoir vos fonds?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {withdrawMethods.map((method) => (
                <div
                  key={method.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedMethod === method.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover-elevate'
                  } ${method.id === "bank_transfer" ? 'opacity-60' : ''}`}
                  onClick={() => {
                    if (method.id === "bank_transfer") {
                      toast({ 
                        title: "Bientôt disponible", 
                        description: "Le virement bancaire sera disponible prochainement." 
                      });
                    } else {
                      setSelectedMethod(method.id);
                    }
                  }}
                  data-testid={`withdraw-method-${method.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      selectedMethod === method.id ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <method.icon className={`w-6 h-6 ${selectedMethod === method.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{method.name}</p>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                      {method.id === "bank_transfer" && (
                        <p className="text-xs text-primary mt-1">Bientôt disponible</p>
                      )}
                    </div>
                    {selectedMethod === method.id && <CheckCircle className="w-5 h-5 text-primary" />}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Détails du retrait</CardTitle>
              <CardDescription>Entrez les informations de votre compte</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => withdrawMutation.mutate(d))} className="space-y-4">
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
                            className="text-xl h-12"
                            {...field} 
                            data-testid="input-withdraw-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedMethod === "mobile_money" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <FormLabel className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            Pays
                          </FormLabel>
                          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                            <SelectTrigger data-testid="select-country">
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                            <SelectContent>
                              {countriesConfig.map((country) => (
                                <SelectItem key={country.id} value={country.id}>
                                  {country.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <FormLabel className="flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            Opérateur
                          </FormLabel>
                          <Select 
                            value={selectedOperator} 
                            onValueChange={setSelectedOperator}
                            disabled={!selectedCountry}
                          >
                            <SelectTrigger data-testid="select-operator">
                              <SelectValue placeholder={selectedCountry ? "Sélectionner" : "Choisir un pays"} />
                            </SelectTrigger>
                            <SelectContent>
                              {operators.map((op) => (
                                <SelectItem key={op.id} value={op.id}>
                                  {op.name}
                                  {op.feePercentage > 0 && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({op.feePercentage}%)
                                    </span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {(() => {
                        const amountValue = parseFloat(form.watch("amount") || "0");
                        if (amountValue > 0 && selectedOperatorData) {
                          const feePercent = selectedOperatorData.feePercentage || 0;
                          const feeFixed = selectedOperatorData.feeFixed || 0;
                          const minPayoutCharge = selectedOperatorData.minFee || 0;
                          
                          const percentageFee = (amountValue * feePercent / 100);
                          const feeAmount = Math.max(percentageFee + feeFixed, minPayoutCharge);
                          
                          const amountReceived = amountValue - feeAmount;
                          
                          return (
                            <Card className="border-primary/30 bg-primary/5">
                              <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-muted-foreground">Montant demandé</span>
                                  <span className="font-medium">{formatCurrency(amountValue, "XAF")}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-muted-foreground">
                                    Frais ({feePercent}%{feeFixed > 0 ? ` + ${formatCurrency(feeFixed, "XAF")}` : ''})
                                  </span>
                                  <span className="font-medium text-red-500">- {formatCurrency(feeAmount, "XAF")}</span>
                                </div>
                                <div className="border-t border-border pt-3">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold text-foreground">Vous recevrez</span>
                                    <span className="font-bold text-lg text-primary">{formatCurrency(amountReceived, "XAF")}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        }
                        return null;
                      })()}
                    </>
                  )}

                  {selectedMethod === "mobile_money" && withdrawalNumbers.length > 0 && (
                    <div className="space-y-2">
                      <FormLabel>Numéro enregistré</FormLabel>
                      <Select value={selectedNumber} onValueChange={setSelectedNumber}>
                        <SelectTrigger data-testid="select-withdrawal-number">
                          <SelectValue placeholder="Choisir un numéro enregistré" />
                        </SelectTrigger>
                        <SelectContent>
                          {withdrawalNumbers.map((number) => (
                            <SelectItem key={number.id} value={number.id}>
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                <div className="flex flex-col">
                                  <span>{number.phoneNumber}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {number.operatorName}
                                    {number.label && ` - ${number.label}`}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2 mt-1">
                        <Link href="/dashboard/withdrawal-numbers">
                          <Button variant="ghost" size="sm" className="p-0 h-auto text-xs" data-testid="link-manage-numbers">
                            <Settings className="w-3 h-3 mr-1" />
                            Gérer mes numéros
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}

                  {selectedMethod === "mobile_money" && withdrawalNumbers.length === 0 && (
                    <Card className="border-blue-500/30 bg-blue-500/5">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Phone className="w-5 h-5 text-blue-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground mb-1">
                              Aucun numéro de retrait enregistré
                            </p>
                            <p className="text-xs text-muted-foreground mb-3">
                              Enregistrez vos numéros de téléphone pour les retraits rapides
                            </p>
                            <Link href="/dashboard/withdrawal-numbers">
                              <Button size="sm" variant="outline" data-testid="button-add-withdrawal-number">
                                <Plus className="w-4 h-4 mr-2" />
                                Ajouter un numéro
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {(selectedMethod === "bank_transfer" || (selectedMethod === "mobile_money" && withdrawalNumbers.length === 0)) && (
                    <FormField
                      control={form.control}
                      name="accountDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {selectedMethod === "mobile_money" ? "Numéro de téléphone" : "Numéro de compte bancaire"}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={selectedMethod === "mobile_money" ? "+237 6XX XXX XXX" : "IBAN ou numéro de compte"}
                              {...field}
                              data-testid="input-account-details"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg" 
                    disabled={isSubmitDisabled}
                    data-testid="button-withdraw-confirm"
                  >
                    {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                    Demander le retrait
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
