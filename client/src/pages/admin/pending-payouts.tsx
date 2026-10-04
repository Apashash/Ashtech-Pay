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
  BadgeCheck, ChevronDown, ChevronUp, Copy,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getOperatorDisplayName } from "@/lib/operator-logos";

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
  originalProvider: string | null;
  externalReference?: string | null;
  metadata?: Record<string, any> | null;
}

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  afribapay: { label: "AfribaPay", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  pixpay:    { label: "PixPay",    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  pawapay:   { label: "PawaPay",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  izichange: { label: "IziChange", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
};

type Action = { txId: string; type: "execute" | "confirm" | "refund" };

export default function AdminPendingPayoutsPage() {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: payouts = [], isLoading, refetch } = useQuery<PendingPayout[]>({
    queryKey: ["/api/admin/pending-payouts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/pending-payouts");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const executeMutation = useMutation({
    mutationFn: async ({ txId }: { txId: string }) => {
      const res = await apiRequest("POST", `/api/admin/pending-payouts/${txId}/execute`, {});
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || "Erreur") as Error & { pendingManual?: boolean };
        err.pendingManual = !!data.pendingManual;
        throw err;
      }
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/transactions/${variables.txId}/details`] });
      // Also refresh the withdrawals list so the pending row appears immediately
      // if the admin navigates there to watch the status update.
      toast({
        title: data.status === "completed"
          ? "Paiement confirmé"
          : data.status === "failed" || data.status === "cancelled"
            ? "Paiement rejeté"
            : "Payout soumis",
        description: data.message,
      });
      setLoadingId(null);
    },
    onError: (error: Error & { pendingManual?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      if (error.pendingManual) {
        // Not a real failure — the transaction stays pending_manual for retry,
        // exactly like the standard withdrawal/transfer flow does.
        toast({ title: "Toujours en attente", description: error.message });
      } else {
        toast({ title: "Échec", description: error.message, variant: "destructive" });
      }
      setLoadingId(null);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (txId: string) => {
      const res = await apiRequest("POST", `/api/admin/pending-payouts/${txId}/confirm`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Erreur"); }
      return res.json();
    },
    onSuccess: (data, txId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/transactions/${txId}/details`] });
      toast({ title: "Confirmé", description: data.message });
      setLoadingId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setLoadingId(null);
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (txId: string) => {
      const res = await apiRequest("POST", `/api/admin/pending-payouts/${txId}/refund`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Erreur"); }
      return res.json();
    },
    onSuccess: (data, txId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/transactions/${txId}/details`] });
      toast({
        title: data.status === "completed" ? "Paiement déjà effectué" : "Remboursé",
        description: data.message,
      });
      setLoadingId(null);
    },
    onError: (error: Error, txId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/transactions/${txId}/details`] });
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setLoadingId(null);
    },
  });

  const handleConfirm = () => {
    if (!confirmAction) return;
    setLoadingId(confirmAction.txId);
    if (confirmAction.type === "execute") {
      executeMutation.mutate({ txId: confirmAction.txId });
    } else if (confirmAction.type === "confirm") {
      confirmMutation.mutate(confirmAction.txId);
    } else if (confirmAction.type === "refund") {
      refundMutation.mutate(confirmAction.txId);
    }
    setConfirmAction(null);
  };

  const confirmLabel =
    confirmAction?.type === "refund"
      ? "Rembourser immédiatement et annuler ? Le fournisseur peut encore payer ensuite, ce qui peut provoquer un double paiement."
      : confirmAction?.type === "confirm"
        ? "Marquer comme effectué sans relancer le fournisseur ? Son résultat réel peut encore différer."
        : `Resoumettre via ${confirmAction ? PROVIDER_LABELS[payouts.find(p => p.id === confirmAction.txId)?.originalProvider || ""]?.label || "le fournisseur configuré" : "le fournisseur configuré"} ? Le fournisseur avait explicitement refusé la tentative pour solde insuffisant; aucun changement de fournisseur ne sera possible.`;

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Retraits & Transferts en attente
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Transactions bloquées — cliquez sur un bloc pour gérer.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : payouts.length === 0 ? (
          <Card className="flex-1">
            <CardContent className="py-16 text-center text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400 opacity-60" />
              <p className="font-medium">Aucune transaction en attente</p>
              <p className="text-sm mt-1">Toutes les transactions ont été traitées.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2 flex-shrink-0">
              {payouts.length} transaction{payouts.length > 1 ? "s" : ""} en attente
            </p>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {payouts.map((payout) => {
                const isExpanded = expandedId === payout.id;
                const isBusy = loadingId === payout.id;
                const isIziChange = payout.metadata?.paymentProvider === "izichange" || payout.originalProvider === "izichange";
                const retryAllowed =
                  payout.metadata?.payoutRetrySafe === true &&
                  payout.metadata?.payoutRetryProvider === payout.originalProvider;
                const providerInfo = PROVIDER_LABELS[payout.originalProvider || ""] || {
                  label: "Fournisseur non identifié",
                  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                };

                return (
                  <Card
                    key={payout.id}
                    className={`border transition-all duration-200 ${
                      isExpanded
                        ? "border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/15"
                        : "border-amber-200/60 dark:border-amber-800/30 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/20 dark:hover:bg-amber-950/10"
                    }`}
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedId(isExpanded ? null : payout.id)}
                      data-testid={`row-payout-${payout.id}`}
                    >
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {payout.type === "withdrawal"
                            ? <ArrowUpRight className="w-4 h-4 text-amber-600" />
                            : <Send className="w-4 h-4 text-amber-600" />
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">
                              {parseFloat(payout.amount).toLocaleString("fr-FR")} {payout.currency}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${providerInfo.color}`}>
                              {providerInfo.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                               {getOperatorDisplayName(payout.operatorName) || "—"} · {payout.recipientCountry || "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground truncate font-mono">{payout.reference}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {payout.createdAt ? format(new Date(payout.createdAt), "dd/MM HH:mm", { locale: fr }) : "—"}
                            </span>
                          </div>
                        </div>

                        <div className="flex-shrink-0 text-muted-foreground">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-amber-200/60 dark:border-amber-800/30">
                        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Montant net / Débité</p>
                            <p className="font-bold">
                              {parseFloat(payout.amount).toLocaleString("fr-FR")} {payout.currency}
                              {payout.totalAmount && parseFloat(payout.totalAmount) !== parseFloat(payout.amount) && (
                                <span className="text-xs text-muted-foreground font-normal ml-1">
                                  (débité: {parseFloat(payout.totalAmount).toLocaleString("fr-FR")})
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Opérateur / Pays</p>
                             <p className="font-medium">{getOperatorDisplayName(payout.operatorName) || "—"} · {payout.recipientCountry || "—"}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Utilisateur</p>
                            <p className="font-medium">{payout.userFullName}</p>
                            <p className="text-xs text-muted-foreground">{payout.userEmail}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Bénéficiaire</p>
                            <p className="font-medium">{payout.recipientName || "—"}</p>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-mono">{payout.recipientPhone || "—"}</p>
                              {payout.recipientPhone && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(payout.recipientPhone!);
                                    toast({ title: "Numéro copié !" });
                                  }}
                                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                                  title="Copier le numéro"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {retryAllowed ? (
                          <div className="mb-3 rounded-md border border-green-300 bg-green-50 p-3 text-xs text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300">
                            <p className="font-semibold">Refus explicite pour solde fournisseur insuffisant.</p>
                            <p className="mt-1">Après recharge, relancez uniquement via {providerInfo.label}. Le résultat sera confirmé par le fournisseur et non par ce bouton.</p>
                            {payout.metadata?.payoutLastRejectedAttempt?.reference && (
                              <p className="mt-1 font-mono break-all">
                                Tentative refusée : {String(payout.metadata.payoutLastRejectedAttempt.reference)}
                              </p>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => setConfirmAction({ txId: payout.id, type: "execute" })}
                              className={`mt-2 gap-1.5 text-xs ${providerInfo.color} border-current/20`}
                              data-testid={`btn-execute-${payout.originalProvider}-${payout.id}`}
                            >
                              {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Banknote className="w-3 h-3" />}
                              Relancer via {providerInfo.label}
                            </Button>
                          </div>
                        ) : isIziChange ? (
                          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                            <p className="font-semibold">Vérification IziChange requise — ne pas renvoyer ce paiement.</p>
                            {payout.metadata?.iziInitiationError && (
                              <p className="mt-1">Erreur enregistrée : {String(payout.metadata.iziInitiationError)}</p>
                            )}
                            {(payout.externalReference || payout.metadata?.iziPayoutId) && (
                              <p className="mt-1 font-mono break-all">
                                ID IziChange : {String(payout.externalReference || payout.metadata?.iziPayoutId)}
                              </p>
                            )}
                          </div>
                        ) : payout.externalReference ? (
                          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                            <p className="font-semibold">Référence fournisseur déjà enregistrée.</p>
                            <p className="mt-1">Le résultat de cette tentative doit être vérifié. Aucune nouvelle soumission n'est autorisée tant que le fournisseur n'a pas explicitement refusé le paiement pour solde insuffisant.</p>
                            <p className="mt-1 font-mono break-all">{payout.externalReference}</p>
                          </div>
                        ) : (
                          <div className="mb-3">
                            <p className="text-xs text-muted-foreground">
                              Nouvelle soumission désactivée : aucune réponse explicite confirmant un refus pour solde insuffisant n'est enregistrée.
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/30">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => setConfirmAction({ txId: payout.id, type: "confirm" })}
                            className="gap-1.5 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/20"
                            data-testid={`btn-confirm-${payout.id}`}
                          >
                            {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <BadgeCheck className="w-3 h-3" />}
                            Confirmer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => setConfirmAction({ txId: payout.id, type: "refund" })}
                            className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/20"
                            data-testid={`btn-refund-${payout.id}`}
                          >
                            <XCircle className="w-3 h-3" />
                            Rembourser & Annuler
                          </Button>
                        </div>

                        <div className="mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            "Confirmer" marque comme effectué sans appeler de provider — utilisez si vous avez payé manuellement.
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
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
