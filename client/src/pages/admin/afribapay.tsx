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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Zap, Globe, Settings, RefreshCw, CheckCircle, XCircle,
  AlertCircle, ChevronDown, ChevronRight, Loader2, Save
} from "lucide-react";
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
  currencies: Record<string, { currency: string; operators: AfribaOperator[] }>;
}

// ─── Country Config Row ────────────────────────────────────────────────────────
// Inline edit row for one local operator within a country group
function OperatorConfigRow({
  op,
  afribaOperators,
  onSave,
  isSaving,
}: {
  op: any;
  afribaOperators: AfribaOperator[];
  onSave: (id: string, paymentProvider: string, afribapayOperatorCode: string) => void;
  isSaving: boolean;
}) {
  const [provider, setProvider] = useState<string>((op as any).paymentProvider || "swychr");
  const [code, setCode] = useState<string>((op as any).afribapayOperatorCode || "");
  const isDirty =
    provider !== ((op as any).paymentProvider || "swychr") ||
    code !== ((op as any).afribapayOperatorCode || "");

  return (
    <tr className="border-b hover:bg-muted/20">
      <td className="py-3 pr-4">
        <div className="font-medium text-sm">{op.name}</div>
        <div className="text-xs text-muted-foreground">{op.type || "mobile_money"}</div>
      </td>

      {/* Fournisseur */}
      <td className="py-3 pr-3 w-44">
        <Select value={provider} onValueChange={(v) => { setProvider(v); if (v === "swychr") setCode(""); }}>
          <SelectTrigger className="h-8 text-xs" data-testid={`select-provider-${op.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="swychr">Swychr</SelectItem>
            <SelectItem value="afribapay">AfribaPay</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Code opérateur AfribaPay */}
      <td className="py-3 pr-3">
        {provider === "afribapay" ? (
          afribaOperators.length > 0 ? (
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-afribapay-op-${op.id}`}>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {afribaOperators.map(ao => (
                  <SelectItem key={ao.operator_code} value={ao.operator_code}>
                    <span className="font-medium">{ao.operator_name}</span>
                    <span className="ml-1 text-muted-foreground text-xs">({ao.operator_code})</span>
                    {ao.otp_required === 1 && <Badge variant="outline" className="ml-1 text-xs px-1 py-0">OTP</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-orange-500 italic">Pays non dispo sur AfribaPay</span>
          )
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
      </td>

      {/* Status badge */}
      <td className="py-3 pr-3 w-28">
        <Badge
          variant={provider === "afribapay" ? "default" : "secondary"}
          className={provider === "afribapay" ? "bg-yellow-500 text-black text-xs" : "text-xs"}
        >
          {provider === "afribapay" ? (code ? `AFP · ${code}` : "AFP · ?") : "Swychr"}
        </Badge>
      </td>

      {/* Bouton sauvegarder */}
      <td className="py-3 w-24">
        <Button
          size="sm"
          variant={isDirty ? "default" : "ghost"}
          className={`h-7 text-xs ${isDirty ? "" : "opacity-40"}`}
          disabled={!isDirty || isSaving || (provider === "afribapay" && !code)}
          onClick={() => onSave(op.id, provider, code)}
          data-testid={`btn-save-op-${op.id}`}
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" />Sauv.</>}
        </Button>
      </td>
    </tr>
  );
}

// ─── Country Group Card ────────────────────────────────────────────────────────
function CountryGroupCard({
  country,
  localOperators,
  afribaCountryData,
  onSaveOperator,
  savingId,
}: {
  country: Country;
  localOperators: Operator[];
  afribaCountryData: AfribaCountryData | undefined;
  onSaveOperator: (id: string, provider: string, code: string) => void;
  savingId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const afribaOps: AfribaOperator[] = afribaCountryData
    ? Object.values(afribaCountryData.currencies).flatMap(c => c.operators)
    : [];

  const afribapayCount = localOperators.filter((op: any) => op.paymentProvider === "afribapay").length;

  return (
    <Card className={`transition-colors ${expanded ? "border-yellow-400" : ""}`}>
      <CardContent className="p-0">
        {/* Header */}
        <button
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 rounded-lg"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{(country as any).flag || "🌍"}</span>
            <div>
              <p className="font-semibold">{country.name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">({country.code})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {localOperators.length} opérateur(s) local ·{" "}
                {afribaOps.length > 0
                  ? <span className="text-green-600">{afribaOps.length} dispo sur AfribaPay</span>
                  : <span className="text-orange-500">non disponible sur AfribaPay</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {afribapayCount > 0 && (
              <Badge className="bg-yellow-500 text-black text-xs">{afribapayCount} AFP</Badge>
            )}
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>

        {/* Expanded operator table */}
        {expanded && (
          <div className="px-4 pb-4 border-t">
            {afribaOps.length === 0 && (
              <div className="flex items-center gap-2 text-orange-600 text-sm py-3">
                <AlertCircle className="h-4 w-4" />
                Ce pays n'est pas encore supporté par l'API AfribaPay. Seul Swychr est disponible.
              </div>
            )}
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-4 text-xs font-medium text-muted-foreground">Opérateur local</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground">Fournisseur</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground">Opérateur AfribaPay</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground">Statut</th>
                  <th className="py-1 text-xs font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {localOperators.map(op => (
                  <OperatorConfigRow
                    key={op.id}
                    op={op}
                    afribaOperators={afribaOps}
                    onSave={onSaveOperator}
                    isSaving={savingId === op.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminAfribaPay() {
  const { toast } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedAfriba, setExpandedAfriba] = useState<string | null>(null);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [feeForm, setFeeForm] = useState({ afribapayFee: "", ashtechMargin: "" });

  const { data: afribaCountries, isLoading: loadingAfriba, refetch: refetchAfriba, error: afribaError } =
    useQuery<{ success: boolean; data: Record<string, AfribaCountryData> }>({
      queryKey: ["/api/admin/afribapay/countries"],
    });

  const { data: countries } = useQuery<Country[]>({ queryKey: ["/api/admin/countries"] });
  const { data: operators } = useQuery<Operator[]>({ queryKey: ["/api/admin/operators"] });
  const { data: fees } = useQuery<Fee[]>({ queryKey: ["/api/admin/fees"] });

  const updateProviderMutation = useMutation({
    mutationFn: async ({ id, paymentProvider, afribapayOperatorCode }: { id: string; paymentProvider: string; afribapayOperatorCode: string }) =>
      apiRequest("PATCH", `/api/admin/operators/${id}/provider`, { paymentProvider, afribapayOperatorCode }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      setSavingId(null);
      toast({ title: "Sauvegardé", description: `Opérateur configuré sur ${vars.paymentProvider === "afribapay" ? `AfribaPay (${vars.afribapayOperatorCode})` : "Swychr"}.` });
    },
    onError: (err: any) => {
      setSavingId(null);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateFeeMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; afribapayFee: string; ashtechMargin: string }) =>
      apiRequest("PATCH", `/api/admin/fees/${id}/afribapay`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      setEditingFee(null);
      toast({ title: "Frais mis à jour" });
    },
    onError: (err: any) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const handleSaveOperator = (id: string, paymentProvider: string, afribapayOperatorCode: string) => {
    setSavingId(id);
    updateProviderMutation.mutate({ id, paymentProvider, afribapayOperatorCode });
  };

  // Grouper les opérateurs locaux par pays
  const countriesWithOperators = useMemo(() => {
    if (!countries || !operators) return [];
    return countries
      .map(c => ({
        country: c,
        ops: operators.filter((op: any) => op.countryId === c.id),
      }))
      .filter(g => g.ops.length > 0);
  }, [countries, operators]);

  const afribaCountryList = afribaCountries?.data ? Object.values(afribaCountries.data) : [];
  const afribapayOpsCount = operators?.filter((op: any) => op.paymentProvider === "afribapay").length || 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <Zap className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AfribaPay</h1>
            <p className="text-muted-foreground text-sm">Configurer les fournisseurs de paiement par opérateur et par pays</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 flex items-center gap-3">
            <Globe className="h-5 w-5 text-blue-500" />
            <div><p className="text-2xl font-bold">{afribaCountryList.length}</p><p className="text-sm text-muted-foreground">Pays AfribaPay</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div><p className="text-2xl font-bold">{afribapayOpsCount}</p><p className="text-sm text-muted-foreground">Opérateurs → AfribaPay</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-muted-foreground" />
            <div><p className="text-2xl font-bold">{(operators?.length || 0) - afribapayOpsCount}</p><p className="text-sm text-muted-foreground">Opérateurs → Swychr</p></div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="operators">
          <TabsList>
            <TabsTrigger value="operators">Opérateurs par pays</TabsTrigger>
            <TabsTrigger value="fees">Frais AfribaPay</TabsTrigger>
            <TabsTrigger value="countries">Pays supportés</TabsTrigger>
          </TabsList>

          {/* ─── Operators Tab ──────────────────────────────────────── */}
          <TabsContent value="operators" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Cliquez sur un pays pour configurer tous ses opérateurs en une seule fois.
            </p>

            {(!countries || !operators) ? (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
              </div>
            ) : countriesWithOperators.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun opérateur trouvé.</p>
            ) : (
              countriesWithOperators.map(({ country, ops }) => {
                const afribaCountry = afribaCountries?.data
                  ? Object.values(afribaCountries.data).find(
                      ac => ac.country_code.toUpperCase() === country.code.toUpperCase()
                    )
                  : undefined;
                return (
                  <CountryGroupCard
                    key={country.id}
                    country={country}
                    localOperators={ops}
                    afribaCountryData={afribaCountry}
                    onSaveOperator={handleSaveOperator}
                    savingId={savingId}
                  />
                );
              })
            )}
          </TabsContent>

          {/* ─── Fees Tab ────────────────────────────────────────────── */}
          <TabsContent value="fees" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Frais AfribaPay</CardTitle>
                <CardDescription>
                  Frais prélevés par AfribaPay + marge Ashtech Pay.
                  <span className="ml-1 text-yellow-600 font-medium">Total = AfribaPay + Marge</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">Nom</th>
                        <th className="text-left py-2 pr-4">Type</th>
                        <th className="text-left py-2 pr-4">Swychr</th>
                        <th className="text-left py-2 pr-4">AfribaPay</th>
                        <th className="text-left py-2 pr-4">Marge Ashtech</th>
                        <th className="text-left py-2 pr-4">Total AFP</th>
                        <th className="text-left py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fees?.map((fee: any) => (
                        <tr key={fee.id} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-4 font-medium">{fee.name}</td>
                          <td className="py-2 pr-4"><Badge variant="outline">{fee.transactionType}</Badge></td>
                          <td className="py-2 pr-4">{parseFloat(fee.swychrFee || "0").toFixed(2)}%</td>
                          <td className="py-2 pr-4 text-yellow-600 font-semibold">{parseFloat(fee.afribapayFee || "0").toFixed(2)}%</td>
                          <td className="py-2 pr-4">{parseFloat(fee.ashtechMargin || "0").toFixed(2)}%</td>
                          <td className="py-2 pr-4 font-bold">
                            {(parseFloat(fee.afribapayFee || "0") + parseFloat(fee.ashtechMargin || "0")).toFixed(2)}%
                          </td>
                          <td className="py-2">
                            <Button size="sm" variant="outline"
                              onClick={() => { setEditingFee(fee); setFeeForm({ afribapayFee: fee.afribapayFee ?? "3.00", ashtechMargin: fee.ashtechMargin ?? "2.00" }); }}
                              data-testid={`btn-edit-fee-${fee.id}`}>
                              <Settings className="h-3 w-3 mr-1" /> Modifier
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Countries Tab ───────────────────────────────────────── */}
          <TabsContent value="countries" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Pays et opérateurs disponibles sur AfribaPay (temps réel)</p>
              <Button variant="outline" size="sm" onClick={() => refetchAfriba()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
              </Button>
            </div>
            {loadingAfriba && (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
              </div>
            )}
            {afribaError && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                <CardContent className="pt-6 flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Erreur de chargement. Vérifiez la connexion API AfribaPay.
                </CardContent>
              </Card>
            )}
            {!loadingAfriba && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {afribaCountryList.map(ac => {
                  const allOps = Object.values(ac.currencies).flatMap(c => c.operators);
                  const isExp = expandedAfriba === ac.country_code;
                  return (
                    <Card key={ac.country_code} className="cursor-pointer hover:border-yellow-400 transition-colors"
                      onClick={() => setExpandedAfriba(isExp ? null : ac.country_code)}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{ac.country_flag}</span>
                            <div>
                              <p className="font-semibold text-sm">{ac.country_name}</p>
                              <p className="text-xs text-muted-foreground">+{ac.prefix} · Taxes {ac.taxes}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{allOps.length} op.</Badge>
                            {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                        </div>
                        {isExp && (
                          <div className="mt-3 border-t pt-3 space-y-2">
                            {Object.entries(ac.currencies).map(([cur, data]) => (
                              <div key={cur}>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">{cur}</p>
                                <div className="flex flex-wrap gap-1">
                                  {data.operators.map(op => (
                                    <div key={op.operator_code} className="flex items-center gap-1 bg-muted rounded px-2 py-1">
                                      <span className="text-xs font-medium">{op.operator_name}</span>
                                      <span className="text-xs text-muted-foreground">({op.operator_code})</span>
                                      {op.otp_required === 1 && <Badge variant="outline" className="text-xs px-1 py-0">OTP</Badge>}
                                      {op.wallet === 1 && <Badge variant="secondary" className="text-xs px-1 py-0">Wallet</Badge>}
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

      {/* ─── Fee Edit Dialog ─────────────────────────────────────────────── */}
      {editingFee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEditingFee(null)}>
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Frais AfribaPay — {editingFee.name}</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Frais AfribaPay (%)</Label>
                <Input type="number" step="0.01" min="0" max="20" placeholder="3.00"
                  value={feeForm.afribapayFee}
                  onChange={e => setFeeForm(f => ({ ...f, afribapayFee: e.target.value }))}
                  data-testid="input-afribapay-fee" />
                <p className="text-xs text-muted-foreground">Frais prélevés par AfribaPay.</p>
              </div>
              <div className="space-y-1">
                <Label>Marge Ashtech Pay (%)</Label>
                <Input type="number" step="0.01" min="0" max="20" placeholder="2.00"
                  value={feeForm.ashtechMargin}
                  onChange={e => setFeeForm(f => ({ ...f, ashtechMargin: e.target.value }))}
                  data-testid="input-ashtech-margin" />
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Total client :</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {(parseFloat(feeForm.afribapayFee || "0") + parseFloat(feeForm.ashtechMargin || "0")).toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground">{feeForm.afribapayFee || 0}% + {feeForm.ashtechMargin || 0}%</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingFee(null)}>Annuler</Button>
              <Button
                onClick={() => updateFeeMutation.mutate({ id: editingFee.id, ...feeForm })}
                disabled={updateFeeMutation.isPending}
                data-testid="btn-save-fee"
              >
                {updateFeeMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement...</> : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
