import { getAdminPath } from "@/lib/adminPath";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
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
  ArrowDownCircle,
  Eye,
  Copy,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Zap,
  CreditCard,
  FileText,
  Link2,
  Smartphone,
  Globe,
  Code2,
  Coins
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Transaction, SupportedCurrency } from "@shared/schema";

interface EnrichedTransaction extends Transaction {
  user?: { fullName: string; email: string; username: string } | null;
  payerPhone?: string | null;
}

interface TransactionDetails extends Transaction {
  user?: { fullName: string; email: string; username: string; country?: string; phone?: string } | null;
  paymentIntent?: { payerName?: string; payerEmail?: string; payerPhone?: string; payerCountry?: string } | null;
  paymentLink?: { title: string; slug: string } | null;
  operator?: { id: string; name: string; type: string; paymentProvider: string; depositPaymentProvider?: string | null } | null;
}

export default function AdminDeposits() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => { const params = new URLSearchParams(window.location.search); return params.get("status") || "all"; });
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [modalStatus, setModalStatus] = useState<string>("");
  const [modalReason, setModalReason] = useState<string>("");
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => { setPage(1); }, [statusFilter, typeFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlight = params.get("highlight");
    if (highlight) {
      setHighlightedId(highlight);
      setStatusFilter("all");
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
      setTimeout(() => setHighlightedId(null), 5000);
    }
  }, [location]);

  const { data: txData, isLoading } = useQuery<{ data: EnrichedTransaction[]; total: number; pages: number }>({
    queryKey: ["/api/admin/transactions", "deposits", page, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: "50", type: "deposit,payment_link" });
      if (statusFilter !== "all") p.set("status", statusFilter);
      const res = await fetch(`/api/admin/transactions?${p}`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
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
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      return apiRequest("PATCH", `/api/admin/transactions/${id}`, { status, reason: reason || "Action admin" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions", "deposits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/layout-stats"] });
      toast({ title: "Statut mis à jour" });
      setSelectedTxId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const allTransactions = txData?.data || [];

  const filteredTransactions = allTransactions.filter(tx => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || 
      (tx.description ?? "").toLowerCase().includes(searchLower) ||
      (tx.reference ?? "").toLowerCase().includes(searchLower) ||
      (tx.user?.fullName ?? "").toLowerCase().includes(searchLower) ||
      (tx.user?.email ?? "").toLowerCase().includes(searchLower) ||
      (tx.payerName ?? "").toLowerCase().includes(searchLower) ||
      (tx.payerEmail ?? "").toLowerCase().includes(searchLower);
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const typeLabels: Record<string, string> = {
    deposit: "Dépôt",
    payment_link: "Lien de paiement",
  };

  const getSourceBadge = (tx: any) => {
    if (tx.type === "payment_link") {
      return (
        <Badge variant="default" className="gap-1 text-[10px] px-1.5 py-0 bg-violet-500/15 text-violet-600 border-violet-500/30">
          <Link2 className="w-2.5 h-2.5" />Lien
        </Badge>
      );
    }
    if (tx.source === "hosted_page") {
      return (
        <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
          <Globe className="w-2.5 h-2.5" />Hosted Page
        </Badge>
      );
    }
    if (tx.source === "api") {
      return (
        <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 bg-sky-500/10 text-sky-600 border-sky-500/30">
          <Code2 className="w-2.5 h-2.5" />SDK API
        </Badge>
      );
    }
    return null;
  };

  const paymentMethodLabels: Record<string, string> = {
    mobile_money: "Mobile Money",
    crypto: "Crypto",
    bank_transfer: "Virement bancaire",
    card: "Carte bancaire",
    paypal: "PayPal",
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1"><CheckCircle className="w-3 h-3" />Validé</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 gap-1"><Clock className="w-3 h-3" />En attente</Badge>;
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

  const pendingCount = allTransactions.filter(tx => tx.status === "pending").length;
  const totalDeposits = allTransactions.reduce((sum, tx) => {
    if (tx.status === "completed") {
      return sum + parseFloat(tx.amount);
    }
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
              <ArrowDownCircle className="w-6 h-6 text-green-500" />
              Dépôts & Liens de Paiement
            </h1>
            <p className="text-muted-foreground">Gérez les dépôts et paiements reçus via liens</p>
          </div>
          <div className="flex gap-4">
            <Card className="px-4 py-2">
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="text-xl font-bold text-amber-500">{pendingCount}</p>
            </Card>
            <Card className="px-4 py-2">
              <p className="text-sm text-muted-foreground">Total validé</p>
              <p className="text-xl font-bold text-green-500">{formatCurrency(totalDeposits.toString(), "XAF")}</p>
            </Card>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par référence, utilisateur, payeur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-deposits"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44" data-testid="select-type-filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="deposit">Dépôts</SelectItem>
              <SelectItem value="payment_link">Liens de paiement</SelectItem>
            </SelectContent>
          </Select>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Réf. Interne</TableHead>
                  <TableHead>Réf. Externe</TableHead>
                  <TableHead>Utilisateur / Payeur</TableHead>
                  <TableHead>Opérateur</TableHead>
                  <TableHead>Montant Net</TableHead>
                  <TableHead>Frais</TableHead>
                  <TableHead>Total Payé</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">Chargement...</TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Aucun dépôt trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow 
                      key={tx.id} 
                      data-testid={`deposit-row-${tx.id}`}
                      ref={tx.id === highlightedId ? highlightRef : null}
                      className={tx.id === highlightedId ? "bg-yellow-500/20 animate-pulse" : ""}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={tx.type === "payment_link" ? "default" : "secondary"} className="gap-1 w-fit">
                            {tx.type === "payment_link" ? <Link2 className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                            {typeLabels[tx.type] || tx.type}
                          </Badge>
                          {getSourceBadge(tx)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{tx.reference || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{tx.externalReference || "-"}</TableCell>
                      <TableCell>
                        {tx.type === "payment_link" ? (
                          <div>
                            <p className="font-medium">{tx.payerName || "N/A"}</p>
                            <p className="text-xs text-muted-foreground">{tx.payerEmail || "-"}</p>
                            {(tx.payerPhone) && (
                              <p className="text-xs font-mono text-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />{tx.payerPhone}
                              </p>
                            )}
                            <p className="text-xs text-primary">vers {tx.user?.fullName}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium">{tx.user?.fullName || "N/A"}</p>
                            <p className="text-xs text-muted-foreground">{tx.user?.email}</p>
                            {tx.recipientPhone && (
                              <p className="text-xs font-mono text-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />{tx.recipientPhone}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.operatorId && operatorMap[tx.operatorId] ? (
                          <div className="flex items-center gap-1.5 text-primary font-medium text-sm">
                            <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
                            {operatorMap[tx.operatorId]}
                          </div>
                        ) : tx.paymentMethod === "crypto" ? (() => {
                          // metadata.assetCode (new) OR parse from description (old transactions)
                          const assetCode =
                            (tx as any).metadata?.assetCode ||
                            tx.description?.match(/crypto ([A-Z0-9.]+) —/)?.[1] ||
                            "";
                          return assetCode ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 text-amber-500 font-medium text-sm">
                                <Coins className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="font-mono">{assetCode}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">IziChange</span>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-500 font-medium">Crypto</span>
                          );
                        })() : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-green-500">
                        +{formatCurrency(tx.amount, (tx.currency || "XAF") as SupportedCurrency)}
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
                            data-testid={`button-view-deposit-${tx.id}`}
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
                                data-testid={`button-approve-deposit-${tx.id}`}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                className="text-red-500"
                                onClick={() => updateStatusMutation.mutate({ id: tx.id, status: "failed" })}
                                data-testid={`button-reject-deposit-${tx.id}`}
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Détails du dépôt</DialogTitle>
            </DialogHeader>
            {tx && (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Montant Net Crédité</p>
                  <p className="text-3xl font-bold text-green-500">
                    +{formatCurrency(tx.amount, (tx.currency || "XAF") as SupportedCurrency)}
                  </p>
                  {tx.feeAmount && parseFloat(tx.feeAmount) > 0 && (
                    <div className="mt-2 text-sm space-y-1">
                      <p className="text-muted-foreground">
                        Frais: {formatCurrency(tx.feeAmount, (tx.currency || "XAF") as SupportedCurrency)}
                      </p>
                      <p className="text-muted-foreground">
                        Total payé: {formatCurrency(tx.totalAmount || tx.amount, (tx.currency || "XAF") as SupportedCurrency)}
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
                        <span className="text-sm">Réf. Interne</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{tx.reference}</code>
                        <Button size="icon" variant="ghost" onClick={() => copyReference(tx.reference!)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {tx.externalReference && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Link2 className="w-4 h-4" />
                        <span className="text-sm">Réf. Externe</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{tx.externalReference}</code>
                        <Button size="icon" variant="ghost" onClick={() => copyReference(tx.externalReference!)}>
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

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="w-4 h-4" />
                      <span className="text-sm">Source</span>
                    </div>
                    <div>{getSourceBadge(tx) || <span className="text-sm text-muted-foreground">Interne</span>}</div>
                  </div>

                  {tx.recipientPhone && tx.type === "deposit" && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm">Numéro utilisé</span>
                      </div>
                      <span className="text-sm font-medium font-mono">{tx.recipientPhone}</span>
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
                      <p className="text-sm font-semibold text-muted-foreground">
                        {tx?.type === "payment_link" ? "Bénéficiaire (compte crédité)" : "Utilisateur"}
                      </p>
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

                {(txDetails?.payerName || txDetails?.payerEmail || txDetails?.paymentIntent?.payerName || txDetails?.paymentIntent?.payerPhone) && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-muted-foreground">Informations du payeur</p>
                      {(txDetails.payerName || txDetails.paymentIntent?.payerName) && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <UserIcon className="w-4 h-4" />
                            <span className="text-sm">Nom</span>
                          </div>
                          <span className="text-sm font-medium">
                            {txDetails.payerName || txDetails.paymentIntent?.payerName}
                          </span>
                        </div>
                      )}
                      {(txDetails.payerEmail || txDetails.paymentIntent?.payerEmail) && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            <span className="text-sm">Email</span>
                          </div>
                          <span className="text-sm font-medium">
                            {txDetails.payerEmail || txDetails.paymentIntent?.payerEmail}
                          </span>
                        </div>
                      )}
                      {txDetails.paymentIntent?.payerPhone && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span className="text-sm">Téléphone</span>
                          </div>
                          <span className="text-sm font-medium">{txDetails.paymentIntent.payerPhone}</span>
                        </div>
                      )}
                      {txDetails.paymentIntent?.payerCountry && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm">Pays</span>
                          </div>
                          <span className="text-sm font-medium">{txDetails.paymentIntent.payerCountry}</span>
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
                        <span className="text-sm font-medium capitalize">{txDetails.operator.depositPaymentProvider || txDetails.operator.paymentProvider}</span>
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
                      placeholder="Ex: Paiement reçu et confirmé, doublon détecté…"
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
                      onClick={() => updateStatusMutation.mutate({ id: tx.id, status: modalStatus, reason: modalReason })}
                      data-testid="button-modal-apply-status"
                    >
                      Appliquer
                    </Button>
                  </div>
                  {tx.status === "pending" && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => updateStatusMutation.mutate({ id: tx.id, status: "completed", reason: modalReason || "Validation dépôt admin" })}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-modal-approve"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Valider le dépôt
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => updateStatusMutation.mutate({ id: tx.id, status: "failed", reason: modalReason || "Rejet dépôt admin" })}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-modal-reject"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Rejeter
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
