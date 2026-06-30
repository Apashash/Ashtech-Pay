import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/pages/admin/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeftRight, CheckCircle, Clock, RefreshCw, Loader2, User, Calendar, Settings, Percent, Save, Equal, Zap, XCircle, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ConversionRequest {
  id: string;
  userId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string | null;
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
  executedAt: string | null;
  createdAt: string;
  userFullName: string;
  userEmail: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "default" },
  completed: { label: "Effectuée", variant: "secondary" },
  cancelled: { label: "Annulée", variant: "destructive" },
};

const CURRENCY_FLAGS: Record<string, string> = {
  XAF: "🇨🇲", XOF: "🇸🇳", GHS: "🇬🇭", NGN: "🇳🇬", KES: "🇰🇪",
  RWF: "🇷🇼", TZS: "🇹🇿", UGX: "🇺🇬", CDF: "🇨🇩", GNF: "🇬🇳",
};

// ── 4 paires de conversion avec leurs settings keys ────────────────────────────
interface PairFeeConfig {
  key: string;           // suffix: xof_xaf, xaf_xof, cdf_cfa, cfa_cdf
  fromLabel: string;
  toLabel: string;
  fromDesc: string;      // description détaillée des devises source
  toDesc: string;        // description détaillée des devises cible
  fromFlag: string;
  toFlag: string;
  color: string;
  providerLabel: string; // label du champ "frais opérateur"
  defaultProvider: number;
  defaultAshtech: number;
}

const CONVERSION_PAIRS: PairFeeConfig[] = [
  {
    key: "xof_xaf",
    fromLabel: "XOF", toLabel: "XAF",
    fromDesc: "XOFT, XOFC, XOFB, XOFF… (famille XOF)",
    toDesc: "XAF, XAFG, XAFC… (famille XAF)",
    fromFlag: "🌍", toFlag: "🇨🇲",
    color: "text-emerald-600 dark:text-emerald-400",
    providerLabel: "Frais opérateurs constant",
    defaultProvider: 1, defaultAshtech: 1,
  },
  {
    key: "xaf_xof",
    fromLabel: "XAF", toLabel: "XOF",
    fromDesc: "XAF, XAFG, XAFC… (famille XAF)",
    toDesc: "XOFT, XOFC, XOFB, XOFF… (famille XOF)",
    fromFlag: "🇨🇲", toFlag: "🌍",
    color: "text-blue-600 dark:text-blue-400",
    providerLabel: "Frais opérateurs constant",
    defaultProvider: 1, defaultAshtech: 1,
  },
  {
    key: "cdf_cfa",
    fromLabel: "CDF", toLabel: "XAF / XOF",
    fromDesc: "CDF (Franc Congolais)",
    toDesc: "XAF, XAFG, XOF, XOFT… (zone CFA)",
    fromFlag: "🇨🇩", toFlag: "🌍",
    color: "text-orange-600 dark:text-orange-400",
    providerLabel: "Frais fournisseur",
    defaultProvider: 3, defaultAshtech: 2,
  },
  {
    key: "cfa_cdf",
    fromLabel: "XAF / XOF", toLabel: "CDF",
    fromDesc: "XAF, XAFG, XOF, XOFT… (zone CFA)",
    toDesc: "CDF (Franc Congolais)",
    fromFlag: "🌍", toFlag: "🇨🇩",
    color: "text-purple-600 dark:text-purple-400",
    providerLabel: "Frais fournisseur",
    defaultProvider: 3, defaultAshtech: 2,
  },
  {
    key: "cfa_usdt",
    fromLabel: "XAF / XOF", toLabel: "USDT",
    fromDesc: "XAF, XAFG, XOF, XOFT… (zone CFA)",
    toDesc: "USDT TRC20 (Tron)",
    fromFlag: "🌍", toFlag: "💵",
    color: "text-teal-600 dark:text-teal-400",
    providerLabel: "Frais fournisseur",
    defaultProvider: 1, defaultAshtech: 1,
  },
  {
    key: "usdt_cfa",
    fromLabel: "USDT", toLabel: "XAF / XOF",
    fromDesc: "USDT TRC20 (Tron)",
    toDesc: "XAF, XAFG, XOF, XOFT… (zone CFA)",
    fromFlag: "💵", toFlag: "🌍",
    color: "text-cyan-600 dark:text-cyan-400",
    providerLabel: "Frais fournisseur",
    defaultProvider: 1, defaultAshtech: 1,
  },
];

type FeeState = Record<string, string>;

function buildDefaultFees(): FeeState {
  const s: FeeState = {};
  CONVERSION_PAIRS.forEach(p => {
    s[`conversion_provider_fee_${p.key}`] = String(p.defaultProvider);
    s[`conversion_ashtech_fee_${p.key}`]  = String(p.defaultAshtech);
  });
  return s;
}

const CONV_PER_PAGE = 15;

export default function AdminConversionsPage() {
  const { toast } = useToast();
  const [fees, setFees] = useState<FeeState>(buildDefaultFees());
  const [convPage, setConvPage] = useState(0);

  // Read current pair-based fees from the API
  const { data: feeSettings } = useQuery<Record<string, number>>({
    queryKey: ["/api/public/fee-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/public/fee-settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (!feeSettings) return;
    setFees(prev => {
      const next = { ...prev };
      CONVERSION_PAIRS.forEach(p => {
        const pk = `conversion_provider_fee_${p.key}`;
        const ak = `conversion_ashtech_fee_${p.key}`;
        // camelCase key mapping sent by the API
        // Convert "xof_xaf" → "XofXaf" to match server camelCase keys
        const suffix = p.key
          .replace(/_([a-z])/g, (_, c) => c.toUpperCase())  // xof_xaf → xofXaf
          .replace(/^[a-z]/, c => c.toUpperCase());          // xofXaf  → XofXaf
        const apiPk = `convProviderFee${suffix}`;            // convProviderFeeXofXaf
        const apiAk = `convAshtechFee${suffix}`;             // convAshtechFeeXofXaf
        if (feeSettings[apiPk] !== undefined) next[pk] = String(feeSettings[apiPk]);
        if (feeSettings[apiAk] !== undefined) next[ak] = String(feeSettings[apiAk]);
      });
      return next;
    });
  }, [feeSettings]);

  const saveFeeMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        Object.entries(fees).map(([key, value]) =>
          apiRequest("POST", "/api/admin/settings", {
            key,
            value,
            description: `Frais de conversion — ${key}`,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/fee-settings"] });
      toast({ title: "Frais enregistrés", description: "Les frais de conversion par paire ont été mis à jour." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const { data: requests = [], isLoading, refetch } = useQuery<ConversionRequest[]>({
    queryKey: ["/api/admin/conversion-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/conversion-requests?status=all");
      return res.json();
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/conversion-requests/${id}/execute`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Erreur"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversion-requests"] });
      toast({ title: "Conversion exécutée ✅", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/conversion-requests/${id}/cancel`, { reason: "Annulé manuellement par admin" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Erreur"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversion-requests"] });
      toast({ title: "Conversion annulée", description: "Le solde a été remboursé à l'utilisateur." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const getTotal = (p: PairFeeConfig) => {
    const provider = parseFloat(fees[`conversion_provider_fee_${p.key}`] || "0") || 0;
    const ashtech  = parseFloat(fees[`conversion_ashtech_fee_${p.key}`]  || "0") || 0;
    return (provider + ashtech).toFixed(2);
  };

  // Ashtech margin displayed in admin
  const getAshtechMargin = (p: PairFeeConfig) => {
    return parseFloat(fees[`conversion_ashtech_fee_${p.key}`] || "0") || 0;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestion des Conversions</h1>
            <p className="text-muted-foreground">Historique des conversions et configuration des frais par paire de devises</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>

        {/* ── Configuration par paire ── */}
        <Card>
          <CardHeader>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Configuration</p>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4 text-muted-foreground" />
              Frais de conversion par paire de devises
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Le frais total prélevé à l'utilisateur = frais opérateurs + marge Ashtech Pay.
              Le suffixe (T, B, C, G…) indique uniquement le pays — XOFT=Togo, XOFC=Côte d'Ivoire, XAFG=Gabon, etc.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              {CONVERSION_PAIRS.map(p => {
                const provKey = `conversion_provider_fee_${p.key}`;
                const ashKey  = `conversion_ashtech_fee_${p.key}`;
                const total   = getTotal(p);
                const margin  = getAshtechMargin(p);
                return (
                  <div key={p.key} className="space-y-3 p-4 rounded-xl border bg-muted/20">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${p.color}`}>
                        {p.fromFlag} {p.fromLabel}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className={`text-sm font-bold ${p.color}`}>
                        {p.toFlag} {p.toLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {p.fromDesc} → {p.toDesc}
                    </p>

                    {/* Frais opérateurs */}
                    <div className="space-y-1.5">
                      <Label htmlFor={provKey} className="text-xs text-muted-foreground font-medium">
                        {p.providerLabel}
                      </Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          id={provKey}
                          type="number" inputMode="decimal" step="0.1" min="0" max="100"
                          value={fees[provKey]}
                          onChange={e => setFees(prev => ({ ...prev, [provKey]: e.target.value }))}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Marge Ashtech */}
                    <div className="space-y-1.5">
                      <Label htmlFor={ashKey} className="text-xs text-muted-foreground font-medium">
                        Marge Ashtech Pay
                      </Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          id={ashKey}
                          type="number" inputMode="decimal" step="0.1" min="0" max="100"
                          value={fees[ashKey]}
                          onChange={e => setFees(prev => ({ ...prev, [ashKey]: e.target.value }))}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Totaux */}
                    <div className="space-y-1 pt-1 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Equal className="w-3 h-3" />
                          Total prélevé (utilisateur)
                        </span>
                        <span className={`text-sm font-bold ${p.color}`}>{total}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">↳ dont marge Ashtech</span>
                        <span className="text-xs font-semibold text-primary">{margin.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={() => saveFeeMutation.mutate()}
                disabled={saveFeeMutation.isPending}
                className="gap-2"
              >
                {saveFeeMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />
                }
                Enregistrer les frais
              </Button>
              <p className="text-xs text-muted-foreground">
                Les frais sont déterminés par la paire de devises (famille XOF, XAF, CDF), indépendamment du fournisseur.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Historique ── */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Historique des conversions</p>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Aucun historique de conversion</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.slice(convPage * CONV_PER_PAGE, (convPage + 1) * CONV_PER_PAGE).map((req) => (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2 text-lg font-bold">
                            <span>{CURRENCY_FLAGS[req.fromCurrency] || "🌍"} {parseFloat(req.fromAmount).toLocaleString("fr-FR")} {req.fromCurrency}</span>
                            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                            <span>{CURRENCY_FLAGS[req.toCurrency] || "🌍"} {req.toAmount ? `${parseFloat(req.toAmount).toLocaleString("fr-FR")} ${req.toCurrency}` : "?"}</span>
                          </div>
                          <Badge variant={STATUS_LABELS[req.status]?.variant || "default"}>
                            {STATUS_LABELS[req.status]?.label || req.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {req.userFullName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {req.createdAt ? format(new Date(req.createdAt), "dd/MM/yyyy HH:mm", { locale: fr }) : "-"}
                          </span>
                          {req.notes && (() => {
                            try {
                              const n = JSON.parse(req.notes);
                              if (n.feePercent) return (
                                <span className="text-xs text-primary font-medium">Frais : {n.feePercent}</span>
                              );
                            } catch {}
                            return null;
                          })()}
                        </div>
                      </div>
                      {req.status === "pending" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm" className="gap-1.5 h-8 text-xs"
                            onClick={() => executeMutation.mutate(req.id)}
                            disabled={executeMutation.isPending || cancelMutation.isPending}
                            data-testid={`button-execute-conversion-${req.id}`}
                          >
                            {executeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            Forcer
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="gap-1.5 h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => cancelMutation.mutate(req.id)}
                            disabled={executeMutation.isPending || cancelMutation.isPending}
                            data-testid={`button-cancel-conversion-${req.id}`}
                          >
                            {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            Annuler
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {requests.length > CONV_PER_PAGE && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setConvPage(p => Math.max(0, p - 1))}
                    disabled={convPage === 0}
                    data-testid="button-conv-prev"
                  >
                    ← Précédent
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {convPage + 1} / {Math.ceil(requests.length / CONV_PER_PAGE)} · {requests.length} conversions
                  </span>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setConvPage(p => Math.min(Math.ceil(requests.length / CONV_PER_PAGE) - 1, p + 1))}
                    disabled={(convPage + 1) * CONV_PER_PAGE >= requests.length}
                    data-testid="button-conv-next"
                  >
                    Suivant →
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
