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
import type { User, SupportedCurrency, Wallet } from "@shared/schema";
import { Send, Globe, Loader2, ArrowRight, AlertCircle, Shield, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { formatCurrency } from "@/lib/currency";
import { useMemo, useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";

const INTERNAL_KEY = "__ashtech_interne__";

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

const externalFormSchema = z.object({
  recipientName: z.string().min(2, "Nom du destinataire requis"),
  recipientPhone: z.string().min(8, "Numéro de téléphone invalide"),
  countryId: z.string().min(1, "Veuillez sélectionner un pays"),
  operatorId: z.string().min(1, "Veuillez sélectionner un opérateur"),
  amount: z.string().min(1, "Montant requis").refine(v => parseFloat(v) > 0, "Le montant doit être supérieur à 0"),
});

type ExternalFormData = z.infer<typeof externalFormSchema>;

const COUNTRY_FLAGS: Record<string, string> = {
  "Bénin": "🇧🇯",
  "Burkina Faso": "🇧🇫",
  "Cameroun": "🇨🇲",
  "Centrafrique": "🇨🇫",
  "Congo": "🇨🇬",
  "Côte d'Ivoire": "🇨🇮",
  "Gabon": "🇬🇦",
  "Ghana": "🇬🇭",
  "Guinée Conakry": "🇬🇳",
  "Guinée équatoriale": "🇬🇶",
  "Guinée-Bissau": "🇬🇼",
  "Kenya": "🇰🇪",
  "Mali": "🇲🇱",
  "Niger": "🇳🇪",
  "Nigeria": "🇳🇬",
  "Nigéria": "🇳🇬",
  "Ouganda": "🇺🇬",
  "RD Congo": "🇨🇩",
  "Rwanda": "🇷🇼",
  "Sénégal": "🇸🇳",
  "Tanzanie": "🇹🇿",
  "Tchad": "🇹🇩",
  "Togo": "🇹🇬",
  "USA": "🇺🇸"
};

export default function SendMoneyPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: wallets = [] } = useQuery<Wallet[]>({ queryKey: ["/api/wallets"] });
  
  const localCurrency = user?.preferredCurrency || "XAF";
  const balance = localCurrency === "XAF" 
    ? parseFloat(user?.balance || "0")
    : parseFloat(wallets.find(w => w.currency === localCurrency)?.balance || "0");

  const { data: limits } = useQuery<{ minTransfer: number; maxTransfer: number }>({
    queryKey: ["/api/public/limits"],
  });
  const minTransfer = limits?.minTransfer ?? 2650;

  const { data: countries, isLoading: isLoadingConfig } = useQuery<CountryConfig[]>({
    queryKey: ["/api/transfers/config"],
  });

  const [destination, setDestination] = useState<string>(INTERNAL_KEY);
  const isInternal = destination === INTERNAL_KEY;

  const [internalIdentifier, setInternalIdentifier] = useState("");
  const [internalAmount, setInternalAmount] = useState("");
  const [internalWallet, setInternalWallet] = useState(user?.preferredCurrency || "XAF");

  useEffect(() => {
    if (user?.preferredCurrency) {
      setInternalWallet(user.preferredCurrency);
    }
  }, [user?.preferredCurrency]);

  const form = useForm<ExternalFormData>({
    resolver: zodResolver(externalFormSchema),
    defaultValues: { recipientName: "", recipientPhone: "", countryId: "", operatorId: "", amount: "" },
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

  const selectedCountry = useMemo(() => countries?.find(c => c.id === watchedCountryId), [countries, watchedCountryId]);
  const selectedOperator = useMemo(() => selectedCountry?.operators.find(o => o.id === watchedOperatorId), [selectedCountry, watchedOperatorId]);
  const amountValue = parseFloat(watchedAmount) || 0;

  const [prevCountryId, setPrevCountryId] = useState("");
  useEffect(() => {
    if (watchedCountryId !== prevCountryId) {
      form.setValue("operatorId", "");
      setPrevCountryId(watchedCountryId);
    }
  }, [watchedCountryId, prevCountryId, form]);

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
      let feeAmount = data.feeAmount;
      let feePercentage = data.feePercentage;
      if (feeAmount === 0 && selectedOperator) {
        const pct = selectedOperator.feePercentage || 0;
        const fixed = selectedOperator.feeFixed || 0;
        const minF = selectedOperator.minFee || 0;
        feeAmount = Math.max((amountValue * pct / 100) + fixed, minF);
        feePercentage = pct;
      }
      setFeePreview({ feeAmount, feePercentage, totalAmount: amountValue + feeAmount, isLoading: false });
    } catch {
      setFeePreview(prev => ({ ...prev, isLoading: false }));
    }
  }, [watchedOperatorId, amountValue, selectedOperator]);

  useEffect(() => {
    const t = setTimeout(fetchFeePreview, 300);
    return () => clearTimeout(t);
  }, [fetchFeePreview]);

  const internalMutation = useMutation({
    mutationFn: async () => {
      if (!internalIdentifier.trim()) throw new Error("Veuillez entrer l'identifiant du destinataire");
      const amt = parseFloat(internalAmount);
      if (!amt || amt <= 0) throw new Error("Veuillez entrer un montant valide");
      const res = await apiRequest("POST", "/api/transfers/internal", {
        recipientIdentifier: internalIdentifier.trim(),
        amount: internalAmount,
        sourceCurrency: internalWallet,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur lors du transfert");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Transfert effectué ✓", description: `Compte de ${data.recipientName} crédité instantanément — Frais: 0` });
      setInternalIdentifier("");
      setInternalAmount("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const externalMutation = useMutation({
    mutationFn: async (data: ExternalFormData) => {
      const res = await apiRequest("POST", "/api/transfers/send", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transfert initié", description: "Votre transaction est en cours de traitement" });
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const canSubmitExternal = amountValue >= minTransfer &&
    feePreview.totalAmount <= balance &&
    feePreview.totalAmount > 0 &&
    watchedCountryId &&
    watchedOperatorId &&
    !externalMutation.isPending &&
    !feePreview.isLoading;

  if (user && !user.isVerified) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Envoyer de l'argent</h1>
            <p className="text-muted-foreground">Envoyez de l'argent à un destinataire</p>
          </div>
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Shield className="w-8 h-8 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold">Compte non vérifié</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Pour envoyer de l'argent, vous devez d'abord vérifier votre compte.
              </p>
              <Button onClick={() => setLocation("/dashboard/kyc")}>
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
          <p className="text-muted-foreground">Transfert instantané ou via Mobile Money</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Nouveau transfert
              </CardTitle>
              <CardDescription>Sélectionnez la destination pour commencer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Destination</label>
                <Select
                  value={destination}
                  onValueChange={(val) => {
                    setDestination(val);
                    if (val !== INTERNAL_KEY) {
                      form.setValue("countryId", val);
                    }
                  }}
                >
                  <SelectTrigger>
                    <Globe className="w-4 h-4 text-muted-foreground mr-2" />
                    <SelectValue placeholder="Sélectionner la destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={INTERNAL_KEY}>🏦 Transfert Interne Ashtech Pay</SelectItem>
                    {isLoadingConfig
                      ? <SelectItem key="__loading__" value="__loading__" disabled>Chargement...</SelectItem>
                      : (countries ?? []).map(country => (
                      <SelectItem key={country.id} value={country.id}>
                        {COUNTRY_FLAGS[country.name] || "🌍"} {country.name} ({country.currency})
                      </SelectItem>
                    ))
                    }
                  </SelectContent>
                </Select>
              </div>

              {isInternal ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-green-700 dark:text-green-300 text-sm font-medium">Frais: 0 — Transfert gratuit et instantané</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Solde à débiter</label>
                    <Select value={internalWallet} onValueChange={setInternalWallet}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XAF">Compte Principal — {balance.toLocaleString()} XAF</SelectItem>
                        {wallets.filter(w => w.currency !== "XAF").map(w => (
                          <SelectItem key={w.id} value={w.currency}>
                            Compte {w.currency} — {parseFloat(w.balance).toLocaleString()} {w.currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email, téléphone ou nom d'utilisateur</label>
                    <Input
                      placeholder="exemple@email.com / +237600000000 / username"
                      value={internalIdentifier}
                      onChange={e => setInternalIdentifier(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Montant ({internalWallet})</label>
                    <Input
                      type="number"
                      placeholder="10000"
                      className="text-xl h-12"
                      value={internalAmount}
                      onChange={e => setInternalAmount(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => internalMutation.mutate()}
                    disabled={internalMutation.isPending}
                  >
                    {internalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Envoyer
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((d) => externalMutation.mutate({ ...d, countryId: destination }))} className="space-y-4">

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Opérateur</label>
                      <FormField
                        control={form.control}
                        name="operatorId"
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={!selectedCountry || selectedCountry.operators.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={
                                    !selectedCountry ? "Sélectionnez un pays d'abord"
                                      : selectedCountry.operators.length === 0 ? "Aucun opérateur disponible"
                                        : "Sélectionner un opérateur"
                                  } />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {selectedCountry?.operators.map(op => (
                                  <SelectItem key={op.id} value={op.id}>
                                    {op.name} ({op.feePercentage}% frais)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="recipientName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom du destinataire</FormLabel>
                          <FormControl><Input placeholder="Jean Dupont" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="recipientPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro de téléphone</FormLabel>
                          <FormControl><Input placeholder="+237 6XX XXX XXX" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="amount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant à envoyer ({selectedCountry?.currency || "XAF"})</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder={minTransfer.toString()} className="text-xl h-12" {...field} />
                        </FormControl>
                        <FormMessage />
                        {amountValue > 0 && amountValue < minTransfer && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Montant minimum: {minTransfer.toLocaleString()} XAF
                          </p>
                        )}
                      </FormItem>
                    )} />

                    <Button type="submit" className="w-full" size="lg" disabled={!canSubmitExternal}>
                      {externalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      Envoyer {amountValue > 0 ? formatCurrency(amountValue, localCurrency as SupportedCurrency) : ""}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground mb-1">Votre solde ({localCurrency})</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(balance, localCurrency as SupportedCurrency)}
                  </p>
                </CardContent>

            {!isInternal && amountValue > 0 && selectedOperator && (
              <Card>
                <CardContent className="p-6 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Résumé {feePreview.isLoading && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
                  </p>
                    <span>Montant</span>
                    <span className="font-medium">{formatCurrency(amountValue, localCurrency as SupportedCurrency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frais ({feePreview.feePercentage || selectedOperator.feePercentage}%)</span>
                    <span className="font-medium text-orange-500">{formatCurrency(feePreview.feeAmount, localCurrency as SupportedCurrency)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-bold">
                    <span>Total débité</span>
                    <span>{formatCurrency(feePreview.totalAmount, localCurrency as SupportedCurrency)}</span>
                  </div>
                  {feePreview.totalAmount > balance && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Solde insuffisant</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span>{formatCurrency(balance, localCurrency as SupportedCurrency)}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className={feePreview.totalAmount > balance ? "text-destructive" : ""}>
                      {formatCurrency(Math.max(0, balance - feePreview.totalAmount), localCurrency as SupportedCurrency)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {isInternal && (
              <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/10">
                <CardContent className="p-5 space-y-2">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Transfert Interne</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Gratuit — aucun frais</li>
                    <li>✓ Instantané — crédit immédiat</li>
                    <li>✓ Sécurisé — compte vérifié</li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
