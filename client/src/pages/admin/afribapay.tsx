import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Zap, Globe, Settings, RefreshCw, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { Country, Operator, Fee } from "@shared/schema";

interface AfribaOperator {
  operator_code: string;
  operator_name: string;
  otp_required: number;
  wallet: number;
}

interface AfribaCountryData {
  country_code: string;
  country_name: string;
  country_flag: string;
  prefix: string;
  taxes: string;
  currencies: Record<string, {
    currency: string;
    operators: AfribaOperator[];
  }>;
}

export default function AdminAfribaPay() {
  const { toast } = useToast();
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [operatorForm, setOperatorForm] = useState({ paymentProvider: "swychr", afribapayOperatorCode: "" });
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [feeForm, setFeeForm] = useState({ afribapayFee: "", ashtechMargin: "" });

  const { data: afribaCountries, isLoading: loadingAfriba, refetch: refetchAfriba, error: afribaError } = useQuery<{ success: boolean; data: Record<string, AfribaCountryData> }>({
    queryKey: ["/api/admin/afribapay/countries"],
  });

  const { data: countries } = useQuery<Country[]>({
    queryKey: ["/api/admin/countries"],
  });

  const { data: operators } = useQuery<Operator[]>({
    queryKey: ["/api/admin/operators"],
  });

  const { data: fees } = useQuery<Fee[]>({
    queryKey: ["/api/admin/fees"],
  });

  const updateProviderMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; paymentProvider: string; afribapayOperatorCode: string }) =>
      apiRequest("PATCH", `/api/admin/operators/${id}/provider`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      setEditingOperator(null);
      toast({ title: "Opérateur mis à jour", description: "Le fournisseur de paiement a été configuré." });
    },
    onError: (err: any) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const updateFeeMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; afribapayFee: string; ashtechMargin: string }) =>
      apiRequest("PATCH", `/api/admin/fees/${id}/afribapay`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      setEditingFee(null);
      toast({ title: "Frais mis à jour", description: "Les frais AfribaPay ont été enregistrés." });
    },
    onError: (err: any) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const openEditOperator = (op: Operator) => {
    setEditingOperator(op);
    setOperatorForm({
      paymentProvider: (op as any).paymentProvider || "swychr",
      afribapayOperatorCode: (op as any).afribapayOperatorCode || "",
    });
  };

  const openEditFee = (fee: Fee) => {
    setEditingFee(fee);
    setFeeForm({
      afribapayFee: (fee as any).afribapayFee ?? "3.00",
      ashtechMargin: (fee as any).ashtechMargin ?? "2.00",
    });
  };

  // Trouver les opérateurs AfribaPay disponibles pour le pays de l'opérateur sélectionné
  const afribaOperatorsForCountry = useMemo((): AfribaOperator[] => {
    if (!editingOperator || !afribaCountries?.data || !countries) return [];
    const country = countries.find(c => c.id === (editingOperator as any).countryId);
    if (!country) return [];
    // Match by country code (e.g. "CM", "SN", "CI")
    const afribaCountry = Object.values(afribaCountries.data).find(
      ac => ac.country_code.toUpperCase() === country.code.toUpperCase()
    );
    if (!afribaCountry) return [];
    // Flatten all operators from all currencies
    return Object.values(afribaCountry.currencies).flatMap(c => c.operators);
  }, [editingOperator, afribaCountries, countries]);

  // Infos pays pour le dialog
  const editingCountry = useMemo(() => {
    if (!editingOperator || !countries) return null;
    return countries.find(c => c.id === (editingOperator as any).countryId) || null;
  }, [editingOperator, countries]);

  const afribaCountryInfo = useMemo(() => {
    if (!editingCountry || !afribaCountries?.data) return null;
    return Object.values(afribaCountries.data).find(
      ac => ac.country_code.toUpperCase() === editingCountry.code.toUpperCase()
    ) || null;
  }, [editingCountry, afribaCountries]);

  const afribaCountryList = afribaCountries?.data ? Object.values(afribaCountries.data) : [];
  const afribapayOperators = operators?.filter((op: any) => op.paymentProvider === "afribapay") || [];
  const swychrOperators = operators?.filter((op: any) => op.paymentProvider !== "afribapay") || [];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <Zap className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AfribaPay</h1>
            <p className="text-muted-foreground text-sm">Configurer l'intégration AfribaPay — frais, marges et opérateurs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{afribaCountryList.length}</p>
                  <p className="text-sm text-muted-foreground">Pays AfribaPay</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{afribapayOperators.length}</p>
                  <p className="text-sm text-muted-foreground">Opérateurs AfribaPay</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{swychrOperators.length}</p>
                  <p className="text-sm text-muted-foreground">Opérateurs Swychr</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="operators">
          <TabsList>
            <TabsTrigger value="operators">Opérateurs & Fournisseur</TabsTrigger>
            <TabsTrigger value="fees">Frais AfribaPay</TabsTrigger>
            <TabsTrigger value="countries">Pays supportés</TabsTrigger>
          </TabsList>

          {/* ─── Operators Tab ────────────────────────────────────────────── */}
          <TabsContent value="operators" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuration des opérateurs</CardTitle>
                <CardDescription>
                  Choisissez Swychr ou AfribaPay pour chaque opérateur. Le code opérateur AfribaPay est sélectionné automatiquement selon les opérateurs disponibles dans le pays.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!operators?.length ? (
                  <p className="text-muted-foreground text-sm">Aucun opérateur trouvé.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Opérateur</th>
                          <th className="text-left py-2 pr-4">Pays</th>
                          <th className="text-left py-2 pr-4">Fournisseur</th>
                          <th className="text-left py-2 pr-4">Code AfribaPay</th>
                          <th className="text-left py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operators?.map((op: any) => {
                          const country = countries?.find(c => c.id === op.countryId);
                          return (
                            <tr key={op.id} className="border-b hover:bg-muted/30">
                              <td className="py-2 pr-4 font-medium">{op.name}</td>
                              <td className="py-2 pr-4">{country?.name || "—"} <span className="text-muted-foreground">({country?.code})</span></td>
                              <td className="py-2 pr-4">
                                <Badge
                                  variant={op.paymentProvider === "afribapay" ? "default" : "secondary"}
                                  className={op.paymentProvider === "afribapay" ? "bg-yellow-500 text-black" : ""}
                                >
                                  {op.paymentProvider === "afribapay" ? "AfribaPay" : "Swychr"}
                                </Badge>
                              </td>
                              <td className="py-2 pr-4 text-muted-foreground">
                                {op.afribapayOperatorCode || <span className="italic text-xs">—</span>}
                              </td>
                              <td className="py-2">
                                <Button size="sm" variant="outline" onClick={() => openEditOperator(op)}
                                  data-testid={`btn-edit-provider-${op.id}`}>
                                  <Settings className="h-3 w-3 mr-1" /> Configurer
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Fees Tab ────────────────────────────────────────────────── */}
          <TabsContent value="fees" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Frais AfribaPay par opérateur</CardTitle>
                <CardDescription>
                  Configurez le taux de frais AfribaPay et la marge Ashtech Pay pour chaque règle de frais.
                  <br />
                  <span className="text-yellow-600 font-medium">Total client = Frais AfribaPay + Marge Ashtech</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!fees?.length ? (
                  <p className="text-muted-foreground text-sm">Aucun frais configuré.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Nom</th>
                          <th className="text-left py-2 pr-4">Type</th>
                          <th className="text-left py-2 pr-4">Frais Swychr</th>
                          <th className="text-left py-2 pr-4">Frais AfribaPay</th>
                          <th className="text-left py-2 pr-4">Marge Ashtech</th>
                          <th className="text-left py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fees?.map((fee: any) => (
                          <tr key={fee.id} className="border-b hover:bg-muted/30">
                            <td className="py-2 pr-4 font-medium">{fee.name}</td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline">{fee.transactionType}</Badge>
                            </td>
                            <td className="py-2 pr-4">{parseFloat(fee.swychrFee || "0").toFixed(2)}%</td>
                            <td className="py-2 pr-4">
                              <span className={fee.afribapayFee && parseFloat(fee.afribapayFee) > 0 ? "text-yellow-600 font-semibold" : "text-muted-foreground"}>
                                {parseFloat(fee.afribapayFee || "0").toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-2 pr-4">{parseFloat(fee.ashtechMargin || "0").toFixed(2)}%</td>
                            <td className="py-2">
                              <Button size="sm" variant="outline" onClick={() => openEditFee(fee)}
                                data-testid={`btn-edit-fee-${fee.id}`}>
                                <Settings className="h-3 w-3 mr-1" /> Modifier
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Countries Tab ────────────────────────────────────────────── */}
          <TabsContent value="countries" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Pays et opérateurs supportés par AfribaPay (données en temps réel)
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchAfriba()} data-testid="btn-refresh-countries">
                <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
              </Button>
            </div>

            {loadingAfriba && (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement des pays AfribaPay...
              </div>
            )}

            {afribaError && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                <CardContent className="pt-6 flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Erreur de chargement des pays AfribaPay. Vérifiez la connexion API.</span>
                </CardContent>
              </Card>
            )}

            {!loadingAfriba && afribaCountryList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {afribaCountryList.map((country) => {
                  const allOperators = Object.values(country.currencies).flatMap(c => c.operators);
                  const isExpanded = expandedCountry === country.country_code;
                  return (
                    <Card key={country.country_code} className="cursor-pointer hover:border-yellow-400 transition-colors"
                      onClick={() => setExpandedCountry(isExpanded ? null : country.country_code)}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{country.country_flag}</span>
                            <div>
                              <p className="font-semibold text-sm">{country.country_name}</p>
                              <p className="text-xs text-muted-foreground">+{country.prefix} · Taxes: {country.taxes}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{allOperators.length} op.</Badge>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-2 border-t pt-3">
                            {Object.entries(country.currencies).map(([currency, data]) => (
                              <div key={currency}>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">{currency}</p>
                                <div className="flex flex-wrap gap-1">
                                  {data.operators.map(op => (
                                    <div key={op.operator_code} className="flex items-center gap-1 bg-muted rounded px-2 py-1">
                                      <span className="text-xs font-medium">{op.operator_name}</span>
                                      <span className="text-xs text-muted-foreground">({op.operator_code})</span>
                                      {op.otp_required === 1 && (
                                        <Badge variant="outline" className="text-xs px-1 py-0">OTP</Badge>
                                      )}
                                      {op.wallet === 1 && (
                                        <Badge variant="secondary" className="text-xs px-1 py-0">Wallet</Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Edit Operator Provider Dialog ─────────────────────────────── */}
      <Dialog open={!!editingOperator} onOpenChange={(open) => !open && setEditingOperator(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Configurer le fournisseur — {editingOperator?.name}
              {editingCountry && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({editingCountry.flag} {editingCountry.name})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Fournisseur */}
            <div className="space-y-2">
              <Label>Fournisseur de paiement</Label>
              <Select
                value={operatorForm.paymentProvider}
                onValueChange={(v) => setOperatorForm(f => ({
                  ...f,
                  paymentProvider: v,
                  afribapayOperatorCode: v === "swychr" ? "" : f.afribapayOperatorCode,
                }))}
              >
                <SelectTrigger data-testid="select-payment-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="swychr">Swychr (AccountPE)</SelectItem>
                  <SelectItem value="afribapay">AfribaPay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Opérateur AfribaPay — sélecteur dynamique par pays */}
            {operatorForm.paymentProvider === "afribapay" && (
              <div className="space-y-2">
                <Label>Opérateur AfribaPay</Label>

                {loadingAfriba ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des opérateurs...
                  </div>
                ) : afribaOperatorsForCountry.length > 0 ? (
                  <>
                    <Select
                      value={operatorForm.afribapayOperatorCode}
                      onValueChange={(v) => setOperatorForm(f => ({ ...f, afribapayOperatorCode: v }))}
                    >
                      <SelectTrigger data-testid="select-afribapay-operator">
                        <SelectValue placeholder="Sélectionner l'opérateur AfribaPay..." />
                      </SelectTrigger>
                      <SelectContent>
                        {afribaOperatorsForCountry.map(op => (
                          <SelectItem key={op.operator_code} value={op.operator_code}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{op.operator_name}</span>
                              <span className="text-muted-foreground text-xs">({op.operator_code})</span>
                              {op.otp_required === 1 && (
                                <Badge variant="outline" className="text-xs px-1 py-0 ml-1">OTP</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {afribaCountryInfo && (
                      <p className="text-xs text-muted-foreground">
                        {afribaCountryInfo.country_flag} {afribaCountryInfo.country_name} · {afribaOperatorsForCountry.length} opérateur(s) disponible(s)
                      </p>
                    )}
                  </>
                ) : (
                  <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Pays non supporté par AfribaPay</p>
                      <p className="text-xs mt-0.5">
                        {editingCountry
                          ? `Le pays "${editingCountry.name}" (${editingCountry.code}) n'est pas encore disponible sur AfribaPay.`
                          : "Pays non trouvé."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info box */}
            <div className={`p-3 rounded-lg text-sm ${
              operatorForm.paymentProvider === "afribapay"
                ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300"
                : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
            }`}>
              {operatorForm.paymentProvider === "afribapay"
                ? "✓ Le client confirmera le paiement directement sur son téléphone (USSD/OTP). Pas de redirection."
                : "✓ Paiement via Swychr/AccountPE avec confirmation mobile."}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOperator(null)}>Annuler</Button>
            <Button
              onClick={() => editingOperator && updateProviderMutation.mutate({
                id: editingOperator.id,
                paymentProvider: operatorForm.paymentProvider,
                afribapayOperatorCode: operatorForm.afribapayOperatorCode,
              })}
              disabled={
                updateProviderMutation.isPending ||
                (operatorForm.paymentProvider === "afribapay" && !operatorForm.afribapayOperatorCode)
              }
              data-testid="btn-save-provider"
            >
              {updateProviderMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</>
              ) : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Fee Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!editingFee} onOpenChange={(open) => !open && setEditingFee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Frais AfribaPay — {editingFee?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Frais AfribaPay (%)</Label>
              <Input
                type="number" step="0.01" min="0" max="20"
                placeholder="ex: 3.00"
                value={feeForm.afribapayFee}
                onChange={(e) => setFeeForm(f => ({ ...f, afribapayFee: e.target.value }))}
                data-testid="input-afribapay-fee"
              />
              <p className="text-xs text-muted-foreground">Frais que AfribaPay prélève sur chaque transaction.</p>
            </div>
            <div className="space-y-2">
              <Label>Marge Ashtech Pay (%)</Label>
              <Input
                type="number" step="0.01" min="0" max="20"
                placeholder="ex: 2.00"
                value={feeForm.ashtechMargin}
                onChange={(e) => setFeeForm(f => ({ ...f, ashtechMargin: e.target.value }))}
                data-testid="input-ashtech-margin"
              />
              <p className="text-xs text-muted-foreground">Marge supplémentaire Ashtech Pay.</p>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">Total client :</p>
              <p className="text-2xl font-bold text-yellow-500 mt-1">
                {(parseFloat(feeForm.afribapayFee || "0") + parseFloat(feeForm.ashtechMargin || "0")).toFixed(2)}%
              </p>
              <p className="text-xs text-muted-foreground">
                ({feeForm.afribapayFee || 0}% AfribaPay + {feeForm.ashtechMargin || 0}% Ashtech)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFee(null)}>Annuler</Button>
            <Button
              onClick={() => editingFee && updateFeeMutation.mutate({
                id: editingFee.id,
                afribapayFee: feeForm.afribapayFee,
                ashtechMargin: feeForm.ashtechMargin,
              })}
              disabled={updateFeeMutation.isPending}
              data-testid="btn-save-fee"
            >
              {updateFeeMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</>
              ) : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
