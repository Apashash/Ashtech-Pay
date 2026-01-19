import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WithdrawalNumber, WithdrawalNumberChange } from "@shared/schema";
import { Phone, Plus, Loader2, Edit, Trash2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function WithdrawalNumbersPage() {
  const { toast } = useToast();

  const { data: withdrawalNumbers = [], isLoading: numbersLoading } = useQuery<WithdrawalNumber[]>({
    queryKey: ["/api/withdrawal-numbers"],
  });

  const { data: changeRequests = [] } = useQuery<WithdrawalNumberChange[]>({
    queryKey: ["/api/withdrawal-number-changes"],
  });

  const requestDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/withdrawal-numbers/${id}/request-delete`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-number-changes"] });
      toast({ 
        title: "Demande envoyée", 
        description: "Votre demande de suppression a été envoyée pour approbation" 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const pendingRequests = changeRequests.filter(r => r.status === "pending");

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

  const getActionText = (action: string) => {
    switch (action) {
      case "add": return "Ajout";
      case "update": return "Modification";
      case "delete": return "Suppression";
      default: return action;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Numéros de retrait</h1>
            <p className="text-muted-foreground">Gérez vos numéros de téléphone pour les retraits (max. 2)</p>
          </div>
          {withdrawalNumbers.length < 2 && (
            <Link href="/dashboard/withdrawal-numbers/add">
              <Button data-testid="button-add-number">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un numéro
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Mes numéros enregistrés
            </CardTitle>
            <CardDescription>
              Maximum 2 numéros autorisés. Pour modifier ou supprimer un numéro, une approbation de l'administrateur est requise.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {numbersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : withdrawalNumbers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucun numéro de retrait enregistré</p>
                <p className="text-sm">Ajoutez un numéro pour pouvoir effectuer des retraits</p>
                <Link href="/dashboard/withdrawal-numbers/add">
                  <Button className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un numéro
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawalNumbers.map((number) => (
                  <div
                    key={number.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    data-testid={`withdrawal-number-${number.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                        <Phone className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{number.phoneNumber}</p>
                        <p className="text-sm text-muted-foreground">{number.operatorName}</p>
                        {number.label && (
                          <Badge variant="outline" className="mt-1">{number.label}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/withdrawal-numbers/edit/${number.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-edit-${number.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => requestDeleteMutation.mutate(number.id)}
                        disabled={requestDeleteMutation.isPending}
                        data-testid={`button-delete-${number.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {pendingRequests.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                Demandes en attente
              </CardTitle>
              <CardDescription>
                Ces modifications attendent l'approbation d'un administrateur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{getActionText(request.action)}</Badge>
                        {getStatusBadge(request.status)}
                      </div>
                      {request.newPhoneNumber && (
                        <p className="text-sm text-foreground">Nouveau numéro: {request.newPhoneNumber}</p>
                      )}
                      {request.newOperatorName && (
                        <p className="text-sm text-muted-foreground">Opérateur: {request.newOperatorName}</p>
                      )}
                    </div>
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {changeRequests.filter(r => r.status !== "pending").length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Historique des demandes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {changeRequests.filter(r => r.status !== "pending").map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{getActionText(request.action)}</Badge>
                        {getStatusBadge(request.status)}
                      </div>
                      {request.newPhoneNumber && (
                        <p className="text-sm text-muted-foreground">Numéro: {request.newPhoneNumber}</p>
                      )}
                      {request.adminNote && (
                        <p className="text-sm text-muted-foreground mt-1">Note: {request.adminNote}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
