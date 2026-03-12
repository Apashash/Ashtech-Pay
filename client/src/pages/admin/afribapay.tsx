import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap, Globe, RefreshCw, CheckCircle, XCircle,
  AlertCircle, ChevronDown, ChevronRight, Loader2, Lock, Info
} from "lucide-react";
import type { Country, Operator } from "@shared/schema";

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

// ─── Read-only Operator Row ───────────────────────────────────────────────────
function OperatorReadRow({
  op,
  afribaOperators,
}: {
  op: any;
  afribaOperators: AfribaOperator[];
}) {
  const provider = op.paymentProvider || "swychr";
  const code = op.afribapayOperatorCode || "";
  const afribaMatch = afribaOperators.find(a => a.operator_code === code);

  return (
    <tr className="border-b hover:bg-muted/10">
      <td className="py-2.5 pr-4">
        <div className="font-medium text-sm">{op.name}</div>
        <div className="text-xs text-muted-foreground">{op.type || "mobile_money"}</div>
      </td>

      {/* Fournisseur actuel */}
      <td className="py-2.5 pr-3 w-32">
        {provider === "afribapay" ? (
          <Badge className="bg-yellow-500 text-black text-xs">AfribaPay</Badge>
        ) : provider === "pixpay" ? (
          <Badge className="bg-blue-500 text-white text-xs">PixPay</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">Swychr</Badge>
        )}
      </td>

      {/* Code AfribaPay */}
      <td className="py-2.5 pr-3">
        {provider === "afribapay" && code ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border">{code}</span>
            {afribaMatch && (
              <span className="text-xs text-muted-foreground">{afribaMatch.operator_name}</span>
            )}
            {afribaMatch?.otp_required === 1 && (
              <Badge variant="outline" className="text-xs px-1 py-0">OTP</Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Country Group Card ────────────────────────────────────────────────────────
function CountryCard({
  country,
  localOperators,
  afribaCountryData,
}: {
  country: Country;
  localOperators: Operator[];
  afribaCountryData: AfribaCountryData | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const afribaOps: AfribaOperator[] = afribaCountryData
    ? Object.values(afribaCountryData.currencies).flatMap(c => c.operators)
    : [];
  const afribapayCount = localOperators.filter((op: any) => op.paymentProvider === "afribapay").length;

  return (
    <Card className={`transition-colors ${expanded ? "border-yellow-400" : ""}`}>
      <CardContent className="p-0">
        <button
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 rounded-lg"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{(country as any).flag || "🌍"}</span>
            <div>
              <p className="font-semibold">
                {country.name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">({country.code})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {localOperators.length} opérateur(s) ·{" "}
                {afribaOps.length > 0
                  ? <span className="text-green-600">{afribaOps.length} dispo sur AfribaPay</span>
                  : <span className="text-orange-500">non supporté AfribaPay</span>}
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

        {expanded && (
          <div className="px-4 pb-4 border-t">
            {afribaOps.length === 0 && (
              <div className="flex items-center gap-2 text-orange-600 text-sm py-3">
                <AlertCircle className="h-4 w-4" />
                Ce pays n'est pas encore supporté par l'API AfribaPay.
              </div>
            )}
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-4 text-xs font-medium text-muted-foreground">Opérateur</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground">Fournisseur</th>
                  <th className="text-left py-1 text-xs font-medium text-muted-foreground">Code AfribaPay</th>
                </tr>
              </thead>
              <tbody>
                {localOperators.map(op => (
                  <OperatorReadRow
                    key={op.id}
                    op={op}
                    afribaOperators={afribaOps}
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
  const [expandedAfriba, setExpandedAfriba] = useState<string | null>(null);

  const { data: afribaCountries, isLoading: loadingAfriba, refetch: refetchAfriba, error: afribaError } =
    useQuery<{ success: boolean; data: Record<string, AfribaCountryData> }>({
      queryKey: ["/api/admin/afribapay/countries"],
    });

  const { data: countries } = useQuery<Country[]>({ queryKey: ["/api/admin/countries"] });
  const { data: operators } = useQuery<Operator[]>({ queryKey: ["/api/admin/operators"] });

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
            <p className="text-muted-foreground text-sm">
              Vue de référence — configurez les fournisseurs dans les pages de frais
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Globe className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{afribaCountryList.length}</p>
                <p className="text-sm text-muted-foreground">Pays AfribaPay</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{afribapayOpsCount}</p>
                <p className="text-sm text-muted-foreground">Opérateurs sur AfribaPay</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{(operators?.length || 0) - afribapayOpsCount}</p>
                <p className="text-sm text-muted-foreground">Opérateurs sur Swychr / PixPay</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Read-only notice */}
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <Lock className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                Page lecture seule — aucune modification ici
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Pour changer le fournisseur d'un opérateur, rendez-vous dans
                <span className="font-semibold"> Frais → Dépôts</span>,
                <span className="font-semibold"> Retraits</span> ou
                <span className="font-semibold"> Transferts</span>.
                Cette page se met à jour automatiquement.
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="operators">
          <TabsList>
            <TabsTrigger value="operators">Opérateurs par pays</TabsTrigger>
            <TabsTrigger value="countries">Pays supportés AfribaPay</TabsTrigger>
          </TabsList>

          {/* ─── Operators Tab (read-only) ─────────────────────────────── */}
          <TabsContent value="operators" className="space-y-3 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              Cliquez sur un pays pour voir la configuration actuelle de ses opérateurs.
            </div>

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
                  <CountryCard
                    key={country.id}
                    country={country}
                    localOperators={ops}
                    afribaCountryData={afribaCountry}
                  />
                );
              })
            )}
          </TabsContent>

          {/* ─── Countries Tab (already read-only) ───────────────────────── */}
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
                    <Card
                      key={ac.country_code}
                      className="cursor-pointer hover:border-yellow-400 transition-colors"
                      onClick={() => setExpandedAfriba(isExp ? null : ac.country_code)}
                    >
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
    </AdminLayout>
  );
}
