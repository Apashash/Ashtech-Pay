import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle, XCircle, Clock, ArrowLeft, Copy, User as UserIcon,
  Mail, Phone, MapPin, CreditCard, FileText, Calendar, Link2,
  Zap, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, RefreshCw
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
  description?: string | null;
  createdAt?: Date | string | null;
  recipientPhone?: string | null;
  payerName?: string | null;
  payerEmail?: string | null;
  recipientName?: string | null;
  recipientCountry?: string | null;
  source?: string | null;
  user?: { fullName: string; email: string; username: string; country?: string; phone?: string } | null;
  paymentIntent?: { payerName?: string; payerEmail?: string; payerPhone?: string; payerCountry?: string } | null;
  paymentLink?: { title: string; slug: string } | null;
  recipient?: { fullName: string; email: string; username: string; country?: string } | null;
  operator?: { id: string; name: string; type: string; paymentProvider: string; depositPaymentProvider?: string | null } | null;
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
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-sm font-medium text-right max-w-[60%]">{value}</div>
    </div>
  );
}

export default function AdminTransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [modalStatus, setModalStatus] = useState("");
  const [modalReason, setModalReason] = useState("");

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
          <Button variant="ghost" onClick={() => navigate(-1 as any)} className="gap-2 mb-4">
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

  const TERMINAL_STATES = ["completed", "refunded"];
  const isTerminal = TERMINAL_STATES.includes(tx.status);

  const VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ["completed", "failed", "cancelled"],
    processing: ["completed", "failed", "pending"],
    failed: ["pending"],
    cancelled: ["pending"],
  };
  const allowedTransitions = VALID_TRANSITIONS[tx.status] ?? [];

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
              <p className={`text-4xl font-bold ${amountColor}`}>
                {isIncoming(tx.type) ? "+" : "-"}{formatCurrency(parseFloat(tx.amount), (tx.currency || "XAF") as SupportedCurrency)}
              </p>
              {tx.feeAmount && parseFloat(tx.feeAmount) > 0 && (
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p>Frais : {formatCurrency(tx.feeAmount, (tx.currency || "XAF") as SupportedCurrency)}</p>
                  <p>Total payé : {formatCurrency(tx.totalAmount || tx.amount, (tx.currency || "XAF") as SupportedCurrency)}</p>
                </div>
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
                label="Référence interne"
                value={
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{tx.reference}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(tx.reference!)} data-testid="button-copy-ref">
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                }
              />
            )}
            {tx.externalReference && (
              <InfoRow
                icon={<Link2 className="w-4 h-4" />}
                label="Référence externe"
                value={
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{tx.externalReference}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(tx.externalReference!)} data-testid="button-copy-ext-ref">
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
                <button className="text-primary hover:underline font-medium" onClick={() => navigate(`/admin/users/${(tx.user as any)?.id || ""}`)}>
                  {tx.user.fullName}
                </button>
              } />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={tx.user.email} />
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
                <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={tx.payerEmail || tx.paymentIntent?.payerEmail} />
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
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={tx.recipient.email} />
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
              <InfoRow icon={<CreditCard className="w-4 h-4" />} label="Opérateur" value={tx.operator.name} />
              <InfoRow icon={<Zap className="w-4 h-4" />} label="Fournisseur" value={
                <span className="capitalize">{(tx.type === "deposit" && tx.operator.depositPaymentProvider) ? tx.operator.depositPaymentProvider : tx.operator.paymentProvider}</span>
              } />
            </CardContent>
          </Card>
        )}

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
                <div className="flex gap-2">
                  <Select value={modalStatus} onValueChange={setModalStatus}>
                    <SelectTrigger className="flex-1" data-testid="select-status">
                      <SelectValue placeholder="Choisir un statut…" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedTransitions.map(s => (
                        <SelectItem key={s} value={s}>
                          {s === "completed" ? "Validé" : s === "failed" ? "Échoué" : s === "cancelled" ? "Annulé" : s === "pending" ? "En attente" : s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={updateStatusMutation.isPending || !modalStatus}
                    onClick={() => updateStatusMutation.mutate({ status: modalStatus, reason: modalReason })}
                    data-testid="button-apply-status"
                  >
                    Appliquer
                  </Button>
                </div>

                {tx.status === "pending" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => updateStatusMutation.mutate({ status: "completed", reason: modalReason || "Validation admin" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-quick-approve"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />Valider
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => updateStatusMutation.mutate({ status: "failed", reason: modalReason || "Rejet admin" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-quick-reject"
                    >
                      <XCircle className="w-4 h-4 mr-2" />Rejeter
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
