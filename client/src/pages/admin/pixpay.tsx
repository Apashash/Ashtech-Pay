import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Globe, Smartphone, ArrowLeftRight, Hash, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { useState } from "react";
import type { Country, Operator } from "@shared/schema";

// ─── Mirror of server-side lookup table (read-only reference) ─────────────────
const SERVICE_ID_TABLE: Record<string, Partial<Record<string, { cash_in: number; cash_out: number }>>> = {
  orange: {
    CI: { cash_in: 2,   cash_out: 1   },
    SN: { cash_in: 214, cash_out: 213 },
    BF: { cash_in: 240, cash_out: 241 },
    CM: { cash_in: 336, cash_out: 337 },
    CD: { cash_in: 346, cash_out: 347 },
  },
  mtn: {
    CI: { cash_in: 6,   cash_out: 5   },
    CM: { cash_in: 338, cash_out: 339 },
  },
  moov: {
    CI: { cash_in: 4,   cash_out: 3   },
    BF: { cash_in: 238, cash_out: 239 },
  },
  flooz: {
    CI: { cash_in: 4,   cash_out: 3   },
    BF: { cash_in: 238, cash_out: 239 },
  },
  wave: {
    CI: { cash_in: 8,   cash_out: 7   },
    SN: { cash_in: 210, cash_out: 211 },
  },
  mpesa: { CD: { cash_in: 342, cash_out: 343 } },
  airtel: { CD: { cash_in: 344, cash_out: 345 } },
  afrimoney: { CD: { cash_in: 348, cash_out: 349 } },
  mix:  { SN: { cash_in: 340, cash_out: 341 } },
  free: { SN: { cash_in: 340, cash_out: 341 } },
  expresso: { SN: { cash_in: 340, cash_out: 341 } },
};

function getServiceIds(operatorName: string, countryCode: string): { cash_in: number | null; cash_out: number | null } {
  const name = operatorName.toLowerCase();
  const cc = countryCode.toUpperCase();
  for (const [keyword, countries] of Object.entries(SERVICE_ID_TABLE)) {
    if (name.includes(keyword)) {
      const entry = countries[cc];
      if (entry) return entry;
    }
  }
  return { cash_in: null, cash_out: null };
}

function detectFlowType(operatorName: string, countryCode: string): "ussd" | "otp" | "wave" {
  const name = operatorName.toLowerCase();
  if (name.includes("wave")) return "wave";
  if (name.includes("orange") && countryCode.toUpperCase() === "CI") return "otp";
  return "ussd";
}

// ─── Currency zones ───────────────────────────────────────────────────────────
const CURRENCY_ZONE: Record<string, string> = {
  CM:"XAF",CF:"XAF",TD:"XAF",GQ:"XAF",CG:"XAF",GA:"XAF",
  BF:"XOFF",BJ:"XOFB",CI:"XOFC",GW:"XOF",ML:"XOFM",NE:"XOF",SN:"XOFS",TG:"XOFT",GN:"GNF",
  CD:"CDF",
};

// ─── Flow badge ───────────────────────────────────────────────────────────────
function FlowBadge({ flow }: { flow: "ussd" | "otp" | "wave" }) {
  if (flow === "wave") return (
    <Badge className="bg-teal-500 text-white text-xs flex items-center gap-1 w-fit">
      <ArrowLeftRight className="h-2.5 w-2.5" /> WAVE
    </Badge>
  );
  if (flow === "otp") return (
    <Badge className="bg-orange-500 text-white text-xs flex items-center gap-1 w-fit">
      <Hash className="h-2.5 w-2.5" /> OTP
    </Badge>
  );
  return (
    <Badge className="bg-blue-500 text-white text-xs flex items-center gap-1 w-fit">
      <Smartphone className="h-2.5 w-2.5" /> USSD
    </Badge>
  );
}

// ─── Operator Row (read-only) ─────────────────────────────────────────────────
function OperatorRow({ op, countryCode }: { op: any; countryCode: string }) {
  const ids = getServiceIds(op.name, countryCode);
  const flow = detectFlowType(op.name, countryCode);
  const isPixPay = op.paymentProvider === "pixpay";
  const isSupported = ids.cash_in !== null;

  return (
    <tr className="border-b hover:bg-muted/10">
      <td className="py-2.5 pr-4">
        <div className="font-medium text-sm">{op.name}</div>
      </td>

      {/* Flow auto */}
      <td className="py-2.5 pr-3">
        {isSupported ? <FlowBadge flow={flow} /> : <span className="text-xs text-muted-foreground">—</span>}
      </td>

      {/* Service ID Dépôt (cash_in) */}
      <td className="py-2.5 pr-3">
        {ids.cash_in !== null ? (
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border text-green-700 dark:text-green-400">
            {ids.cash_in}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
      </td>

      {/* Service ID Retrait (cash_out) */}
      <td className="py-2.5 pr-3">
        {ids.cash_out !== null ? (
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border text-red-700 dark:text-red-400">
            {ids.cash_out}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
      </td>

      {/* Provider actuel */}
      <td className="py-2.5">
        {isPixPay ? (
          <Badge className="bg-blue-500 text-white text-xs">PixPay</Badge>
        ) : op.paymentProvider === "afribapay" ? (
          <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">AfribaPay</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">Swychr</Badge>
        )}
      </td>
    </tr>
  );
}

// ─── Country Card ─────────────────────────────────────────────────────────────
function CountryCard({ country, operators }: { country: Country; operators: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const countryCode = (country as any).code || "";
  const zone = CURRENCY_ZONE[countryCode] || "";
  const supported = operators.filter(op => getServiceIds(op.name, countryCode).cash_in !== null);
  const pixpayActive = operators.filter(op => op.paymentProvider === "pixpay").length;

  return (
    <Card className={expanded ? "border-blue-400" : ""}>
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
                {operators.length} opérateur(s) · {supported.length} supporté(s) PixPay
                {zone && <span className="ml-1 text-green-600">· Zone {zone}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pixpayActive > 0 && (
              <Badge className="bg-blue-500 text-white text-xs">{pixpayActive} actif(s)</Badge>
            )}
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 border-t">
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-4 text-xs font-medium text-muted-foreground">Opérateur</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground">Flux</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground text-green-700">ID Dépôt</th>
                  <th className="text-left py-1 pr-3 text-xs font-medium text-muted-foreground text-red-700">ID Retrait</th>
                  <th className="text-left py-1 text-xs font-medium text-muted-foreground">Fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {operators.map(op => (
                  <OperatorRow key={op.id} op={op} countryCode={countryCode} />
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
  const { data: countries } = useQuery<Country[]>({ queryKey: ["/api/admin/countries"] });
  const { data: operators } = useQuery<Operator[]>({ queryKey: ["/api/admin/operators"] });
  const { data: supportedCountries } = useQuery<any[]>({ queryKey: ["/api/admin/pixpay/supported-countries"] });

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

  // Count how many operators have known service IDs
  const mappedCount = useMemo(() => {
    if (!operators || !countries) return 0;
    return operators.filter(op => {
      const c = countries.find((c: any) => c.id === (op as any).countryId);
      const cc = (c as any)?.code || "";
      return getServiceIds(op.name, cc).cash_in !== null;
    }).length;
  }, [operators, countries]);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Zap className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">PixPay — Référence des Service IDs</h1>
            <p className="text-muted-foreground text-sm">
              Configuration automatique · Aucune saisie requise · Le fournisseur se configure dans les pages de frais
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
                <p className="text-sm text-muted-foreground">Pays couverts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Zap className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{pixpayOpsCount}</p>
                <p className="text-sm text-muted-foreground">Opérateurs actifs PixPay</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Lock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{mappedCount}</p>
                <p className="text-sm text-muted-foreground">Opérateurs avec IDs intégrés</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info banner */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3 mb-4">
              <Lock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                Service IDs intégrés — lecture seule, non modifiables
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex gap-2">
                <Smartphone className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">USSD Push — par défaut</p>
                  <p className="text-muted-foreground text-xs">MTN, Moov, Orange (hors CI), Free, Airtel…</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Hash className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-orange-700 dark:text-orange-300">OTP — Orange CI uniquement</p>
                  <p className="text-muted-foreground text-xs">Utilisateur compose <code className="font-mono bg-muted px-1 rounded">#144*82#</code></p>
                </div>
              </div>
              <div className="flex gap-2">
                <ArrowLeftRight className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-teal-700 dark:text-teal-300">Wave — Wave CI / Wave SN</p>
                  <p className="text-muted-foreground text-xs">Redirection vers l'app Wave pour validation</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Country list */}
        <div className="space-y-3">
          {countriesWithOperators.map(({ country, ops }) => (
            <CountryCard key={(country as any).id} country={country} operators={ops} />
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
