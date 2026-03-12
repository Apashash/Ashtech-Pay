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
import { ArrowLeftRight, CheckCircle, Clock, RefreshCw, Loader2, User, Calendar, Settings, Percent, Save } from "lucide-react";
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

const PROVIDER_LABELS: { key: string; label: string; description: string; color: string }[] = [
  {
    key: "conversion_fee_percent_swychr",
    label: "Swychr",
    description: "Frais appliqués pour les wallets alimentés via Swychr",
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "conversion_fee_percent_pixpay",
    label: "PixPay",
    description: "Frais appliqués pour les wallets alimentés via PixPay",
    color: "text-purple-600 dark:text-purple-400",
  },
  {
    key: "conversion_fee_percent_afribapay",
    label: "AfribaPay",
    description: "Frais appliqués pour les wallets alimentés via AfribaPay",
    color: "text-orange-600 dark:text-orange-400",
  },
];

export default function AdminConversionsPage() {
  const { toast } = useToast();
  const [fees, setFees] = useState<Record<string, string>>({
    conversion_fee_percent_swychr: "6",
    conversion_fee_percent_pixpay: "6",
    conversion_fee_percent_afribapay: "6",
  });

  // Load each provider fee
  const { data: swychrSetting } = useQuery<{ value: string }>({
    queryKey: ["/api/admin/settings/conversion_fee_percent_swychr"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/settings/conversion_fee_percent_swychr");
      return res.json();
    },
  });
  const { data: pixpaySetting } = useQuery<{ value: string }>({
    queryKey: ["/api/admin/settings/conversion_fee_percent_pixpay"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/settings/conversion_fee_percent_pixpay");
      return res.json();
    },
  });
  const { data: afribaSetting } = useQuery<{ value: string }>({
    queryKey: ["/api/admin/settings/conversion_fee_percent_afribapay"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/settings/conversion_fee_percent_afribapay");
      return res.json();
    },
  });

  useEffect(() => {
    setFees(prev => ({
      ...prev,
      conversion_fee_percent_swychr: swychrSetting?.value ?? prev.conversion_fee_percent_swychr,
      conversion_fee_percent_pixpay: pixpaySetting?.value ?? prev.conversion_fee_percent_pixpay,
      conversion_fee_percent_afribapay: afribaSetting?.value ?? prev.conversion_fee_percent_afribapay,
    }));
  }, [swychrSetting, pixpaySetting, afribaSetting]);

  const saveFeeMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        PROVIDER_LABELS.map(p =>
          apiRequest("POST", "/api/admin/settings", {
            key: p.key,
            value: fees[p.key],
            description: p.description,
          })
        )
      );
    },
    onSuccess: () => {
      PROVIDER_LABELS.forEach(p =>
        queryClient.invalidateQueries({ queryKey: [`/api/admin/settings/${p.key}`] })
      );
      toast({ title: "Frais mis à jour", description: "Les frais de conversion par fournisseur ont été enregistrés." });
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
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5 text-primary" />
              Frais de conversion par fournisseur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {PROVIDER_LABELS.map(p => (
                <div key={p.key} className="space-y-2 p-4 rounded-lg border bg-muted/20">
                  <Label htmlFor={p.key} className={`text-sm font-semibold ${p.color}`}>
                    {p.label}
                  </Label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id={p.key}
                      type="number"
                      value={fees[p.key]}
                      onChange={(e) => setFees(prev => ({ ...prev, [p.key]: e.target.value }))}
                      className="pl-9"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-2">
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
                Ces frais sont appliqués automatiquement selon le fournisseur qui a alimenté le wallet source de la conversion.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Historique des conversions
          </h2>
          
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
              {requests.map((req) => (
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
                          {req.notes && <span className="text-xs italic bg-muted px-2 py-0.5 rounded">{req.notes}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
