import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/pages/admin/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock, RefreshCw, Loader2, User, Phone, Banknote,
  ArrowUpRight, Send, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PendingPayout {
  id: string;
  type: "withdrawal" | "transfer_out";
  amount: string;
  currency: string;
  totalAmount: string;
  reference: string;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientCountry: string | null;
  description: string | null;
  createdAt: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  operatorName: string | null;
  originalProvider: string;
}

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  swychr:    { label: "Swychr",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  afribapay: { label: "AfribaPay", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  pixpay:    { label: "PixPay",    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

type Action = { txId: string; type: "execute" | "refund"; provider?: "swychr" | "afribapay" | "pixpay" };

export default function AdminPendingPayoutsPage() {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data: payouts = [], isLoading, refetch } = useQuery<PendingPayout[]>({
    queryKey: ["/api/admin/pending-payouts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/pending-payouts");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const executeMutation = useMutation({
    mutationFn: async ({ txId, provider }: { txId: string; provider: string }) => {
      const res = await apiRequest("POST", `/api/admin/pending-payouts/${txId}/execute`, { provider });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur lors de l'exécution");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payouts"] });
      toast({ title: "Payout soumis", description: data.message });
      setLoadingId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Échec", description: error.message, variant: "destructive" });
      setLoadingId(null);
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (txId: string) => {
      const res = await apiRequest("POST", `/api/admin/pending-payouts/${txId}/refund`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur lors du remboursement");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payouts"] });
      toast({ title: "Remboursé", description: data.message });
      setLoadingId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setLoadingId(null);
    },
  });

  const handleConfirm = () => {
    if (!confirmAction) return;
    setLoadingId(confirmAction.txId);
    if (confirmAction.type === "execute" && confirmAction.provider) {
      executeMutation.mutate({ txId: confirmAction.txId, provider: confirmAction.provider });
    } else if (confirmAction.type === "refund") {
      refundMutation.mutate(confirmAction.txId);
    }
    setConfirmAction(null);
  };

  const confirmLabel = confirmAction?.type === "refund"
    ? "Rembourser l'utilisateur et annuler cette transaction ?"
    : `Soumettre via ${confirmAction?.provider ? PROVIDER_LABELS[confirmAction.provider]?.label : ""} ?`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-500" />
              Retraits & Transferts en attente
            </h1>
            <p className="text-muted-foreground mt-1">
              Transactions bloquées (IP non autorisée ou solde insuffisant) — choisissez le fournisseur pour les traiter.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : payouts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-green-400 opacity-60" />
              <p className="text-lg font-medium">Aucune transaction en attente</p>
              <p className="text-sm mt-1">Toutes les transactions ont été traitées.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {payouts.length} transaction{payouts.length > 1 ? "s" : ""} en attente de traitement manuel
            </p>
            {payouts.map((payout) => {
              const isLoading = loadingId === payout.id;
              const providerInfo = PROVIDER_LABELS[payout.originalProvider] || PROVIDER_LABELS.swychr;
              return (
                <Card key={payout.id} className="border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10">
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                            <AlertTriangle className="w-3 h-3" />
                            En attente manuel
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            {payout.type === "withdrawal"
                              ? <><ArrowUpRight className="w-3 h-3" /> Retrait</>
                              : <><Send className="w-3 h-3" /> Transfert</>
                            }
                          </Badge>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${providerInfo.color}`}>
                            Fournisseur initial: {providerInfo.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Montant net / Total débité</p>
                            <p className="font-bold text-lg">
                              {parseFloat(payout.amount).toLocaleString("fr-FR")} {payout.currency}
                              {payout.totalAmount && parseFloat(payout.totalAmount) !== parseFloat(payout.amount) && (
                                <span className="text-xs text-muted-foreground font-normal ml-2">
                                  (débité: {parseFloat(payout.totalAmount).toLocaleString("fr-FR")})
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Opérateur / Pays</p>
                            <p className="font-medium">{payout.operatorName || "—"} · {payout.recipientCountry || "—"}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs flex items-center gap-1"><User className="w-3 h-3" /> Utilisateur</p>
                            <p className="font-medium">{payout.userFullName}</p>
                            <p className="text-xs text-muted-foreground">{payout.userEmail}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Bénéficiaire</p>
                            <p className="font-medium">{payout.recipientName || "—"}</p>
                            <p className="text-xs font-mono">{payout.recipientPhone || "—"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="font-mono">{payout.reference}</span>
                          <span>{payout.createdAt ? format(new Date(payout.createdAt), "dd/MM/yyyy HH:mm", { locale: fr }) : "—"}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 min-w-[200px]">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exécuter via :</p>
                        {(["swychr", "afribapay", "pixpay"] as const).map((p) => (
                          <Button
                            key={p}
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => setConfirmAction({ txId: payout.id, type: "execute", provider: p })}
                            className={`justify-start gap-2 ${PROVIDER_LABELS[p].color} border-current/20`}
                            data-testid={`btn-execute-${p}-${payout.id}`}
                          >
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Banknote className="w-3 h-3" />}
                            {PROVIDER_LABELS[p].label}
                          </Button>
                        ))}
                        <div className="pt-1 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => setConfirmAction({ txId: payout.id, type: "refund" })}
                            className="justify-start gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/20 w-full"
                            data-testid={`btn-refund-${payout.id}`}
                          >
                            <XCircle className="w-3 h-3" />
                            Rembourser & Annuler
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'action</AlertDialogTitle>
            <AlertDialogDescription>{confirmLabel}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
