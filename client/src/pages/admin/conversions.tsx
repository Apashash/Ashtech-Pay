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
import { ArrowLeftRight, CheckCircle, Clock, RefreshCw, Loader2, User, Calendar, Settings, Percent } from "lucide-react";
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

export default function AdminConversionsPage() {
  const { toast } = useToast();
  const [feePercent, setFeePercent] = useState("6");

  const { data: setting, isLoading: isLoadingSetting } = useQuery<{ value: string }>({
    queryKey: ["/api/admin/settings/conversion_fee_percent"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/settings/conversion_fee_percent");
      return res.json();
    },
  });

  useEffect(() => {
    if (setting?.value) {
      setFeePercent(setting.value);
    }
  }, [setting]);

  const updateFeeMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await apiRequest("POST", "/api/admin/settings", {
        key: "conversion_fee_percent",
        value,
        description: "Pourcentage de frais pour les conversions de devises"
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/conversion_fee_percent"] });
      toast({ title: "Frais mis à jour", description: `Les frais de conversion sont maintenant de ${feePercent}%` });
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
            <p className="text-muted-foreground">Historique des conversions et configuration des frais</p>
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
              Paramètres de conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label htmlFor="fee">Frais de conversion par défaut (%)</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="fee"
                    type="number"
                    value={feePercent}
                    onChange={(e) => setFeePercent(e.target.value)}
                    className="pl-9"
                    step="0.1"
                    min="0"
                  />
                </div>
              </div>
              <Button 
                onClick={() => updateFeeMutation.mutate(feePercent)}
                disabled={updateFeeMutation.isPending || isLoadingSetting}
                className="gap-2"
              >
                {updateFeeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer les frais
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Ces frais sont appliqués automatiquement lors de chaque conversion effectuée par les utilisateurs.
            </p>
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
                          {req.notes && <span className="text-xs italic bg-muted px-2 py-0.5 rounded">Note sync Swychr: {req.notes}</span>}
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
