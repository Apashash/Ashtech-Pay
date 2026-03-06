import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Phone, Loader2, Clock, CheckCircle2, XCircle, User, Calendar } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface WithdrawalNumberChangeWithUser {
  id: string;
  userId: string;
  withdrawalNumberId: string | null;
  action: string;
  newPhoneNumber: string | null;
  newOperatorName: string | null;
  newLabel: string | null;
  status: string;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user?: {
    fullName: string;
    email: string;
    phone: string;
  };
}

export default function AdminWithdrawalNumbersPage() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalNumberChangeWithUser | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  const { data: changeRequests = [], isLoading } = useQuery<WithdrawalNumberChangeWithUser[]>({
    queryKey: ["/api/admin/withdrawal-number-changes"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await apiRequest("POST", `/api/admin/withdrawal-number-changes/${id}/approve`, { note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawal-number-changes"] });
      setIsApproveDialogOpen(false);
      setSelectedRequest(null);
      setAdminNote("");
      toast({ title: "Demande approuvée", description: "La modification a été appliquée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await apiRequest("POST", `/api/admin/withdrawal-number-changes/${id}/reject`, { note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawal-number-changes"] });
      setIsRejectDialogOpen(false);
      setSelectedRequest(null);
      setAdminNote("");
      toast({ title: "Demande rejetée", description: "La demande a été rejetée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const pendingRequests = changeRequests.filter(r => r.status === "pending");
  const processedRequests = changeRequests.filter(r => r.status !== "pending");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> En attente</Badge>;
      case "approved":
        return <Badge className="gap-1 bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3" /> Approuvé</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Rejeté</Badge>;
      default:
        return null;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "add":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">Ajout</Badge>;
      case "update":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Modification</Badge>;
      case "delete":
        return <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">Suppression</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Numéros de retrait</h1>
          <p className="text-muted-foreground">Gérez les demandes de modification de numéros de retrait</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Demandes en attente ({pendingRequests.length})
            </CardTitle>
            <CardDescription>
              Approuvez ou rejetez les demandes de modification
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucune demande en attente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border bg-card"
                    data-testid={`pending-request-${request.id}`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getActionBadge(request.action)}
                          {getStatusBadge(request.status)}
                        </div>

                        {request.user && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                            <User className="w-4 h-4 shrink-0" />
                            <span className="font-medium">{request.user.fullName}</span>
                            <span className="text-muted-foreground/60 break-all">({request.user.email})</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span>{format(new Date(request.createdAt), "dd MMM yyyy à HH:mm", { locale: fr })}</span>
                        </div>

                        {request.newPhoneNumber && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium">{request.newPhoneNumber}</span>
                            {request.newOperatorName && (
                              <span className="text-muted-foreground">({request.newOperatorName})</span>
                            )}
                          </div>
                        )}

                        {request.newLabel && (
                          <p className="text-sm text-muted-foreground">Libellé: {request.newLabel}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-green-600 border-green-500/40 hover:bg-green-500/10 hover:text-green-700"
                          onClick={() => {
                            setSelectedRequest(request);
                            setIsApproveDialogOpen(true);
                          }}
                          data-testid={`button-approve-${request.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Approuver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-red-600 border-red-500/40 hover:bg-red-500/10 hover:text-red-700"
                          onClick={() => {
                            setSelectedRequest(request);
                            setIsRejectDialogOpen(true);
                          }}
                          data-testid={`button-reject-${request.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rejeter
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {processedRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Historique des demandes</CardTitle>
              <CardDescription>Demandes déjà traitées</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {processedRequests.slice(0, 20).map((request) => (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getActionBadge(request.action)}
                          {getStatusBadge(request.status)}
                        </div>
                        
                        {request.user && (
                          <p className="text-sm text-muted-foreground">{request.user.fullName}</p>
                        )}

                        {request.newPhoneNumber && (
                          <p className="text-sm">{request.newPhoneNumber} ({request.newOperatorName})</p>
                        )}

                        {request.adminNote && (
                          <p className="text-sm text-muted-foreground italic">Note: {request.adminNote}</p>
                        )}
                      </div>

                      <div className="text-right text-sm text-muted-foreground">
                        <p>{format(new Date(request.createdAt), "dd/MM/yyyy", { locale: fr })}</p>
                        {request.reviewedAt && (
                          <p>Traité le {format(new Date(request.reviewedAt), "dd/MM/yyyy", { locale: fr })}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approuver la demande</DialogTitle>
              <DialogDescription>
                Confirmez l'approbation de cette demande de modification
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="font-medium">{selectedRequest.action === "delete" ? "Suppression" : "Modification"}</p>
                  {selectedRequest.newPhoneNumber && (
                    <p className="text-sm">{selectedRequest.newPhoneNumber} ({selectedRequest.newOperatorName})</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Note (optionnel)</Label>
                  <Textarea
                    placeholder="Ajouter une note..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    data-testid="input-admin-note"
                  />
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => approveMutation.mutate({ id: selectedRequest.id, note: adminNote })}
                  disabled={approveMutation.isPending}
                  data-testid="button-confirm-approve"
                >
                  {approveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmer l'approbation
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeter la demande</DialogTitle>
              <DialogDescription>
                Indiquez la raison du rejet
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="font-medium">{selectedRequest.action === "delete" ? "Suppression" : "Modification"}</p>
                  {selectedRequest.newPhoneNumber && (
                    <p className="text-sm">{selectedRequest.newPhoneNumber} ({selectedRequest.newOperatorName})</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Raison du rejet</Label>
                  <Textarea
                    placeholder="Expliquez pourquoi cette demande est rejetée..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    data-testid="input-reject-reason"
                  />
                </div>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => rejectMutation.mutate({ id: selectedRequest.id, note: adminNote })}
                  disabled={rejectMutation.isPending}
                  data-testid="button-confirm-reject"
                >
                  {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmer le rejet
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
