import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertCircle,
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { KYC_DOCUMENT_TYPES, BUSINESS_CATEGORIES } from "@shared/schema";

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
}

interface KycStats {
  pending: number;
  approved: number;
  rejected: number;
}

export default function AdminKYC() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [viewSubmission, setViewSubmission] = useState<KycSubmission | null>(null);
  const [rejectModal, setRejectModal] = useState<KycSubmission | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [imageModal, setImageModal] = useState<{ url: string; title: string } | null>(null);

  const { data: submissions, isLoading } = useQuery<KycSubmission[]>({
    queryKey: ["/api/admin/kyc", statusFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/kyc${statusFilter ? `?status=${statusFilter}` : ""}`);
      return response.json();
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
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
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
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const getDocumentTypeName = (typeId: string) => {
    return KYC_DOCUMENT_TYPES.find(d => d.id === typeId)?.name || typeId;
  };

  const getBusinessCategoryName = (categoryId: string) => {
    return BUSINESS_CATEGORIES.find(c => c.id === categoryId)?.name || categoryId;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">En attente</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Approuvé</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Rejeté</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getImageUrl = (path: string) => {
    if (path.startsWith("http")) return path;
    if (path.startsWith("/uploads/")) return path;
    return `/api/objects/public/${path}`;
  };

  const filteredSubmissions = submissions?.filter(sub => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      sub.user?.fullName?.toLowerCase().includes(searchLower) ||
      sub.user?.email?.toLowerCase().includes(searchLower) ||
      sub.user?.phone?.toLowerCase().includes(searchLower) ||
      sub.documentNumber?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Vérifications KYC</h1>
            <p className="text-muted-foreground">Gérez les demandes de vérification d'identité</p>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <Card className="px-4 py-2">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-500">{stats?.pending || 0}</p>
                  <p className="text-xs text-muted-foreground">En attente</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{stats?.approved || 0}</p>
                  <p className="text-xs text-muted-foreground">Approuvés</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{stats?.rejected || 0}</p>
                  <p className="text-xs text-muted-foreground">Rejetés</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email, téléphone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-kyc"
                />
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList>
                  <TabsTrigger value="pending" className="gap-2">
                    <Clock className="w-4 h-4" />
                    En attente
                    {stats?.pending ? <Badge className="bg-yellow-500/20 text-yellow-500 text-xs ml-1">{stats.pending}</Badge> : null}
                  </TabsTrigger>
                  <TabsTrigger value="approved">Approuvés</TabsTrigger>
                  <TabsTrigger value="rejected">Rejetés</TabsTrigger>
                  <TabsTrigger value="">Tous</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredSubmissions?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune soumission KYC trouvée
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Activité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((sub) => (
                    <TableRow key={sub.id} data-testid={`row-kyc-${sub.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.user?.fullName || "N/A"}</p>
                          <p className="text-sm text-muted-foreground">{sub.user?.email}</p>
                          {sub.user?.phone && (
                            <p className="text-xs text-muted-foreground">{sub.user.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{getDocumentTypeName(sub.documentType)}</p>
                          <p className="text-xs text-muted-foreground">{sub.documentNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="text-xs mb-1">
                            {sub.businessType === "physical" ? "Physique" : "En ligne"}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {getBusinessCategoryName(sub.businessCategory)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell>
                        {sub.createdAt && (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(sub.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
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
                                className="text-green-500 hover:text-green-600"
                                onClick={() => approveMutation.mutate({ id: sub.id })}
                                disabled={approveMutation.isPending}
                                data-testid={`button-quick-approve-${sub.id}`}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600"
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
            )}
          </CardContent>
        </Card>

        <Dialog open={!!viewSubmission} onOpenChange={() => setViewSubmission(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Détails de la vérification KYC
              </DialogTitle>
              <DialogDescription>
                Vérifiez les informations et documents soumis par l'utilisateur
              </DialogDescription>
            </DialogHeader>

            {viewSubmission && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  {getStatusBadge(viewSubmission.status)}
                  {viewSubmission.reviewedAt && (
                    <span className="text-sm text-muted-foreground">
                      Examiné le {format(new Date(viewSubmission.reviewedAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </span>
                  )}
                </div>

                {viewSubmission.reviewNote && viewSubmission.status === "rejected" && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-sm text-red-400">
                      <strong>Note de rejet :</strong> {viewSubmission.reviewNote}
                    </p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserIcon className="w-4 h-4" />
                        Informations utilisateur
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nom complet</span>
                        <span className="font-medium">{viewSubmission.user?.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span>{viewSubmission.user?.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Téléphone</span>
                        <span>{viewSubmission.user?.phone || "N/A"}</span>
                      </div>
                      {viewSubmission.user?.createdAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Inscrit le</span>
                          <span>{format(new Date(viewSubmission.user.createdAt), "dd/MM/yyyy", { locale: fr })}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Document d'identité
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">{getDocumentTypeName(viewSubmission.documentType)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Numéro</span>
                        <span className="font-mono">{viewSubmission.documentNumber}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {(viewSubmission.country || viewSubmission.city) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Adresse
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pays</span>
                          <span className="font-medium">{viewSubmission.country || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ville</span>
                          <span className="font-medium">{viewSubmission.city || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Code postal</span>
                          <span className="font-medium">{viewSubmission.postalCode || "N/A"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Informations sur l'activité
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type d'activité</span>
                      <Badge variant="outline">
                        {viewSubmission.businessType === "physical" ? "Commerce physique" : "Commerce en ligne"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Catégorie</span>
                      <span className="font-medium">{getBusinessCategoryName(viewSubmission.businessCategory)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-2">Description</span>
                      <p className="bg-muted/50 rounded-lg p-3 text-sm">
                        {viewSubmission.businessDescription}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Documents soumis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Recto du document</p>
                        <button
                          onClick={() => setImageModal({ url: getImageUrl(viewSubmission.documentFrontPath), title: "Recto du document" })}
                          className="w-full aspect-video bg-muted rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                          data-testid="button-view-front"
                        >
                          <img
                            src={getImageUrl(viewSubmission.documentFrontPath)}
                            alt="Document recto"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Verso du document</p>
                        <button
                          onClick={() => setImageModal({ url: getImageUrl(viewSubmission.documentBackPath), title: "Verso du document" })}
                          className="w-full aspect-video bg-muted rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                          data-testid="button-view-back"
                        >
                          <img
                            src={getImageUrl(viewSubmission.documentBackPath)}
                            alt="Document verso"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Selfie avec document</p>
                        <button
                          onClick={() => setImageModal({ url: getImageUrl(viewSubmission.selfiePath), title: "Selfie avec document" })}
                          className="w-full aspect-video bg-muted rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                          data-testid="button-view-selfie"
                        >
                          <img
                            src={getImageUrl(viewSubmission.selfiePath)}
                            alt="Selfie"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {viewSubmission.status === "pending" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Note d'approbation (optionnel)</Label>
                      <Textarea
                        value={approveNote}
                        onChange={(e) => setApproveNote(e.target.value)}
                        placeholder="Ajouter une note interne..."
                        rows={2}
                        data-testid="textarea-approve-note"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setRejectModal(viewSubmission)}
                        data-testid="button-reject-kyc"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Rejeter
                      </Button>
                      <Button
                        onClick={() => approveMutation.mutate({ id: viewSubmission.id, note: approveNote })}
                        disabled={approveMutation.isPending}
                        data-testid="button-approve-kyc"
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Approuver
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!rejectModal} onOpenChange={() => setRejectModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500">
                <AlertCircle className="w-5 h-5" />
                Rejeter la vérification
              </DialogTitle>
              <DialogDescription>
                Indiquez la raison du rejet. L'utilisateur sera notifié et pourra soumettre de nouveaux documents.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Raison du rejet *</Label>
                <Textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Ex: Document illisible, photo floue, informations incohérentes..."
                  rows={4}
                  data-testid="textarea-reject-note"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectModal(null)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (rejectModal && rejectNote.trim()) {
                    rejectMutation.mutate({ id: rejectModal.id, note: rejectNote });
                  }
                }}
                disabled={!rejectNote.trim() || rejectMutation.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Confirmer le rejet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!imageModal} onOpenChange={() => setImageModal(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{imageModal?.title}</DialogTitle>
            </DialogHeader>
            {imageModal && (
              <div className="flex items-center justify-center">
                <img
                  src={imageModal.url}
                  alt={imageModal.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
