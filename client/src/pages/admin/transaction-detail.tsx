import { getAdminPath } from "@/lib/adminPath";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "./layout";
const A = getAdminPath();
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle, XCircle, Clock, ArrowLeft, Copy, User as UserIcon,
  Mail, Phone, MapPin, CreditCard, FileText, Calendar, Link2,
  Zap, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, RefreshCw, AlertTriangle, Globe, Coins, Hash
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SupportedCurrency } from "@shared/schema";

interface TransactionDetails {
  id: string;
  type: string;
  amount: string;
  feeAmount?: string | null;
  totalAmount?: string | null;
  currency: string;
  status: string;
  reference?: string | null;
  externalReference?: string | null;
  paymentMethod?: string | null;
  ashtechFeeAmount?: string | null;
  description?: string | null;
  createdAt?: Date | string | null;
  recipientPhone?: string | null;
  payerName?: string | null;
  payerEmail?: string | null;
  recipientName?: string | null;
  recipientCountry?: string | null;
  source?: string | null;
  user?: { id?: string; fullName: string; email: string; username: string; country?: string; phone?: string } | null;
  paymentIntent?: { payerName?: string; payerEmail?: string; payerPhone?: string; payerCountry?: string } | null;
  paymentLink?: { title: string; slug: string } | null;
  recipient?: { fullName: string; email: string; username: string; country?: string } | null;
  operator?: { id: string; name: string; type: string; paymentProvider: string; depositPaymentProvider?: string | null } | null;
  metadata?: { assetCode?: string; address?: string; memo?: string; [key: string]: any } | null;
}

const typeLabels: Record<string, string> = {
  deposit: "Dépôt",
  withdrawal: "Retrait",
  transfer_in: "Transfert reçu",
  transfer_out: "Transfert envoyé",
  payment_link: "Lien de paiement",
};

const paymentMethodLabels: Record<string, string> = {
  mobile_money: "Mobile Money",
  crypto: "Crypto",
  bank_transfer: "Virement bancaire",
  card: "Carte bancaire",
  paypal: "PayPal",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1"><CheckCircle className="w-3.5 h-3.5" />Validé</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1"><Clock className="w-3.5 h-3.5" />En attente</Badge>;
    case "processing":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1"><RefreshCw className="w-3.5 h-3.5" />En cours</Badge>;
    case "failed":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1"><XCircle className="w-3.5 h-3.5" />Échoué</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 gap-1"><XCircle className="w-3.5 h-3.5" />Annulé</Badge>;
    case "refunded":
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1"><RefreshCw className="w-3.5 h-3.5" />Remboursé</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function isIncoming(type: string) {
  return ["deposit", "transfer_in", "payment_link"].includes(type);
}

function getTypeIcon(type: string) {
  switch (type) {
    case "deposit": return <ArrowDownCircle className="w-5 h-5 text-green-500" />;
    case "withdrawal": return <ArrowUpCircle className="w-5 h-5 text-orange-500" />;
    case "transfer_in": return <ArrowLeftRight className="w-5 h-5 text-blue-500" />;
    case "transfer_out": return <ArrowLeftRight className="w-5 h-5 text-blue-500" />;
    case "payment_link": return <Link2 className="w-5 h-5 text-purple-500" />;
    default: return null;
  }
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        {icon}
        <span className="text-sm whitespace-nowrap">{label}</span>
      </div>
      <div className="text-sm font-medium text-right min-w-0 break-all">{value}</div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Validé",
  failed: "Échoué",
  cancelled: "Annulé",
  pending: "En attente",
  processing: "En cours",
  refunded: "Remboursé",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:         ["completed", "failed", "cancelled"],
  pending_manual:  ["completed", "failed", "cancelled"],
  processing:      ["completed", "failed", "pending"],
  failed:          ["pending"],
  cancelled:       ["pending"],
  completed:       ["pending", "failed", "cancelled"],
};

export default function AdminTransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [modalStatus, setModalStatus] = useState("");
  const [modalReason, setModalReason] = useState("");
  const [confirmRevert, setConfirmRevert] = useState(false);

  const { data: tx, isLoading, refetch } = useQuery<TransactionDetails>({
    queryKey: [`/api/admin/transactions/${id}/details`],
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, reason, forceComplete }: { status: string; reason?: string; forceComplete?: boolean }) => {
      await apiRequest("PATCH", `/api/admin/transactions/${id}`, {
        status,
        reason: reason || "Action admin",
        ...(forceComplete ? { forceComplete: true } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/transactions/${id}/details`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      toast({ title: "Statut mis à jour" });
      refetch();
      setModalReason("");
      setModalStatus("");
      setConfirmRevert(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié !" });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!tx) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => history.back()} className="gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" />Retour
          </Button>
          <p className="text-muted-foreground">Transaction introuvable.</p>
        </div>
      </AdminLayout>
    );
  }

  const amountColor = tx.status === "completed"
    ? (isIncoming(tx.type) ? "text-green-400" : "text-red-400")
    : tx.status === "pending" ? "text-amber-400" : "text-muted-foreground";

  const cryptoMeta = tx.paymentMethod === "crypto" && tx.metadata
    ? {
        assetCode: tx.metadata.assetCode || tx.description?.match(/crypto ([A-Z0-9.]+) —/)?.[1] || "",
        gross: Number(tx.metadata.grossAmountUsdt ?? tx.totalAmount ?? tx.amount),
        totalFeeAmount: Number(tx.metadata.totalFeeAmountUsdt ?? tx.feeAmount ?? 0),
        totalFeePercent: Number(tx.metadata.totalFeePercent ?? 0),
        credited: Number(tx.metadata.creditedAmountUsdt ?? tx.amount),
      }
    : null;
  const cryptoCoinName = cryptoMeta?.assetCode ? cryptoMeta.assetCode.split(".")[0] : "USDT";

  const isTerminal = tx.status === "refunded";
  const allowedTransitions = VALID_TRANSITIONS[tx.status] ?? [];

  const isRevertingCompleted = tx.status === "completed" && (modalStatus === "failed" || modalStatus === "cancelled");
  const isDepositRevert = isRevertingCompleted && (tx.type === "deposit" || tx.type === "payment_link");
  const isWithdrawalRevert = isRevertingCompleted && (tx.type === "withdrawal" || tx.type === "transfer_out");

  const handleApply = () => {
    if (isRevertingCompleted && !confirmRevert) {
      setConfirmRevert(true);
      return;
    }
    const isWithdrawalOrTransfer = tx.type === "withdrawal" || tx.type === "transfer_out";
    updateStatusMutation.mutate({
      status: modalStatus,
      reason: modalReason,
      ...(isWithdrawalOrTransfer ? { forceComplete: true } : {}),
    });
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => history.back()} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            {getTypeIcon(tx.type)}
            <h1 className="text-xl font-bold">{typeLabels[tx.type] || tx.type}</h1>
          </div>
          {getStatusBadge(tx.status)}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-4">
              {cryptoMeta ? (
                <>
                  <p className={`text-4xl font-bold ${amountColor}`}>
                    {isIncoming(tx.type) ? "+" : "-"}{cryptoMeta.credited.toFixed(4)} USDT
                  </p>
                  {cryptoMeta.assetCode && (
                    <p className="text-xs text-amber-500 font-mono mt-0.5">{cryptoMeta.assetCode}</p>
                  )}
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p>Montant débité : <span className="text-foreground font-medium">{cryptoMeta.gross.toFixed(4)} USDT</span></p>
                    <p>Frais ({cryptoMeta.totalFeePercent}%) : <span className="text-amber-500 font-medium">{cryptoMeta.totalFeeAmount.toFixed(4)} USDT</span></p>
                    <p className="font-semibold text-green-500">Montant net crédité : {cryptoMeta.credited.toFixed(4)} USDT</p>
                    <p className="text-xs">Frais fournisseur : {Number(tx.metadata?.providerFeeAmountUsdt || 0).toFixed(4)} USDT ({Number(tx.metadata?.providerFeePercent || 0)}%)</p>
                    <p className="text-xs">Frais AshTechPay : {Number(tx.metadata?.ashtechFeeAmountUsdt || tx.ashtechFeeAmount || 0).toFixed(4)} USDT ({Number(tx.metadata?.ashtechFeePercent || 0)}%)</p>
                  </div>
                </>
              ) : (
                <>
                  <p className={`text-4xl font-bold ${amountColor}`}>
                    {isIncoming(tx.type) ? "+" : "-"}{formatCurrency(parseFloat(tx.amount), (tx.currency || "XAF") as SupportedCurrency)}
                  </p>
                  {tx.feeAmount && parseFloat(tx.feeAmount) > 0 && (
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <p>Frais : {formatCurrency(tx.feeAmount, (tx.currency || "XAF") as SupportedCurrency)}</p>
                      <p>Total payé : {formatCurrency(tx.totalAmount || tx.amount, (tx.currency || "XAF") as SupportedCurrency)}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Transaction</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {tx.reference && (
              <InfoRow
                icon={<FileText className="w-4 h-4" />}
                label="Réf. interne"
                value={
                  <div className="flex items-center gap-1 justify-end">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">{tx.reference}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(tx.reference!)} data-testid="button-copy-ref">
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                }
              />
            )}
            {tx.externalReference && (
              <InfoRow
                icon={<Link2 className="w-4 h-4" />}
                label="Réf. externe"
                value={
                  <div className="flex items-center gap-1 justify-end">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">{tx.externalReference}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(tx.externalReference!)} data-testid="button-copy-ext-ref">
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                }
              />
            )}
            {tx.paymentMethod && (
              <InfoRow icon={<CreditCard className="w-4 h-4" />} label="Méthode" value={paymentMethodLabels[tx.paymentMethod] || tx.paymentMethod} />
            )}
            {tx.recipientPhone && (
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Numéro utilisé" value={<span className="font-mono">{tx.recipientPhone}</span>} />
            )}
            {tx.createdAt && (
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Date" value={format(new Date(tx.createdAt), "d MMMM yyyy à HH:mm", { locale: fr })} />
            )}
            {tx.description && (
              <InfoRow icon={<FileText className="w-4 h-4" />} label="Description" value={tx.description} />
            )}
          </CardContent>
        </Card>

        {tx.user && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                {tx.type === "payment_link" ? "Bénéficiaire" : "Utilisateur"}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <InfoRow icon={<UserIcon className="w-4 h-4" />} label="Nom" value={
                <button className="text-primary hover:underline font-medium text-right" onClick={() => navigate(`${A}/users/${tx.user?.id || ""}`)}>
                  {tx.user.fullName}
                </button>
              } />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={<span className="break-all">{tx.user.email}</span>} />
              {tx.user.phone && <InfoRow icon={<Phone className="w-4 h-4" />} label="Téléphone" value={tx.user.phone} />}
              {tx.user.country && <InfoRow icon={<MapPin className="w-4 h-4" />} label="Pays" value={tx.user.country} />}
            </CardContent>
          </Card>
        )}

        {(tx.payerName || tx.payerEmail || tx.paymentIntent?.payerName || tx.paymentIntent?.payerPhone) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Payeur</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {(tx.payerName || tx.paymentIntent?.payerName) && (
                <InfoRow icon={<UserIcon className="w-4 h-4" />} label="Nom" value={tx.payerName || tx.paymentIntent?.payerName} />
              )}
              {(tx.payerEmail || tx.paymentIntent?.payerEmail) && (
                <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={<span className="break-all">{tx.payerEmail || tx.paymentIntent?.payerEmail}</span>} />
              )}
              {tx.paymentIntent?.payerPhone && (
                <InfoRow icon={<Phone className="w-4 h-4" />} label="Téléphone" value={tx.paymentIntent.payerPhone} />
              )}
              {tx.paymentIntent?.payerCountry && (
                <InfoRow icon={<MapPin className="w-4 h-4" />} label="Pays" value={tx.paymentIntent.payerCountry} />
              )}
            </CardContent>
          </Card>
        )}

        {tx.recipient && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Destinataire</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <InfoRow icon={<UserIcon className="w-4 h-4" />} label="Nom" value={tx.recipient.fullName} />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={<span className="break-all">{tx.recipient.email}</span>} />
              {tx.recipient.country && <InfoRow icon={<MapPin className="w-4 h-4" />} label="Pays" value={tx.recipient.country} />}
            </CardContent>
          </Card>
        )}

        {tx.operator && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Fournisseur</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {(tx.recipientCountry || tx.paymentIntent?.payerCountry) && (
                <InfoRow icon={<Globe className="w-4 h-4" />} label="Pays" value={tx.recipientCountry || tx.paymentIntent?.payerCountry} />
              )}
              {tx.currency && (
                <InfoRow icon={<Coins className="w-4 h-4" />} label="Devise" value={<span className="font-mono font-semibold">{tx.currency}</span>} />
              )}
              <InfoRow icon={<CreditCard className="w-4 h-4" />} label="Opérateur" value={tx.operator.name} />
              <InfoRow icon={<Zap className="w-4 h-4" />} label="Fournisseur" value={
                <span className="capitalize">{(tx.type === "deposit" && tx.operator.depositPaymentProvider) ? tx.operator.depositPaymentProvider : tx.operator.paymentProvider}</span>
              } />
            </CardContent>
          </Card>
        )}

        {!tx.operator && tx.paymentMethod === "crypto" && (() => {
          const assetCode = tx.metadata?.assetCode || tx.description?.match(/crypto ([A-Z0-9.]+) —/)?.[1] || "";
          const address   = tx.metadata?.address || "";
          const memo      = tx.metadata?.memo || "";
          if (!assetCode && !address) return null;
          return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Fournisseur Crypto</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <InfoRow icon={<CreditCard className="w-4 h-4" />} label="Passerelle" value="IziChange" />
              {assetCode && (
                <InfoRow icon={<Coins className="w-4 h-4" />} label="Réseau / Coin" value={
                  <span className="font-mono font-semibold text-amber-500">{assetCode}</span>
                } />
              )}
              {address && (
                <InfoRow icon={<FileText className="w-4 h-4" />} label="Adresse" value={
                  <span className="text-xs font-mono break-all">{address}</span>
                } />
              )}
              {memo && (
                <InfoRow icon={<Hash className="w-4 h-4" />} label="Mémo / Tag" value={
                  <span className="font-mono font-semibold">{memo}</span>
                } />
              )}
            </CardContent>
          </Card>
          );
        })()}

        {tx.paymentLink && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Lien de paiement</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <InfoRow icon={<Link2 className="w-4 h-4" />} label="Titre" value={tx.paymentLink.title} />
              <InfoRow icon={<FileText className="w-4 h-4" />} label="Slug" value={<code className="text-xs font-mono bg-muted px-2 py-1 rounded">{tx.paymentLink.slug}</code>} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Modifier le statut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isTerminal ? (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                Cette transaction est en état terminal <strong>{tx.status}</strong> et ne peut plus être modifiée.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Motif <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
                  <Input
                    value={modalReason}
                    onChange={e => setModalReason(e.target.value)}
                    placeholder="Ex: Paiement confirmé, erreur de statut…"
                    data-testid="input-status-reason"
                  />
                </div>

                {/* Quick action buttons for pending / pending_manual */}
                {(tx.status === "pending" || tx.status === "pending_manual") && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => updateStatusMutation.mutate({ status: "completed", reason: modalReason || "Validation admin", forceComplete: true })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-quick-approve"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />Valider
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => updateStatusMutation.mutate({ status: "failed", reason: modalReason || "Rejet admin", forceComplete: true })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-quick-reject"
                    >
                      <XCircle className="w-4 h-4 mr-2" />Rejeter
                    </Button>
                  </div>
                )}

                {/* Quick action buttons for completed — allow revert */}
                {tx.status === "completed" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => updateStatusMutation.mutate({ status: "pending", reason: modalReason || "Remis en attente par admin" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-revert-pending"
                    >
                      <Clock className="w-4 h-4 mr-2" />En attente
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (!confirmRevert) { setConfirmRevert(true); setModalStatus("failed"); return; }
                        updateStatusMutation.mutate({ status: "failed", reason: modalReason || "Rejet admin (annulation)" });
                      }}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-revert-reject"
                    >
                      <XCircle className="w-4 h-4 mr-2" />Rejeter
                    </Button>
                  </div>
                )}

                {/* Confirmation warning when reverting a completed transaction */}
                {confirmRevert && tx.status === "completed" && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-300 space-y-1">
                        <p className="font-semibold">Confirmer l'annulation ?</p>
                        {isDepositRevert && (
                          <p>Ce dépôt a déjà été crédité. <strong>Le montant sera débité du solde de l'utilisateur.</strong></p>
                        )}
                        {isWithdrawalRevert && (
                          <p>Ce retrait a déjà été envoyé. Aucun solde ne sera modifié (le montant avait déjà été déduit).</p>
                        )}
                        {!isDepositRevert && !isWithdrawalRevert && (
                          <p>Cette action modifiera le statut de la transaction.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ status: modalStatus || "failed", reason: modalReason || "Rejet admin (annulation)" })}
                        data-testid="button-confirm-revert"
                      >
                        Confirmer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setConfirmRevert(false); setModalStatus(""); }} data-testid="button-cancel-revert">
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}

                {/* Generic selector for all other transitions */}
                {allowedTransitions.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    <Select value={modalStatus} onValueChange={setModalStatus}>
                      <SelectTrigger className="flex-1" data-testid="select-status">
                        <SelectValue placeholder="Autre statut…" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedTransitions.map(s => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s] || s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      disabled={updateStatusMutation.isPending || !modalStatus}
                      onClick={handleApply}
                      data-testid="button-apply-status"
                    >
                      Appliquer
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
