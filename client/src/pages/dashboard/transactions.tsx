import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Transaction, User, SupportedCurrency } from "@shared/schema";
import { History, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Loader2, Search, Link2, Copy, ArrowRight, ArrowLeftRight, User as UserIcon, Mail, Phone, MapPin, CreditCard, FileText, ChevronLeft, ChevronRight, Smartphone, Code2, Globe } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface TransactionDetails extends Transaction {
  paymentLink?: { title: string; slug: string } | null;
  paymentIntent?: { payerCountry: string; payerPhone: string } | null;
  recipient?: { fullName: string; username: string } | null;
}

const PAGE_SIZE = 25;

export default function TransactionsPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });
  const { data: wallets = [] } = useQuery<any[]>({ queryKey: ["/api/wallets"] });
  const { data: depositConfig } = useQuery<any>({ queryKey: ["/api/public/deposit-config"] });

  const operatorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const country of depositConfig?.countries || []) {
      for (const op of country.operators || []) {
        map[op.id] = op.name;
      }
    }
    return map;
  }, [depositConfig]);

  const localCurrency = user?.preferredCurrency || "XAF";
  const localBalance = localCurrency === "XAF" 
    ? (user?.balance || "0.00")
    : (wallets.find(w => w.currency === localCurrency)?.balance || "0.00");

  const { data: txDetails, isLoading: txDetailsLoading } = useQuery<TransactionDetails>({
    queryKey: selectedTx ? [`/api/transactions/${selectedTx.id}`] : ["__disabled__"],
    enabled: !!selectedTx?.id,
  });

  const filteredTransactions = transactions.filter(tx => {
    if (filter !== "all" && tx.type !== filter) return false;
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      const matchDesc = (tx.description ?? "").toLowerCase().includes(searchLower);
      const matchPayer = (tx.payerName ?? "").toLowerCase().includes(searchLower);
      const matchEmail = (tx.payerEmail ?? "").toLowerCase().includes(searchLower);
      const matchRef = (tx.reference ?? "").toLowerCase().includes(searchLower);
      if (!matchDesc && !matchPayer && !matchEmail && !matchRef) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [filter, statusFilter, search]);

  const typeLabels: Record<string, string> = {
    deposit: "Dépôt",
    withdrawal: "Retrait",
    transfer_in: "Reçu",
    transfer_out: "Envoyé",
    payment_link: "Lien de paiement",
    conversion: "Conversion",
  };

  const paymentMethodLabels: Record<string, string> = {
    mobile_money: "Mobile Money",
    crypto: "Crypto",
    bank_transfer: "Virement bancaire",
    card: "Carte bancaire",
    paypal: "PayPal",
  };

  const getApiBadge = (tx: Transaction) => {
    const t = tx as any;
    if (t.type === "payment_link") {
      return (
        <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-violet-500/10 text-violet-600 border-violet-500/30 font-medium">
          <Link2 className="w-2.5 h-2.5" />Lien de paiement
        </Badge>
      );
    }
    if (t.source === "hosted_page") {
      return (
        <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30 font-medium">
          <Globe className="w-2.5 h-2.5" />Hosted Page API
        </Badge>
      );
    }
    if (t.source === "api") {
      return (
        <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-sky-500/10 text-sky-600 border-sky-500/30 font-medium">
          <Code2 className="w-2.5 h-2.5" />SDK API
        </Badge>
      );
    }
    return null;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1"><CheckCircle className="w-3 h-3" />Validé</Badge>;
      case "pending":
      case "pending_manual":
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 gap-1"><Clock className="w-3 h-3" />En cours</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 gap-1"><XCircle className="w-3 h-3" />Rejeté</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="gap-1"><XCircle className="w-3 h-3" />Annulé</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const copyReference = (ref: string) => {
    navigator.clipboard.writeText(ref);
    toast({ title: "Référence copiée" });
  };

  const tx = txDetails || selectedTx;
  const isIncomingSelected = tx ? ["deposit", "transfer_in", "payment_link"].includes(tx.type) : false;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div>
            <div className="h-8 w-48 bg-muted rounded mb-2" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
          <div className="flex gap-4">
            <div className="h-10 flex-1 bg-muted rounded" />
            <div className="h-10 w-36 bg-muted rounded" />
            <div className="h-10 w-36 bg-muted rounded" />
          </div>
          <div className="h-96 bg-muted rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground">Historique de toutes vos transactions</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher par description, référence..." 
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-transactions"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-type">
              <SelectValue placeholder="Filtrer par type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="deposit">Dépôts</SelectItem>
              <SelectItem value="withdrawal">Retraits</SelectItem>
              <SelectItem value="transfer_in">Reçus</SelectItem>
              <SelectItem value="transfer_out">Envoyés</SelectItem>
              <SelectItem value="payment_link">Liens de paiement</SelectItem>
              <SelectItem value="conversion">Conversions</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-status">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En cours</SelectItem>
              <SelectItem value="completed">Validés</SelectItem>
              <SelectItem value="failed">Rejetés</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Historique
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune transaction trouvée</p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto overflow-y-auto max-h-[520px] -mx-4 px-4">
                <div className="space-y-2 min-w-[320px]">
                  {paginatedTransactions.map((tx) => {
                    const isConversion = tx.type === "conversion";
                    const isIncoming = ["deposit", "transfer_in", "payment_link"].includes(tx.type);
                    const isPaymentLink = tx.type === "payment_link";
                    return (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-card border border-border cursor-pointer hover-elevate gap-3" 
                        onClick={() => setSelectedTx(tx)}
                        data-testid={`transaction-item-${tx.id}`}
                      >
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center ${
                            isConversion
                              ? 'bg-blue-500/10'
                              : isPaymentLink 
                                ? 'bg-primary/10' 
                                : isIncoming ? 'bg-green-500/10' : 'bg-red-500/10'
                          }`}>
                            {isConversion
                              ? <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                              : isPaymentLink 
                                ? <Link2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                                : isIncoming 
                                  ? <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" /> 
                                  : <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-foreground text-sm sm:text-base">{typeLabels[tx.type] || tx.type}</p>
                              {getApiBadge(tx)}
                              <div className="hidden sm:block">{getStatusBadge(tx.status)}</div>
                            </div>
                            {tx.reference && (
                              <p className="text-xs font-mono text-muted-foreground truncate max-w-[120px] sm:max-w-none">{tx.reference}</p>
                            )}
                            {isPaymentLink && tx.payerName && (
                              <p className="text-xs sm:text-sm text-foreground font-medium truncate">
                                {tx.payerName}
                              </p>
                            )}
                            <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-[250px]">{tx.description || "-"}</p>
                            {tx.operatorId && operatorMap[tx.operatorId] && (
                              <p className="text-xs text-primary font-medium flex items-center gap-1">
                                <Smartphone className="w-3 h-3" />
                                {operatorMap[tx.operatorId]}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {tx.createdAt ? format(new Date(tx.createdAt), "dd/MM/yy", { locale: fr }) : ""}
                              <span className="hidden sm:inline">
                                {tx.createdAt ? format(new Date(tx.createdAt), " HH:mm", { locale: fr }) : ""}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`font-bold text-sm sm:text-lg whitespace-nowrap ${
                            isConversion
                              ? 'text-blue-500'
                              : tx.status === "completed" 
                                ? (isIncoming ? 'text-green-500' : 'text-red-500')
                                : tx.status === "pending" 
                                  ? 'text-amber-500' 
                                  : 'text-muted-foreground'
                          }`}>
                            {isConversion ? '⇄ ' : (isIncoming ? '+' : '-')}{formatCurrency(tx.amount, (user?.preferredCurrency || "XAF") as SupportedCurrency)}
                          </span>
                          <div className="sm:hidden">{getStatusBadge(tx.status)}</div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filteredTransactions.length)} sur {filteredTransactions.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      data-testid="button-page-prev"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Précédent
                    </Button>
                    <span className="text-sm font-medium px-2">{page} / {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      data-testid="button-page-next"
                    >
                      Suivant
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Détails de la transaction
            </DialogTitle>
          </DialogHeader>
          
          {tx && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                  <p className="text-sm text-muted-foreground">{typeLabels[tx.type] || tx.type}</p>
                  {getApiBadge(tx)}
                </div>
                <p className={`text-3xl font-bold ${
                  tx.type === "conversion"
                    ? 'text-blue-500'
                    : tx.status === "completed" 
                      ? (isIncomingSelected ? 'text-green-500' : 'text-red-500')
                      : tx.status === "pending" 
                        ? 'text-amber-500' 
                        : 'text-muted-foreground'
                }`}>
                  {tx.type === "conversion" ? '⇄ ' : (isIncomingSelected ? '+' : '-')}{formatCurrency(tx.amount, (user?.preferredCurrency || "XAF") as SupportedCurrency)}
                </p>
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
                      <Button size="icon" variant="ghost" onClick={() => copyReference(tx.reference!)} data-testid="button-copy-reference">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {(tx.feeAmount && parseFloat(tx.feeAmount) > 0) && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2" data-testid="fee-details">
                    <p className="text-sm font-semibold text-muted-foreground">Détails des frais</p>
                    {tx.totalAmount && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Montant brut</span>
                        <span className="font-medium">{formatCurrency(tx.totalAmount, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Frais</span>
                      <span className="font-medium text-red-500">-{formatCurrency(tx.feeAmount, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t pt-2">
                      <span className="font-medium">Montant net</span>
                      <span className="font-bold text-foreground">{formatCurrency(tx.amount, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                    </div>
                  </div>
                )}

                {tx.paymentMethod && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="w-4 h-4" />
                      <span className="text-sm">Méthode de paiement</span>
                    </div>
                    <span className="text-sm font-medium">{paymentMethodLabels[tx.paymentMethod] || tx.paymentMethod}</span>
                  </div>
                )}

                {tx.operatorId && operatorMap[tx.operatorId] && (
                  <div className="flex items-center justify-between" data-testid="detail-operator">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Smartphone className="w-4 h-4" />
                      <span className="text-sm">Opérateur</span>
                    </div>
                    <span className="text-sm font-medium">{operatorMap[tx.operatorId]}</span>
                  </div>
                )}

                {tx.createdAt && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Date</span>
                    </div>
                    <span className="text-sm font-medium">{format(new Date(tx.createdAt), "d MMMM yyyy à HH:mm", { locale: fr })}</span>
                  </div>
                )}

                {tx.description && (
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">Description</span>
                    </div>
                    <span className="text-sm font-medium text-right max-w-[60%]">{tx.description}</span>
                  </div>
                )}
              </div>

              {tx.type === "payment_link" && user?.country && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground">Propriétaire du compte</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserIcon className="w-4 h-4" />
                        <span className="text-sm">Nom</span>
                      </div>
                      <span className="text-sm font-medium">{user.fullName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">Pays</span>
                      </div>
                      <span className="text-sm font-medium" data-testid="text-owner-country">{user.country}</span>
                    </div>
                  </div>
                </>
              )}

              {(tx.payerName || tx.payerEmail || txDetails?.recipient) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground">
                      {tx.type === "payment_link" ? "Informations du payeur" : "Destinataire"}
                    </p>
                    
                    {tx.payerName && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <UserIcon className="w-4 h-4" />
                          <span className="text-sm">Nom</span>
                        </div>
                        <span className="text-sm font-medium">{tx.payerName}</span>
                      </div>
                    )}

                    {tx.payerEmail && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">Email</span>
                        </div>
                        <span className="text-sm font-medium">{tx.payerEmail}</span>
                      </div>
                    )}

                    {txDetails?.paymentIntent?.payerPhone && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm">Téléphone</span>
                        </div>
                        <span className="text-sm font-medium" data-testid="text-payer-phone">{txDetails.paymentIntent.payerPhone}</span>
                      </div>
                    )}

                    {txDetails?.paymentIntent?.payerCountry && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">Pays</span>
                        </div>
                        <span className="text-sm font-medium" data-testid="text-payer-country">{txDetails.paymentIntent.payerCountry}</span>
                      </div>
                    )}

                    {txDetails?.recipient && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <UserIcon className="w-4 h-4" />
                            <span className="text-sm">Nom</span>
                          </div>
                          <span className="text-sm font-medium">{txDetails.recipient.fullName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-sm ml-6">@{txDetails.recipient.username}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {txDetails?.paymentLink && (
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
