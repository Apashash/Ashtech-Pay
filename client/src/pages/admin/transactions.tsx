import { getAdminPath } from "@/lib/adminPath";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "./layout";
const A = getAdminPath();
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Download,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Link2,
  Eye,
  Copy,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Calendar,
  Globe,
  Coins,
  Hash
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Transaction, SupportedCurrency } from "@shared/schema";

interface EnrichedTransaction extends Transaction {
  user?: { fullName: string; email: string; username: string } | null;
}

interface TransactionDetails extends Transaction {
  user?: { fullName: string; email: string; username: string; country?: string; phone?: string } | null;
  paymentLink?: { title: string; slug: string } | null;
  paymentIntent?: any;
  recipient?: { fullName: string; email: string; username: string; country?: string } | null;
  operator?: { id: string; name: string; type: string; paymentProvider: string; depositPaymentProvider?: string | null } | null;
  metadata?: { assetCode?: string; payerEmail?: string; payerCountry?: string; address?: string; memo?: string; [key: string]: any } | null;
}

export default function AdminTransactions() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("status") || "all";
  });
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const { data: transactions, isLoading } = useQuery<EnrichedTransaction[]>({
    queryKey: ["/api/admin/transactions"],
  });

  const { data: txDetails, isLoading: txDetailsLoading } = useQuery<TransactionDetails>({
    queryKey: selectedTxId ? [`/api/admin/transactions/${selectedTxId}/details`] : ["__disabled__"],
    enabled: !!selectedTxId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      return apiRequest("PATCH", `/api/admin/transactions/${id}`, { status, reason: reason || "Action admin" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      toast({ title: "Statut mis à jour" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error?.message || "Une erreur est survenue", variant: "destructive" });
    },
  });

  const filteredTransactions = transactions?.filter(tx => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || 
      (tx.description ?? "").toLowerCase().includes(searchLower) ||
      (tx.reference ?? "").toLowerCase().includes(searchLower) ||
      (tx.user?.fullName ?? "").toLowerCase().includes(searchLower) ||
      (tx.user?.email ?? "").toLowerCase().includes(searchLower) ||
      (tx.payerName ?? "").toLowerCase().includes(searchLower) ||
      (tx.payerEmail ?? "").toLowerCase().includes(searchLower);
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  }) || [];

  const typeLabels: Record<string, string> = {
    deposit: "Recharge",
    withdrawal: "Retrait",
    transfer_in: "Reçu",
    transfer_out: "Envoyé",
    payment_link: "Lien de paiement",
  };

  const paymentMethodLabels: Record<string, string> = {
    mobile_money: "Mobile Money",
    crypto: "Crypto",
    bank_transfer: "Virement bancaire",
    card: "Carte bancaire",
    paypal: "PayPal",
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownCircle className="w-4 h-4 text-green-500" />;
      case "withdrawal":
        return <ArrowUpCircle className="w-4 h-4 text-orange-500" />;
      case "transfer_in":
      case "transfer_out":
        return <ArrowLeftRight className="w-4 h-4 text-blue-500" />;
      case "payment_link":
        return <Link2 className="w-4 h-4 text-purple-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 gap-1"><CheckCircle className="w-3 h-3" /> Complété</Badge>;
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> En attente</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Échoué</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const copyReference = (ref: string) => {
    navigator.clipboard.writeText(ref);
    toast({ title: "Référence copiée" });
  };

  const exportCSV = () => {
    if (!filteredTransactions.length) return;
    
    const headers = ["Référence", "Type", "Montant", "Devise", "Statut", "Utilisateur", "Email", "Payeur", "Description", "Date"];
    const rows = filteredTransactions.map(tx => [
      tx.reference || tx.id,
      tx.type,
      tx.amount,
      tx.currency,
      tx.status,
      tx.user?.fullName || "",
      tx.user?.email || "",
      tx.payerName || "",
      tx.description || "",
      tx.createdAt ? format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm") : ""
    ]);
    
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const isIncoming = (type: string) => ["deposit", "transfer_in", "payment_link"].includes(type);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestion des Transactions</h1>
            <p className="text-muted-foreground">{transactions?.length || 0} transactions</p>
          </div>
          <Button onClick={exportCSV} variant="outline" className="gap-2" data-testid="button-export-csv">
            <Download className="w-4 h-4" />
            Exporter CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par référence, utilisateur, payeur..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-transactions"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40" data-testid="select-type-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="deposit">Dépôts</SelectItem>
                  <SelectItem value="withdrawal">Retraits</SelectItem>
                  <SelectItem value="transfer_in">Transferts reçus</SelectItem>
                  <SelectItem value="transfer_out">Transferts envoyés</SelectItem>
                  <SelectItem value="payment_link">Liens de paiement</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="completed">Complétés</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="failed">Échoués</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune transaction trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} data-testid={`transaction-row-${tx.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-muted px-2 py-1 rounded max-w-[150px] truncate">
                            {tx.reference || tx.id.substring(0, 8)}
                          </code>
                          {tx.reference && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6"
                              onClick={() => copyReference(tx.reference!)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(tx.type)}
                          <span className="text-sm">{typeLabels[tx.type] || tx.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{tx.user?.fullName || "-"}</p>
                          <p className="text-xs text-muted-foreground">{tx.user?.email}</p>
                          {tx.payerName && (
                            <p className="text-xs text-primary">Payeur: {tx.payerName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`font-bold ${
                        tx.status === "completed"
                          ? (isIncoming(tx.type) ? "text-green-500" : "text-red-500")
                          : "text-muted-foreground"
                      }`}>
                        {isIncoming(tx.type) ? "+" : "-"}{formatCurrency(parseFloat(tx.amount), tx.currency as SupportedCurrency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-sm">
                        {tx.createdAt ? format(new Date(tx.createdAt), "d MMM yyyy HH:mm", { locale: fr }) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="icon" 
                            variant="outline"
                            onClick={() => navigate(`${A}/transactions/${tx.id}`)}
                            data-testid={`button-view-${tx.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {tx.status === "pending" && (
                            <>
                              <Button 
                                size="icon" 
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ id: tx.id, status: "completed" })}
                                data-testid={`button-approve-${tx.id}`}
                              >
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ id: tx.id, status: "failed" })}
                                data-testid={`button-reject-${tx.id}`}
                              >
                                <XCircle className="w-4 h-4 text-red-500" />
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTxId} onOpenChange={(open) => !open && setSelectedTxId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails de la transaction</DialogTitle>
          </DialogHeader>
          
          {txDetails && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{typeLabels[txDetails.type] || txDetails.type}</p>
                <p className={`text-3xl font-bold ${
                  txDetails.status === "completed" 
                    ? (isIncoming(txDetails.type) ? 'text-green-500' : 'text-red-500')
                    : txDetails.status === "pending" 
                      ? 'text-amber-500' 
                      : 'text-muted-foreground'
                }`}>
                  {isIncoming(txDetails.type) ? '+' : '-'}{formatCurrency(parseFloat(txDetails.amount), (txDetails.currency || "XAF") as SupportedCurrency)}
                </p>
                <div className="mt-2">{getStatusBadge(txDetails.status)}</div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">Informations de la transaction</p>
                
                {txDetails.reference && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">Référence</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{txDetails.reference}</code>
                      <Button size="icon" variant="ghost" onClick={() => copyReference(txDetails.reference!)} data-testid="button-copy-reference-detail">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {txDetails.paymentMethod && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="w-4 h-4" />
                      <span className="text-sm">Méthode de paiement</span>
                    </div>
                    <span className="text-sm font-medium">{paymentMethodLabels[txDetails.paymentMethod] || txDetails.paymentMethod}</span>
                  </div>
                )}

                {txDetails.createdAt && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Date</span>
                    </div>
                    <span className="text-sm font-medium">{format(new Date(txDetails.createdAt), "d MMMM yyyy à HH:mm", { locale: fr })}</span>
                  </div>
                )}

                {txDetails.description && (
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">Description</span>
                    </div>
                    <span className="text-sm font-medium text-right max-w-[60%]">{txDetails.description}</span>
                  </div>
                )}
              </div>

              {txDetails.user && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground">Propriétaire du compte</p>
                    
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

                    {txDetails.user.country && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">Pays</span>
                        </div>
                        <span className="text-sm font-medium">{txDetails.user.country}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(() => {
                const pEmail = txDetails.payerEmail || txDetails.paymentIntent?.payerEmail || txDetails.metadata?.payerEmail;
                const pName  = txDetails.payerName  || txDetails.paymentIntent?.payerName;
                const pPhone = txDetails.paymentIntent?.payerPhone;
                const pCountry = txDetails.paymentIntent?.payerCountry || txDetails.metadata?.payerCountry;
                const assetCode = txDetails.metadata?.assetCode;
                if (!pEmail && !pName && !pPhone && !pCountry && !assetCode) return null;
                return (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-muted-foreground">Informations du payeur</p>

                      {pName && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <UserIcon className="w-4 h-4" />
                            <span className="text-sm">Nom</span>
                          </div>
                          <span className="text-sm font-medium">{pName}</span>
                        </div>
                      )}

                      {pEmail && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            <span className="text-sm">Email</span>
                          </div>
                          <span className="text-sm font-medium">{pEmail}</span>
                        </div>
                      )}

                      {pPhone && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span className="text-sm">Téléphone</span>
                          </div>
                          <span className="text-sm font-medium">{pPhone}</span>
                        </div>
                      )}

                      {pCountry && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm">Pays</span>
                          </div>
                          <span className="text-sm font-medium">{pCountry}</span>
                        </div>
                      )}

                      {assetCode && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Globe className="w-4 h-4" />
                            <span className="text-sm">Réseau</span>
                          </div>
                          <span className="text-sm font-mono font-semibold">{assetCode}</span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {txDetails.operator ? (
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
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">Fournisseur</span>
                      </div>
                      <span className="text-sm font-medium capitalize">{(txDetails.type === "deposit" && txDetails.operator.depositPaymentProvider) ? txDetails.operator.depositPaymentProvider : txDetails.operator.paymentProvider}</span>
                    </div>
                  </div>
                </>
              ) : txDetails.paymentMethod === "crypto" && txDetails.metadata?.assetCode ? (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground">Fournisseur</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CreditCard className="w-4 h-4" />
                        <span className="text-sm">Opérateur</span>
                      </div>
                      <span className="text-sm font-medium">IziChange WaaS</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="w-4 h-4" />
                        <span className="text-sm">Réseau</span>
                      </div>
                      <span className="text-sm font-mono font-semibold">{txDetails.metadata.assetCode}</span>
                    </div>
                    {txDetails.metadata.address && (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                          <FileText className="w-4 h-4" />
                          <span className="text-sm">Adresse</span>
                        </div>
                        <span className="text-xs font-mono text-right break-all">{txDetails.metadata.address}</span>
                      </div>
                    )}
                    {txDetails.metadata.memo && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Hash className="w-4 h-4" />
                          <span className="text-sm">Mémo</span>
                        </div>
                        <span className="text-sm font-mono font-semibold">{txDetails.metadata.memo}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {txDetails.recipient && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground">Destinataire</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserIcon className="w-4 h-4" />
                        <span className="text-sm">Nom</span>
                      </div>
                      <span className="text-sm font-medium">{txDetails.recipient.fullName}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm">Email</span>
                      </div>
                      <span className="text-sm font-medium">{txDetails.recipient.email}</span>
                    </div>

                    {txDetails.recipient.country && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">Pays</span>
                        </div>
                        <span className="text-sm font-medium">{txDetails.recipient.country}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {txDetails.paymentLink && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground">Lien de paiement</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Link2 className="w-4 h-4" />
                        <span className="text-sm">Titre</span>
                      </div>
                      <span className="text-sm font-medium">{txDetails.paymentLink.title}</span>
                    </div>
                  </div>
                </>
              )}

              {txDetails.status === "pending" && (
                <>
                  <Separator />
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 gap-2" 
                      onClick={() => {
                        updateStatusMutation.mutate({ id: txDetails.id, status: "completed" });
                        setSelectedTxId(null);
                      }}
                      data-testid="button-approve-dialog"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Valider
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1 gap-2"
                      onClick={() => {
                        updateStatusMutation.mutate({ id: txDetails.id, status: "failed" });
                        setSelectedTxId(null);
                      }}
                      data-testid="button-reject-dialog"
                    >
                      <XCircle className="w-4 h-4" />
                      Rejeter
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
