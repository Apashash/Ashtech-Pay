import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/pages/admin/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeftRight, CheckCircle, XCircle, Clock, RefreshCw, Loader2, User, Calendar } from "lucide-react";
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
  const [filter, setFilter] = useState<"all" | "pending">("pending");
  const [cancelTarget, setCancelTarget] = useState<ConversionRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const { data: requests = [], isLoading, refetch } = useQuery<ConversionRequest[]>({
    queryKey: ["/api/admin/conversion-requests", filter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/conversion-requests?status=${filter === "pending" ? "pending" : "all"}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/conversion-requests/${id}/execute`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversion-requests"] });
      toast({
        title: "Conversion exécutée",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/conversion-requests/${id}/cancel`, { reason });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversion-requests"] });
      toast({ title: "Annulation effectuée", description: "La demande a été annulée et le montant remboursé." });
      setCancelTarget(null);
      setCancelReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Conversions en attente</h1>
            <p className="text-muted-foreground">Gérez les demandes de conversion de devises des utilisateurs</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>

        {pendingCount > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-600">{pendingCount} demande{pendingCount > 1 ? "s" : ""} en attente</p>
                <p className="text-sm text-muted-foreground">
                  Rechargez le compte Swychr puis cliquez sur "Exécuter" pour traiter ces conversions.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            <Clock className="w-4 h-4 mr-2" />
            En attente
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Toutes
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Aucune demande de conversion</p>
              <p className="text-sm mt-1">Les demandes des utilisateurs apparaîtront ici</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <Card key={req.id} className={req.status === "pending" ? "border-amber-500/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-lg font-bold">
                          <span>{CURRENCY_FLAGS[req.fromCurrency] || "🌍"} {parseFloat(req.fromAmount).toLocaleString("fr-FR")} {req.fromCurrency}</span>
                          <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                          <span>{CURRENCY_FLAGS[req.toCurrency] || "🌍"}
                            {req.toAmount
                              ? ` ${parseFloat(req.toAmount).toLocaleString("fr-FR")} ${req.toCurrency}`
                              : ` ? ${req.toCurrency}`
                            }
                          </span>
                        </div>
                        <Badge variant={STATUS_LABELS[req.status]?.variant || "default"}>
                          {STATUS_LABELS[req.status]?.label || req.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {req.userFullName} ({req.userEmail})
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {req.createdAt ? format(new Date(req.createdAt), "dd MMM yyyy à HH:mm", { locale: fr }) : "-"}
                        </span>
                        {req.executedAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Traité le {format(new Date(req.executedAt), "dd MMM yyyy à HH:mm", { locale: fr })}
                          </span>
                        )}
                        {req.notes && <span className="italic">Note: {req.notes}</span>}
                      </div>
                    </div>
                    {req.status === "pending" && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => executeMutation.mutate(req.id)}
                          disabled={executeMutation.isPending}
                          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {executeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Exécuter
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setCancelTarget(req); setCancelReason(""); }}
                          disabled={cancelMutation.isPending}
                          className="gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10"
                        >
                          <XCircle className="w-4 h-4" />
                          Annuler
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Annuler la conversion</DialogTitle>
              <DialogDescription>
                Le montant de {cancelTarget && parseFloat(cancelTarget.fromAmount).toLocaleString("fr-FR")} {cancelTarget?.fromCurrency} sera remboursé à l'utilisateur.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Textarea
                placeholder="Raison de l'annulation (optionnel)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setCancelTarget(null)}>Retour</Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelTarget && cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason })}
                >
                  {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirmer l'annulation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
