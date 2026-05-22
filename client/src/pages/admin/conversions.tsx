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
import { ArrowLeftRight, CheckCircle, Clock, RefreshCw, Loader2, User, Calendar, Settings, Percent, Save, Equal, Zap, XCircle } from "lucide-react";
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

interface ProviderFeeConfig {
  key: string;
  label: string;
  color: string;
  providerFeeSettingKey: string;
  ashtechFeeSettingKey: string;
}

const PROVIDERS: ProviderFeeConfig[] = [
  {
    key: "swychr",
    label: "Swychr",
    color: "text-blue-600 dark:text-blue-400",
    providerFeeSettingKey: "conversion_provider_fee_swychr",
    ashtechFeeSettingKey: "conversion_ashtech_fee_swychr",
  },
  {
    key: "pixpay",
    label: "PixPay",
    color: "text-purple-600 dark:text-purple-400",
    providerFeeSettingKey: "conversion_provider_fee_pixpay",
    ashtechFeeSettingKey: "conversion_ashtech_fee_pixpay",
  },
  {
    key: "afribapay",
    label: "AfribaPay",
    color: "text-orange-600 dark:text-orange-400",
    providerFeeSettingKey: "conversion_provider_fee_afribapay",
    ashtechFeeSettingKey: "conversion_ashtech_fee_afribapay",
  },
];

type FeeState = Record<string, string>;

const DEFAULT_FEES: FeeState = {
  conversion_provider_fee_swychr: "4",
  conversion_ashtech_fee_swychr: "2",
  conversion_provider_fee_pixpay: "4",
  conversion_ashtech_fee_pixpay: "2",
  conversion_provider_fee_afribapay: "4",
  conversion_ashtech_fee_afribapay: "2",
};

const CONV_PER_PAGE = 15;

export default function AdminConversionsPage() {
  const { toast } = useToast();
  const [fees, setFees] = useState<FeeState>(DEFAULT_FEES);
  const [convPage, setConvPage] = useState(0);

  const { data: feeSettings } = useQuery<{
    convProviderFeeSwychr: number; convAshtechFeeSwychr: number;
    convProviderFeePixpay: number; convAshtechFeePixpay: number;
    convProviderFeeAfribapay: number; convAshtechFeeAfribapay: number;
  }>({
    queryKey: ["/api/public/fee-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/public/fee-settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (!feeSettings) return;
    setFees({
      conversion_provider_fee_swychr: String(feeSettings.convProviderFeeSwychr ?? 4),
      conversion_ashtech_fee_swychr: String(feeSettings.convAshtechFeeSwychr ?? 2),
      conversion_provider_fee_pixpay: String(feeSettings.convProviderFeePixpay ?? 4),
      conversion_ashtech_fee_pixpay: String(feeSettings.convAshtechFeePixpay ?? 2),
      conversion_provider_fee_afribapay: String(feeSettings.convProviderFeeAfribapay ?? 4),
      conversion_ashtech_fee_afribapay: String(feeSettings.convAshtechFeeAfribapay ?? 2),
    });
  }, [feeSettings]);

  const saveFeeMutation = useMutation({
    mutationFn: async () => {
      const allKeys = Object.keys(fees);
      await Promise.all(
        allKeys.map(key =>
          apiRequest("POST", "/api/admin/settings", {
            key,
            value: fees[key],
            description: `Frais de conversion — ${key}`,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/fee-settings"] });
      toast({ title: "Frais enregistrés", description: "Les frais de conversion par fournisseur ont été mis à jour." });
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur lors de l'exécution");
      }
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur lors de l'annulation");
      }
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

  const getTotal = (p: ProviderFeeConfig) => {
    const provider = parseFloat(fees[p.providerFeeSettingKey] || "0") || 0;
    const ashtech = parseFloat(fees[p.ashtechFeeSettingKey] || "0") || 0;
    return (provider + ashtech).toFixed(2);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestion des Conversions</h1>
            <p className="text-muted-foreground">Historique des conversions et configuration des frais par fournisseur</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>

        <Card>
          <CardHeader>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Configuration</p>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4 text-muted-foreground" />
              Frais de conversion par fournisseur
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Pour chaque fournisseur : configurez le frais du fournisseur et la marge Ashtech Pay séparément.
              Le frais total prélevé à l'utilisateur est la somme des deux.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-3">
              {PROVIDERS.map(p => {
                const total = getTotal(p);
                return (
                  <div key={p.key} className="space-y-3 p-4 rounded-xl border bg-muted/20">
                    <p className={`text-sm font-bold ${p.color}`}>{p.label}</p>

                    <div className="space-y-1.5">
                      <Label htmlFor={p.providerFeeSettingKey} className="text-xs text-muted-foreground font-medium">
                        Frais fournisseur
                      </Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          id={p.providerFeeSettingKey}
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          max="100"
                          value={fees[p.providerFeeSettingKey]}
                          onChange={e => setFees(prev => ({ ...prev, [p.providerFeeSettingKey]: e.target.value }))}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={p.ashtechFeeSettingKey} className="text-xs text-muted-foreground font-medium">
                        Frais Ashtech Pay
                      </Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          id={p.ashtechFeeSettingKey}
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          max="100"
                          value={fees[p.ashtechFeeSettingKey]}
                          onChange={e => setFees(prev => ({ ...prev, [p.ashtechFeeSettingKey]: e.target.value }))}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Equal className="w-3 h-3" />
                        Total prélevé
                      </span>
                      <span className={`text-sm font-bold ${p.color}`}>{total}%</span>
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
                Les frais sont appliqués selon le fournisseur de la dernière transaction entrante de l'utilisateur.
              </p>
            </div>
          </CardContent>
        </Card>

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
                        </div>
                      </div>
                      {req.status === "pending" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="gap-1.5 h-8 text-xs"
                            onClick={() => executeMutation.mutate(req.id)}
                            disabled={executeMutation.isPending || cancelMutation.isPending}
                            data-testid={`button-execute-conversion-${req.id}`}
                          >
                            {executeMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Zap className="w-3.5 h-3.5" />
                            )}
                            Forcer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => cancelMutation.mutate(req.id)}
                            disabled={executeMutation.isPending || cancelMutation.isPending}
                            data-testid={`button-cancel-conversion-${req.id}`}
                          >
                            {cancelMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
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
