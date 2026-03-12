import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Zap, Globe, ChevronDown, ChevronRight, Loader2, Save,
  Smartphone, ArrowLeftRight, Hash
} from "lucide-react";
import type { Country, Operator } from "@shared/schema";

// ─── Type labels ──────────────────────────────────────────────────────────────
const OP_TYPE_LABELS: Record<string, { label: string; badge: string; color: string }> = {
  ussd:  { label: "USSD Push",          badge: "USSD",  color: "bg-blue-500 text-white" },
  otp:   { label: "OTP (#144*82#)",     badge: "OTP",   color: "bg-orange-500 text-white" },
  wave:  { label: "Wave (redirection)", badge: "WAVE",  color: "bg-teal-500 text-white" },
};

// ─── PixPay currency zones ─────────────────────────────────────────────────────
const CURRENCY_ZONE: Record<string, string> = {
  CM:"XAF",CF:"XAF",TD:"XAF",GQ:"XAF",CG:"XAF",GA:"XAF",
  BF:"XOF",BJ:"XOF",CI:"XOF",GW:"XOF",ML:"XOF",NE:"XOF",SN:"XOF",TG:"XOF",GN:"XOF",
  CD:"CDF",
};

// ─── Operator Row ─────────────────────────────────────────────────────────────
function OperatorPixPayRow({
  op,
  onSave,
  isSaving,
}: {
  op: any;
  onSave: (id: string, provider: string, serviceId: string, opType: string) => void;
  isSaving: boolean;
}) {
  const [provider, setProvider] = useState<string>(op.paymentProvider || "swychr");
  const [serviceId, setServiceId] = useState<string>(op.pixpayServiceId || "");
  const [opType, setOpType] = useState<string>(op.pixpayOperatorType || "ussd");

  const origProvider = op.paymentProvider || "swychr";
  const origServiceId = op.pixpayServiceId || "";
  const origOpType = op.pixpayOperatorType || "ussd";

  const isDirty =
    provider !== origProvider ||
    serviceId !== origServiceId ||
    opType !== origOpType;

  const canSave = isDirty && (provider !== "pixpay" || serviceId.trim().length > 0);

  return (
    <tr className="border-b hover:bg-muted/20">
      <td className="py-3 pr-4">
        <div className="font-medium text-sm">{op.name}</div>
        <div className="text-xs text-muted-foreground">{op.type || "mobile_money"}</div>
      </td>

      {/* Provider */}
      <td className="py-3 pr-3 w-36">
        <Select value={provider} onValueChange={(v) => {
          setProvider(v);
          if (v !== "pixpay") { setServiceId(""); setOpType("ussd"); }
        }}>
          <SelectTrigger className="h-8 text-xs" data-testid={`select-pxprovider-${op.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="swychr">Swychr</SelectItem>
            <SelectItem value="afribapay">AfribaPay</SelectItem>
            <SelectItem value="pixpay">PixPay</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Service ID */}
      <td className="py-3 pr-3 w-32">
        {provider === "pixpay" ? (
          <Input
            className="h-8 text-xs"
            placeholder="ex: 42"
            value={serviceId}
            onChange={e => setServiceId(e.target.value)}
            data-testid={`input-pxservice-${op.id}`}
          />
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
      </td>

      {/* Operator type */}
      <td className="py-3 pr-3 w-44">
        {provider === "pixpay" ? (
          <Select value={opType} onValueChange={setOpType}>
            <SelectTrigger className="h-8 text-xs" data-testid={`select-pxtype-${op.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ussd">
                <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> USSD Push</span>
              </SelectItem>
              <SelectItem value="otp">
                <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> OTP (#144*82#)</span>
              </SelectItem>
              <SelectItem value="wave">
                <span className="flex items-center gap-1"><ArrowLeftRight className="h-3 w-3" /> Wave (redirection)</span>
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
      </td>

      {/* Status badge */}
      <td className="py-3 pr-3 w-24">
        {provider === "pixpay" && serviceId ? (
          <Badge className={`text-xs ${OP_TYPE_LABELS[opType]?.color || "bg-blue-500 text-white"}`}>
            {OP_TYPE_LABELS[opType]?.badge} #{serviceId}
          </Badge>
        ) : provider === "afribapay" ? (
          <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">AfribaPay</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">Swychr</Badge>
        )}
      </td>

      {/* Save */}
      <td className="py-3 w-20">
        <Button
          size="sm"
          variant={canSave ? "default" : "ghost"}
          className={`h-7 text-xs ${canSave ? "" : "opacity-40"}`}
          disabled={!canSave || isSaving}
          onClick={() => onSave(op.id, provider, serviceId, opType)}
          data-testid={`btn-savepx-${op.id}`}
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
  onSaveOperator,
  savingId,
}: {
  country: Country;
  localOperators: Operator[];
  onSaveOperator: (id: string, provider: string, serviceId: string, opType: string) => void;
  savingId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const countryCode = (country as any).code || "";
  const zone = CURRENCY_ZONE[countryCode] || "—";
  const pixpayCount = localOperators.filter((op: any) => op.paymentProvider === "pixpay").length;
  const isSupported = !!CURRENCY_ZONE[countryCode];

  return (
    <Card className={`transition-colors ${expanded ? "border-blue-400" : ""}`}>
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
                <span className="ml-2 text-sm font-normal text-muted-foreground">({countryCode})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {localOperators.length} opérateur(s) ·{" "}
                {isSupported
                  ? <span className="text-green-600">Zone {zone} PixPay</span>
                  : <span className="text-orange-500">non supporté par PixPay</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pixpayCount > 0 && (
              <Badge className="bg-blue-500 text-white text-xs">{pixpayCount} PixPay</Badge>
            )}
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 border-t">
            {!isSupported && (
              <div className="flex items-center gap-2 text-orange-600 text-sm py-3">
                <Zap className="h-4 w-4" />
                Ce pays n'est pas encore couvert par PixPay (pas de zone XAF/XOF/CDF assignée).
              </div>
            )}
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-4 text-xs font-medium text-muted-foreground">Opérateur</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground">Fournisseur</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground">Service ID</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground">Type flux</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground">Statut</th>
                  <th className="py-1 text-xs font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {localOperators.map(op => (
                  <OperatorPixPayRow
                    key={op.id}
                    op={op}
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
export default function AdminPixPay() {
  const { toast } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: countries } = useQuery<Country[]>({ queryKey: ["/api/admin/countries"] });
  const { data: operators } = useQuery<Operator[]>({ queryKey: ["/api/admin/operators"] });
  const { data: supportedCountries } = useQuery<any[]>({ queryKey: ["/api/admin/pixpay/supported-countries"] });

  const updateProviderMutation = useMutation({
    mutationFn: async ({ id, paymentProvider, pixpayServiceId, pixpayOperatorType }: {
      id: string;
      paymentProvider: string;
      pixpayServiceId: string;
      pixpayOperatorType: string;
    }) => apiRequest("PATCH", `/api/admin/operators/${id}/provider`, {
      paymentProvider,
      pixpayServiceId: pixpayServiceId || null,
      pixpayOperatorType: pixpayOperatorType || "ussd",
    }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      setSavingId(null);
      const typeLabel = OP_TYPE_LABELS[vars.pixpayOperatorType]?.label || vars.pixpayOperatorType;
      if (vars.paymentProvider === "pixpay") {
        toast({ title: "Sauvegardé", description: `PixPay — Service ID ${vars.pixpayServiceId} · ${typeLabel}` });
      } else {
        toast({ title: "Sauvegardé", description: `Opérateur basculé vers ${vars.paymentProvider}.` });
      }
    },
    onError: (err: any) => {
      setSavingId(null);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveOperator = (id: string, provider: string, serviceId: string, opType: string) => {
    setSavingId(id);
    updateProviderMutation.mutate({ id, paymentProvider: provider, pixpayServiceId: serviceId, pixpayOperatorType: opType });
  };

  const countriesWithOperators = useMemo(() => {
    if (!countries || !operators) return [];
    return countries
      .map(c => ({
        country: c,
        ops: operators.filter((op: any) => op.countryId === c.id),
      }))
      .filter(g => g.ops.length > 0);
  }, [countries, operators]);

  const pixpayOpsCount = operators?.filter((op: any) => op.paymentProvider === "pixpay").length || 0;
  const supportedCount = supportedCountries?.length || 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Zap className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">PixPay</h1>
            <p className="text-muted-foreground text-sm">
              Assigner les service IDs PixPay par opérateur et configurer le type de flux (USSD, OTP, Wave)
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Globe className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{supportedCount}</p>
                <p className="text-sm text-muted-foreground">Pays couverts PixPay</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Zap className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{pixpayOpsCount}</p>
                <p className="text-sm text-muted-foreground">Opérateurs configurés</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Clés API (XAF · XOF · CDF)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info OTP/Wave */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex gap-2">
                <Smartphone className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">USSD Push</p>
                  <p className="text-muted-foreground text-xs">Plupart des opérateurs. L'utilisateur reçoit une notification USSD sur son téléphone.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Hash className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-orange-700 dark:text-orange-300">OTP — Orange CI uniquement</p>
                  <p className="text-muted-foreground text-xs">L'utilisateur compose <code className="font-mono bg-muted px-1 rounded">#144*82#</code> pour obtenir son code OTP, puis le saisit sur notre plateforme.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <ArrowLeftRight className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-teal-700 dark:text-teal-300">Wave — Wave CI / Wave SN</p>
                  <p className="text-muted-foreground text-xs">PixPay retourne un lien Wave. L'utilisateur est redirigé vers l'app Wave pour valider.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Country/operator list */}
        <div className="space-y-3">
          {countriesWithOperators.map(({ country, ops }) => (
            <CountryGroupCard
              key={(country as any).id}
              country={country}
              localOperators={ops}
              onSaveOperator={handleSaveOperator}
              savingId={savingId}
            />
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
