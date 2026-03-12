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
import { Wallet, Smartphone, Building2, Loader2, CheckCircle, AlertCircle, Phone, Plus, Settings, Globe, Shield, Info, ArrowLeftRight } from "lucide-react";
import { z } from "zod";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/currency";
import { Link, useLocation } from "wouter";
import { useExchangeRates } from "@/hooks/use-exchange-rates";

interface OperatorConfig {
  id: string;
  name: string;
  type: string;
  paymentProvider: string;
  feePercentage: number;
  feeFixed: number;
  afribapayFee: number;
  pixpayFee: number;
  ashtechMargin: number;
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

  const { data: limits } = useQuery<{ minWithdrawal: number; maxWithdrawal: number; minTransfer: number; maxTransfer: number }>({
    queryKey: ["/api/public/limits"],
  });
  const { rates: fxRates } = useExchangeRates();
  const userCurrency = user?.preferredCurrency || "XAF";
  const xafRate = fxRates["XAF"] || 585;
  const userFxRate = fxRates[userCurrency] || xafRate;
  const convertFromXAF = (xaf: number) => Math.ceil(xaf * userFxRate / xafRate);
  const minWithdrawal = convertFromXAF(limits?.minWithdrawal ?? 2650);
  const maxWithdrawal = Math.floor((limits?.maxWithdrawal ?? 5000000) * userFxRate / xafRate);

  // Primary balance = user.balance (always, regardless of currency)
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

  // Auto-select user's registered country on load (locked — withdrawal only from primary country)
  useEffect(() => {
    if (countriesConfig.length > 0 && !selectedCountry) {
      // 1. Try matching by country name (user.country is a text like "Cameroon")
      if (user?.country) {
        const byName = countriesConfig.find(
          c => c.name.toLowerCase() === (user.country || "").toLowerCase()
        );
        if (byName) { setSelectedCountry(byName.id); return; }
      }
      // 2. Fallback: match by primary currency (most reliable for single-currency countries)
      const byCurrency = countriesConfig.find(c => c.currency === userCurrency);
      if (byCurrency) setSelectedCountry(byCurrency.id);
    }
  }, [user?.country, countriesConfig, userCurrency]);

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
  const feePercent = selectedOperatorData?.feePercentage || 0;
  const feeFixed = selectedOperatorData?.feeFixed || 0;
  const minPayoutCharge = selectedOperatorData?.minFee || 0;
  
  const percentageFee = (amountValue * feePercent / 100);
  const isSwychr = !selectedOperatorData?.paymentProvider || selectedOperatorData.paymentProvider === "swychr";
  const feeAmount = (amountValue > 0 && selectedOperatorData) 
    ? (isSwychr ? Math.max(percentageFee + feeFixed, minPayoutCharge) : percentageFee + feeFixed)
    : 0;
  const totalAmount = amountValue + feeAmount;

  const isAmountValid = amountValue >= minWithdrawal && amountValue <= maxWithdrawal && totalAmount <= balance;
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
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Retirer de l'argent</h1>
          <p className="text-muted-foreground">Retirez vos fonds vers votre compte</p>
        </div>

        <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Solde compte principal</p>
                <div className="flex flex-col">
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(balance, userCurrency as SupportedCurrency)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedCountryData?.name || "Votre pays"} · {userCurrency}
                  </p>
                </div>
              </div>
              <Wallet className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        {balance < minWithdrawal && (
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <p className="text-xs text-foreground">Solde insuffisant. Minimum : {minWithdrawal.toLocaleString()} {user?.preferredCurrency || "XAF"}.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-lg">Mode de retrait</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {withdrawMethods.map((method) => (
                <div
                  key={method.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
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
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedMethod === method.id ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <method.icon className={`w-5 h-5 ${selectedMethod === method.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{method.name}</p>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                    {selectedMethod === method.id && <CheckCircle className="w-4 h-4 text-primary" />}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-lg">Détails du retrait</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => withdrawMutation.mutate(d))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant ({user?.preferredCurrency || "XAF"})</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder={minWithdrawal.toString()} 
                            className="text-lg h-10"
                            {...field} 
                            data-testid="input-withdraw-amount"
                          />
                        </FormControl>
                        <FormMessage />
                        {amountValue > 0 && amountValue < minWithdrawal && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Minimum : {minWithdrawal.toLocaleString()} {user?.preferredCurrency || "XAF"}
                          </p>
                        )}
                        {amountValue > 0 && totalAmount > balance && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Solde insuffisant ({totalAmount.toLocaleString()} {user?.preferredCurrency || "XAF"} requis)
                          </p>
                        )}
                      </FormItem>
                    )}
                  />

                  {selectedMethod === "mobile_money" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <FormLabel className="text-xs flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            Pays (compte principal)
                          </FormLabel>
                          <div
                            className="h-9 flex items-center px-3 rounded-md border border-border bg-muted/50 text-xs text-foreground gap-2"
                            data-testid="display-country"
                          >
                            <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="font-medium">
                              {selectedCountryData?.name || (countriesConfig.length === 0 ? "Chargement..." : "Non défini")}
                            </span>
                            <span className="ml-auto text-muted-foreground">{userCurrency}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <FormLabel className="text-xs flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            Opérateur
                          </FormLabel>
                          <Select 
                            value={selectedOperator} 
                            onValueChange={setSelectedOperator}
                            disabled={!selectedCountry || operators.length === 0}
                          >
                            <SelectTrigger className="h-9 text-xs" data-testid="select-operator">
                              <SelectValue placeholder={selectedCountry ? "Choisir un opérateur" : "Chargement..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {operators.map((op) => (
                                <SelectItem key={op.id} value={op.id} className="text-xs">
                                  {op.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {amountValue > 0 && selectedOperatorData && (
                        <Card className="border-primary/30 bg-primary/5">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Montant saisi</span>
                              <span className="font-medium">{formatCurrency(amountValue, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Frais</span>
                              <span className="font-medium text-red-500">- {formatCurrency(feeAmount, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                            </div>
                            <div className="border-t border-border pt-2">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-xs text-foreground">Net à recevoir</span>
                                <span className="font-bold text-base text-primary">{formatCurrency(amountValue - feeAmount, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                              </div>
                            </div>
                            <div className="mt-1 pt-1 border-t border-dashed border-border flex justify-between items-center text-[10px] text-muted-foreground">
                              <span>Total débité de votre solde</span>
                              <span>{formatCurrency(amountValue, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}

                  {selectedMethod === "mobile_money" && withdrawalNumbers.length > 0 && (
                    <div className="space-y-1">
                      <FormLabel className="text-xs">Numéro enregistré</FormLabel>
                      <Select value={selectedNumber} onValueChange={setSelectedNumber}>
                        <SelectTrigger className="h-9 text-xs" data-testid="select-withdrawal-number">
                          <SelectValue placeholder="Choisir un numéro" />
                        </SelectTrigger>
                        <SelectContent>
                          {withdrawalNumbers.map((number) => (
                            <SelectItem key={number.id} value={number.id} className="text-xs">
                              {number.phoneNumber} ({number.operatorName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Link href="/dashboard/withdrawal-numbers">
                          <Button variant="ghost" size="sm" className="p-0 h-auto text-[10px]" data-testid="link-manage-numbers">
                            <Settings className="w-2.5 h-2.5 mr-1" />
                            Gérer mes numéros
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}

                  {selectedMethod === "mobile_money" && withdrawalNumbers.length === 0 && (
                    <Card className="border-blue-500/30 bg-blue-500/5">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <Phone className="w-4 h-4 text-blue-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-foreground">
                              Aucun numéro enregistré
                            </p>
                            <Link href="/dashboard/withdrawal-numbers">
                              <Button size="sm" variant="link" className="p-0 h-auto text-[10px]" data-testid="button-add-withdrawal-number">
                                <Plus className="w-3 h-3 mr-1" />
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
                          <FormLabel className="text-xs">
                            {selectedMethod === "mobile_money" ? "Numéro de téléphone" : "Numéro de compte bancaire"}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={selectedMethod === "mobile_money" ? "+237 6XX XXX XXX" : "IBAN..."}
                              className="h-9 text-xs"
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

                  <div className="flex justify-center pt-2">
                    <Link href="/dashboard/fee-details">
                      <Button variant="link" size="sm" className="text-muted-foreground text-xs h-auto p-0 gap-1">
                        <Info className="w-3 h-3" />
                        Détails des frais
                      </Button>
                    </Link>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
