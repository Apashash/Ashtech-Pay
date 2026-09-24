import { getAdminPath } from "@/lib/adminPath";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
const A = getAdminPath();
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  ArrowUpCircle,
  Eye,
  Copy,
  User as UserIcon,
  Mail,
  Phone,
  Zap,
  CreditCard,
  FileText,
  Smartphone,
  Globe,
  Coins
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Transaction, SupportedCurrency } from "@shared/schema";

interface EnrichedTransaction extends Transaction {
  user?: { fullName: string; email: string; username: string; phone?: string | null } | null;
}

interface TransactionDetails extends Transaction {
  user?: { fullName: string; email: string; username: string; country?: string; phone?: string } | null;
  operator?: { id: string; name: string; type: string; paymentProvider: string } | null;
  paymentIntent?: { payerCountry?: string } | null;
}

export default function AdminWithdrawals() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => { const params = new URLSearchParams(window.location.search); return params.get("status") || "all"; });
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [modalStatus, setModalStatus] = useState<string>("");
  const [modalReason, setModalReason] = useState<string>("");

  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const { data: txData, isLoading } = useQuery<{ data: EnrichedTransaction[]; total: number; pages: number }>({
    queryKey: ["/api/admin/transactions", "withdrawals", page, statusFilter, search],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: "50", type: "withdrawal" });
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (search.trim()) p.set("search", search.trim());
      const res = await fetch(`/api/admin/transactions?${p}`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    // Poll every 4s whenever there are "pending" transactions so status changes
    // (completed / failed) from the payout poller are reflected automatically.
    refetchInterval: (query) => {
      const hasPending = query.state.data?.data?.some(tx => tx.status === "pending");
      return hasPending ? 4_000 : false;
    },
  });

  const { data: txDetails, isLoading: txDetailsLoading } = useQuery<TransactionDetails>({
    queryKey: selectedTxId ? [`/api/admin/transactions/${selectedTxId}/details`] : ["__disabled__"],
    enabled: !!selectedTxId,
  });

  const { data: depositConfig } = useQuery<any>({ queryKey: ["/api/public/deposit-config"] });
  const operatorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const country of depositConfig?.countries || []) {
      for (const op of country.operators || []) { map[op.id] = op.name; }
    }
    return map;
  }, [depositConfig]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, forceComplete, reason }: { id: string; status: string; forceComplete?: boolean; reason?: string }) => {
      return apiRequest("PATCH", `/api/admin/transactions/${id}`, { status, reason: reason || "Action admin", ...(forceComplete ? { forceComplete: true } : {}) });
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/transactions/${variables.id}/details`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/layout-stats"] });
      toast({
        title: response.status === 202 ? "Paiement en cours" : "Statut mis à jour",
        description: response.status === 202 ? "Le fournisseur doit encore confirmer le retrait." : undefined,
      });
      setSelectedTxId(null);
    },
    onError: (error: any) => {
      const message = error?.message || "Une erreur est survenue";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    },
  });

  const allTransactions = txData?.data || [];

  const filteredTransactions = allTransactions.filter(tx => {
    return true;
  });

  const paymentMethodLabels: Record<string, string> = {
    mobile_money: "Mobile Money",
    crypto: "Crypto",
    bank_transfer: "Virement bancaire",
    card: "Carte bancaire",
    paypal: "PayPal",
  };

  const extractPhoneNumber = (description: string | null): string => {
    if (!description) return "-";
    const match = description.match(/vers\s+(\+?\d[\d\s-]+)/i);
    return match ? match[1].trim() : "-";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1"><CheckCircle className="w-3 h-3" />Validé</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 gap-1"><Clock className="w-3 h-3" />En attente</Badge>;
      case "processing":
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />En cours de traitement</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 gap-1"><XCircle className="w-3 h-3" />Rejeté</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const copyReference = (ref: string) => {
    navigator.clipboard.writeText(ref);
    toast({ title: "Référence copiée" });
  };

  const forceCompleteMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return apiRequest("PATCH", `/api/admin/transactions/${id}`, { status: "completed", forceComplete: true, reason: reason || "Confirmation manuelle admin" });
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/transactions/${variables.id}/details`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/layout-stats"] });
      toast({ title: "Transaction confirmée manuellement" });
      setSelectedTxId(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error?.message, variant: "destructive" });
    },
  });

  const pendingCount = allTransactions.filter(tx => tx.status === "pending").length;
  const totalWithdrawals = allTransactions.reduce((sum, tx) => {
    if (tx.status === "completed") return sum + parseFloat(tx.amount);
    return sum;
  }, 0);

  const tx = txDetails || allTransactions.find(t => t.id === selectedTxId);

  useEffect(() => {
    if (tx) setModalStatus(tx.status);
  }, [tx?.id]);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowUpCircle className="w-6 h-6 text-red-500" />
              Historique des Retraits
            </h1>
            <p className="text-muted-foreground">Gérez les demandes de retrait</p>
          </div>
          <div className="flex gap-4">
            <Card className="px-4 py-2">
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="text-xl font-bold text-amber-500">{pendingCount}</p>
            </Card>
            <Card className="px-4 py-2">
              <p className="text-sm text-muted-foreground">Total payé</p>
              <p className="text-xl font-bold text-red-500">{formatCurrency(totalWithdrawals.toString(), "XAF")}</p>
            </Card>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Référence, nom ou numéro (+237, 237 ou local)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-withdrawals"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="completed">Validé</SelectItem>
              <SelectItem value="failed">Rejeté</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Opérateur</TableHead>
                  <TableHead>Numéro de Retrait</TableHead>
                  <TableHead>Montant Net</TableHead>
                  <TableHead>Frais</TableHead>
                  <TableHead>Total Débité</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">Chargement...</TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Aucun retrait trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} data-testid={`withdrawal-row-${tx.id}`}>
                      <TableCell className="font-mono text-sm">{tx.reference}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tx.user?.fullName || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">{tx.user?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tx.operatorId && operatorMap[tx.operatorId] ? (
                          <div className="flex items-center gap-1.5 text-primary font-medium text-sm">
                            <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
                            {operatorMap[tx.operatorId]}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{extractPhoneNumber(tx.description)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-red-500">
                        -{formatCurrency(tx.amount, (tx.currency || "XAF") as SupportedCurrency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.feeAmount && parseFloat(tx.feeAmount) > 0 
                          ? formatCurrency(tx.feeAmount, (tx.currency || "XAF") as SupportedCurrency)
                          : "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {tx.totalAmount 
                          ? formatCurrency(tx.totalAmount, (tx.currency || "XAF") as SupportedCurrency)
                          : formatCurrency(tx.amount, (tx.currency || "XAF") as SupportedCurrency)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tx.createdAt && format(new Date(tx.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => navigate(`${A}/transactions/${tx.id}`)}
                            data-testid={`button-view-withdrawal-${tx.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {tx.status === "pending" && (
                            <>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                className="text-green-500"
                                onClick={() => updateStatusMutation.mutate({ id: tx.id, status: "completed" })}
                                data-testid={`button-approve-withdrawal-${tx.id}`}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                className="text-red-500"
                                onClick={() => updateStatusMutation.mutate({ id: tx.id, status: "failed" })}
                                data-testid={`button-reject-withdrawal-${tx.id}`}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {(txData?.pages || 1) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Page {page} / {txData?.pages} — {txData?.total} transactions</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
                  <Button variant="outline" size="sm" disabled={page >= (txData?.pages || 1)} onClick={() => setPage(p => p + 1)}>Suivant</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedTxId} onOpenChange={(open) => !open && setSelectedTxId(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>Détails du retrait</DialogTitle>
            </DialogHeader>
            {tx && (
              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Montant Net Retiré</p>
                  <p className="text-3xl font-bold text-red-500">
                    -{formatCurrency(tx.amount, (tx.currency || "XAF") as SupportedCurrency)}
                  </p>
                  {tx.feeAmount && parseFloat(tx.feeAmount) > 0 && (
                    <div className="mt-2 text-sm space-y-1">
                      <p className="text-muted-foreground">
                        Frais: {formatCurrency(tx.feeAmount, (tx.currency || "XAF") as SupportedCurrency)}
                      </p>
                      <p className="text-muted-foreground">
                        Total débité: {formatCurrency(tx.totalAmount || tx.amount, (tx.currency || "XAF") as SupportedCurrency)}
                      </p>
                    </div>
                  )}
                  <div className="mt-2">{getStatusBadge(tx.status)}</div>
                </div>

                <Separator />

                <div className="space-y-3">
                  {tx.reference && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">Référence</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{tx.reference}</code>
                        <Button size="icon" variant="ghost" onClick={() => copyReference(tx.reference!)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {tx.paymentMethod && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CreditCard className="w-4 h-4" />
                        <span className="text-sm">Méthode</span>
                      </div>
                      <span className="text-sm font-medium">{paymentMethodLabels[tx.paymentMethod] || tx.paymentMethod}</span>
                    </div>
                  )}

                  {tx.description && (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm font-medium">Numéro de Retrait</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-primary">{extractPhoneNumber(tx.description)}</span>
                          {extractPhoneNumber(tx.description) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(extractPhoneNumber(tx.description)!);
                                toast({ title: "Numéro copié !" });
                              }}
                              className="text-primary/60 hover:text-primary transition-colors p-0.5 rounded"
                              title="Copier le numéro"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {tx.createdAt && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Date</span>
                      </div>
                      <span className="text-sm font-medium">
                        {format(new Date(tx.createdAt), "d MMMM yyyy à HH:mm", { locale: fr })}
                      </span>
                    </div>
                  )}
                </div>

                {txDetails?.user && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-muted-foreground">Utilisateur</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <UserIcon className="w-4 h-4" />
                          <span className="text-sm">Nom</span>
                        </div>
                        <span className="text-sm font-medium">{txDetails.user.fullName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">Email</span>
                        </div>
                        <span className="text-sm font-medium">{txDetails.user.email}</span>
                      </div>
                      {txDetails.user.phone && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span className="text-sm">Téléphone</span>
                          </div>
                          <span className="text-sm font-medium">{txDetails.user.phone}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {txDetails?.operator && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-muted-foreground">Fournisseur</p>
                      {(txDetails.recipientCountry || txDetails.paymentIntent?.payerCountry) && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Globe className="w-4 h-4" />
                            <span className="text-sm">Pays</span>
                          </div>
                          <span className="text-sm font-medium">{txDetails.recipientCountry || txDetails.paymentIntent?.payerCountry}</span>
                        </div>
                      )}
                      {txDetails.currency && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Coins className="w-4 h-4" />
                            <span className="text-sm">Devise</span>
                          </div>
                          <span className="text-sm font-mono font-semibold">{txDetails.currency}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CreditCard className="w-4 h-4" />
                          <span className="text-sm">Opérateur</span>
                        </div>
                        <span className="text-sm font-medium">{txDetails.operator.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Zap className="w-4 h-4" />
                          <span className="text-sm">Fournisseur</span>
                        </div>
                        <span className="text-sm font-medium capitalize">{txDetails.operator.paymentProvider}</span>
                      </div>
                    </div>
                  </>
                )}

                <Separator />
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modifier le statut</p>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Motif de modification <span className="text-muted-foreground text-xs">(optionnel)</span></label>
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground mb-2"
                      placeholder="Ex: Paiement confirmé par le client, erreur de statut…"
                      value={modalReason}
                      onChange={e => setModalReason(e.target.value)}
                      data-testid="input-modal-reason"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={modalStatus} onValueChange={setModalStatus}>
                      <SelectTrigger className="flex-1" data-testid="select-modal-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">En attente</SelectItem>
                        <SelectItem value="processing">En cours</SelectItem>
                        <SelectItem value="completed">Validé</SelectItem>
                        <SelectItem value="failed">Échoué</SelectItem>
                        <SelectItem value="cancelled">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      disabled={updateStatusMutation.isPending || !modalStatus || modalStatus === tx.status}
                      onClick={() => updateStatusMutation.mutate({ id: tx.id, status: modalStatus, forceComplete: modalStatus === "completed", reason: modalReason })}
                      data-testid="button-modal-apply-status"
                    >
                      Appliquer
                    </Button>
                  </div>
                  {(tx.status === "failed" || tx.status === "cancelled") && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          La remise en attente débite à nouveau{" "}
                          <strong>{formatCurrency(tx.totalAmount || tx.amount, (tx.currency || "XAF") as SupportedCurrency)}</strong>{" "}
                          du wallet de l'utilisateur.
                        </p>
                      </div>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({
                          id: tx.id,
                          status: "pending",
                          reason: modalReason || "Transaction rejetée remise en attente par l'administration",
                        })}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-reopen-withdrawal"
                      >
                        Remettre en attente et débiter le wallet
                      </Button>
                    </div>
                  )}
                  {tx.status === "pending" && (
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => updateStatusMutation.mutate({ id: tx.id, status: "completed", reason: modalReason || "Approbation admin via le fournisseur configuré" })}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-modal-approve-provider"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approuver via le fournisseur configuré
                      </Button>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => forceCompleteMutation.mutate({ id: tx.id, reason: modalReason || "Confirmation manuelle admin (sans fournisseur)" })}
                        disabled={forceCompleteMutation.isPending}
                        data-testid="button-modal-approve-manual"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirmer manuellement (sans fournisseur)
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => updateStatusMutation.mutate({ id: tx.id, status: "failed", reason: modalReason || "Rejet admin" })}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-modal-reject"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Rejeter (rembourser l'utilisateur)
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
