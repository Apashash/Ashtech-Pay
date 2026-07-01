import { getAdminPath } from "@/lib/adminPath";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
const A = getAdminPath();
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Eye,
  Clock,
  Building2,
  CreditCard,
  User as UserIcon,
  Image as ImageIcon,
  Shield,
  Loader2,
  MapPin,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { KYC_DOCUMENT_TYPES, BUSINESS_CATEGORIES } from "@shared/schema";
import { getImageSrc } from "@/lib/image";

interface KycSubmission {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  documentFrontPath: string;
  documentBackPath: string;
  selfiePath: string;
  country: string | null;
  city: string | null;
  postalCode: string | null;
  businessType: string;
  businessCategory: string;
  businessDescription: string;
  status: string;
  reviewerId: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    username: string;
    createdAt?: string;
  } | null;
  duplicateAccounts: {
    submissionId: string;
    userId: string;
    status: string;
    fullName: string;
    email: string;
    username: string;
  }[];
}

interface KycStats {
  pending: number;
  approved: number;
  rejected: number;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-muted-foreground text-sm shrink-0 w-32">{label}</span>
      <span className="text-sm font-medium break-all min-w-0 flex-1">{value}</span>
    </div>
  );
}

export default function AdminKYC() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") || "";
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [viewSubmission, setViewSubmission] = useState<KycSubmission | null>(null);
  const [rejectModal, setRejectModal] = useState<KycSubmission | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [imageModal, setImageModal] = useState<{ url: string; title: string } | null>(null);

  const { data: submissions, isLoading } = useQuery<KycSubmission[]>({
    queryKey: ["/api/admin/kyc", statusFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/kyc${statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : ""}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: stats } = useQuery<KycStats>({
    queryKey: ["/api/admin/kyc/stats"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      return apiRequest("POST", `/api/admin/kyc/${id}/approve`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/stats"] });
      toast({ title: "Vérification approuvée" });
      setViewSubmission(null);
      setApproveNote("");
    },
    onError: (err: any) => {
      const msg = err?.message;
      if (msg === "PIN_CANCELLED") return;
      if (msg === "PIN_LOCKED") return;
      toast({
        title: "Erreur lors de l'approbation",
        description: msg || "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      return apiRequest("POST", `/api/admin/kyc/${id}/reject`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/stats"] });
      toast({ title: "Vérification rejetée" });
      setRejectModal(null);
      setRejectNote("");
      setViewSubmission(null);
    },
    onError: (err: any) => {
      const msg = err?.message;
      if (msg === "PIN_CANCELLED") return;
      if (msg === "PIN_LOCKED") return;
      toast({
        title: "Erreur lors du rejet",
        description: msg || "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  const getDocumentTypeName = (typeId: string) =>
    KYC_DOCUMENT_TYPES.find(d => d.id === typeId)?.name || typeId;

  const getBusinessCategoryName = (categoryId: string) =>
    BUSINESS_CATEGORIES.find(c => c.id === categoryId)?.name || categoryId;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 shrink-0">En attente</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 shrink-0">Approuvé</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 shrink-0">Rejeté</Badge>;
      default:
        return <Badge className="shrink-0">{status}</Badge>;
    }
  };

  const getImageUrl = (path: string) => getImageSrc(path);

  const filteredSubmissions = submissions?.filter(sub => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      sub.user?.fullName?.toLowerCase().includes(s) ||
      sub.user?.email?.toLowerCase().includes(s) ||
      sub.user?.phone?.toLowerCase().includes(s) ||
      sub.documentNumber?.toLowerCase().includes(s)
    );
  });

  const totalPages = Math.max(1, Math.ceil((filteredSubmissions?.length || 0) / PAGE_SIZE));
  const paginatedSubmissions = filteredSubmissions?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Vérifications KYC</h1>
            <p className="text-muted-foreground text-sm">Gérez les demandes de vérification d'identité</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <Card className="px-4 py-2">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-yellow-500">{stats?.pending || 0}</p>
                  <p className="text-xs text-muted-foreground">En attente</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-500">{stats?.approved || 0}</p>
                  <p className="text-xs text-muted-foreground">Approuvés</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-red-500">{stats?.rejected || 0}</p>
                  <p className="text-xs text-muted-foreground">Rejetés</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher nom, email, téléphone..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-10"
                  data-testid="input-search-kyc"
                />
              </div>
              <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }} className="w-full sm:w-auto">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="" className="flex-1 sm:flex-none text-xs sm:text-sm">Tous</TabsTrigger>
                  <TabsTrigger value="pending" className="gap-1 flex-1 sm:flex-none text-xs sm:text-sm">
                    <Clock className="w-3 h-3" />
                    Attente
                    {stats?.pending ? <Badge className="bg-yellow-500/20 text-yellow-500 text-xs ml-0.5 px-1">{stats.pending}</Badge> : null}
                  </TabsTrigger>
                  <TabsTrigger value="approved" className="flex-1 sm:flex-none text-xs sm:text-sm">Approuvés</TabsTrigger>
                  <TabsTrigger value="rejected" className="flex-1 sm:flex-none text-xs sm:text-sm">Rejetés</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredSubmissions?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucune soumission KYC trouvée
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Utilisateur</TableHead>
                      <TableHead className="min-w-[120px]">Document</TableHead>
                      <TableHead className="min-w-[110px]">Activité</TableHead>
                      <TableHead className="w-[100px]">Statut</TableHead>
                      <TableHead className="w-[110px]">Date</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSubmissions!.map((sub) => (
                      <TableRow key={sub.id} data-testid={`row-kyc-${sub.id}`}>
                        <TableCell className="max-w-[160px]">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              {sub.duplicateAccounts?.length > 0 && (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                              )}
                              <p className={`font-medium text-sm truncate ${sub.duplicateAccounts?.length > 0 ? "text-red-500" : ""}`}>
                                {sub.user?.fullName || "N/A"}
                              </p>
                            </div>
                            {sub.duplicateAccounts?.length > 0 && (
                              <p className="text-xs text-red-400 font-medium">
                                {sub.duplicateAccounts.length + 1} compte(s) même ID
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground truncate">{sub.user?.email}</p>
                            {sub.user?.phone && (
                              <p className="text-xs text-muted-foreground truncate">{sub.user.phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[130px]">
                          <div className="space-y-0.5">
                            <p className="text-sm truncate">{getDocumentTypeName(sub.documentType)}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{sub.documentNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[120px]">
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {sub.businessType === "physical" ? "Physique" : "En ligne"}
                            </Badge>
                            <p className="text-xs text-muted-foreground truncate">
                              {getBusinessCategoryName(sub.businessCategory)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {sub.createdAt && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(sub.createdAt), "dd/MM/yy HH:mm", { locale: fr })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setViewSubmission(sub)}
                              data-testid={`button-view-kyc-${sub.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {sub.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-500 hover:text-green-600"
                                  onClick={() => approveMutation.mutate({ id: sub.id })}
                                  disabled={approveMutation.isPending}
                                  data-testid={`button-quick-approve-${sub.id}`}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600"
                                  onClick={() => setRejectModal(sub)}
                                  data-testid={`button-quick-reject-${sub.id}`}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {(filteredSubmissions?.length || 0) > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredSubmissions!.length)} sur {filteredSubmissions!.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded text-sm border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    ‹ Préc
                  </button>
                  <span className="px-3 py-1 text-sm font-medium">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded text-sm border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    Suiv ›
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View modal */}
        <Dialog open={!!viewSubmission} onOpenChange={() => setViewSubmission(null)}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 shrink-0" />
                Détails de la vérification KYC
              </DialogTitle>
              <DialogDescription>
                Informations et documents soumis par l'utilisateur
              </DialogDescription>
            </DialogHeader>

            {viewSubmission && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {getStatusBadge(viewSubmission.status)}
                  {viewSubmission.reviewedAt && (
                    <span className="text-xs text-muted-foreground">
                      Examiné le {format(new Date(viewSubmission.reviewedAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </span>
                  )}
                </div>

                {viewSubmission.reviewNote && viewSubmission.status === "rejected" && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-sm text-red-400 break-words">
                      <strong>Note de rejet :</strong> {viewSubmission.reviewNote}
                    </p>
                  </div>
                )}

                {/* Alerte doublons de document */}
                {viewSubmission.duplicateAccounts?.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-sm font-semibold text-red-500">
                        Numéro de document utilisé par {viewSubmission.duplicateAccounts.length + 1} compte(s)
                      </p>
                    </div>
                    <p className="text-xs text-red-400">
                      Ce document <span className="font-mono font-bold">{viewSubmission.documentNumber}</span> est aussi utilisé par :
                    </p>
                    <div className="space-y-2">
                      {viewSubmission.duplicateAccounts.map((acc) => (
                        <div key={acc.submissionId} className="flex items-center justify-between gap-2 bg-red-500/10 rounded-md px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-red-300 truncate">{acc.fullName}</p>
                            <p className="text-xs text-red-400 truncate">{acc.email}</p>
                            <p className="text-xs text-muted-foreground">@{acc.username} — {acc.status === "pending" ? "En attente" : acc.status === "approved" ? "Approuvé" : "Rejeté"}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1"
                            onClick={() => {
                              setViewSubmission(null);
                              navigate(`${A}/users?search=${encodeURIComponent(acc.email)}`);
                            }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Voir
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Utilisateur + Document côte à côte */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <UserIcon className="w-4 h-4 shrink-0" />
                        Utilisateur
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-1">
                      <InfoRow label="Nom" value={viewSubmission.user?.fullName || "N/A"} />
                      <InfoRow label="Email" value={viewSubmission.user?.email || "N/A"} />
                      <InfoRow label="Téléphone" value={viewSubmission.user?.phone || "N/A"} />
                      {viewSubmission.user?.createdAt && (
                        <InfoRow label="Inscrit le" value={format(new Date(viewSubmission.user.createdAt), "dd/MM/yyyy", { locale: fr })} />
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CreditCard className="w-4 h-4 shrink-0" />
                        Document d'identité
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-1">
                      <InfoRow label="Type" value={getDocumentTypeName(viewSubmission.documentType)} />
                      <InfoRow label="Numéro" value={<span className="font-mono">{viewSubmission.documentNumber}</span>} />
                    </CardContent>
                  </Card>
                </div>

                {/* Adresse */}
                {(viewSubmission.country || viewSubmission.city) && (
                  <Card>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4 shrink-0" />
                        Adresse
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid sm:grid-cols-3 gap-2">
                        <InfoRow label="Pays" value={viewSubmission.country || "N/A"} />
                        <InfoRow label="Ville" value={viewSubmission.city || "N/A"} />
                        <InfoRow label="Code postal" value={viewSubmission.postalCode || "N/A"} />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Activité */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4 shrink-0" />
                      Activité commerciale
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    <InfoRow
                      label="Type"
                      value={
                        <Badge variant="outline" className="text-xs">
                          {viewSubmission.businessType === "physical" ? "Commerce physique" : "Commerce en ligne"}
                        </Badge>
                      }
                    />
                    <InfoRow label="Catégorie" value={getBusinessCategoryName(viewSubmission.businessCategory)} />
                    <div>
                      <p className="text-muted-foreground text-sm mb-1">Description</p>
                      <p className="bg-muted/50 rounded-lg p-3 text-sm break-words">
                        {viewSubmission.businessDescription}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Documents */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 shrink-0" />
                      Documents soumis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { path: viewSubmission.documentFrontPath, label: "Recto", testId: "button-view-front", alt: "Document recto" },
                        { path: viewSubmission.documentBackPath, label: "Verso", testId: "button-view-back", alt: "Document verso" },
                        { path: viewSubmission.selfiePath, label: "Selfie", testId: "button-view-selfie", alt: "Selfie" },
                      ].map(({ path, label, testId, alt }) => (
                        <div key={testId}>
                          <p className="text-xs text-muted-foreground mb-1 text-center">{label}</p>
                          <button
                            onClick={() => setImageModal({ url: getImageUrl(path), title: label })}
                            className="w-full aspect-video bg-muted rounded-lg overflow-hidden hover:opacity-80 transition-opacity relative"
                            data-testid={testId}
                          >
                            <img
                              src={getImageUrl(path)}
                              alt={alt}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector(".img-error-msg")) {
                                  const msg = document.createElement("div");
                                  msg.className = "img-error-msg flex flex-col items-center justify-center h-full text-muted-foreground text-xs p-2 text-center";
                                  msg.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5 mb-1 opacity-40' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'/></svg>Non disponible`;
                                  parent.appendChild(msg);
                                }
                              }}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Actions pour pending */}
                {viewSubmission.status === "pending" && (
                  <div className="space-y-3 border-t pt-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Note d'approbation (optionnel)</Label>
                      <Textarea
                        value={approveNote}
                        onChange={(e) => setApproveNote(e.target.value)}
                        placeholder="Ajouter une note interne..."
                        rows={2}
                        data-testid="textarea-approve-note"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setRejectModal(viewSubmission)}
                        className="gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10 w-full sm:w-auto"
                        data-testid="button-reject-kyc"
                      >
                        <XCircle className="w-4 h-4" />
                        Rejeter
                      </Button>
                      <Button
                        onClick={() => approveMutation.mutate({ id: viewSubmission.id, note: approveNote })}
                        disabled={approveMutation.isPending}
                        className="gap-2 w-full sm:w-auto"
                        data-testid="button-approve-kyc"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {approveMutation.isPending ? "Approbation..." : "Approuver"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject modal */}
        <Dialog open={!!rejectModal} onOpenChange={() => setRejectModal(null)}>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500">
                <XCircle className="w-5 h-5 shrink-0" />
                Rejeter la vérification
              </DialogTitle>
              <DialogDescription>
                Expliquez la raison du rejet. L'utilisateur recevra cette note.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Raison du rejet (obligatoire)..."
                rows={3}
                data-testid="textarea-reject-note"
              />
              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <Button variant="outline" onClick={() => setRejectModal(null)} className="w-full sm:w-auto">
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => rejectModal && rejectMutation.mutate({ id: rejectModal.id, note: rejectNote })}
                  disabled={!rejectNote.trim() || rejectMutation.isPending}
                  className="gap-2 w-full sm:w-auto"
                  data-testid="button-confirm-reject"
                >
                  <XCircle className="w-4 h-4" />
                  {rejectMutation.isPending ? "Rejet..." : "Confirmer le rejet"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Image fullscreen modal */}
        <Dialog open={!!imageModal} onOpenChange={() => setImageModal(null)}>
          <DialogContent className="w-[95vw] max-w-3xl p-2">
            <DialogHeader className="p-2">
              <DialogTitle className="text-sm">{imageModal?.title}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center">
              <img
                src={imageModal?.url}
                alt={imageModal?.title}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
