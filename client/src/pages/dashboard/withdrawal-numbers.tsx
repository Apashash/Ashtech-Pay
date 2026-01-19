import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WithdrawalNumber, WithdrawalNumberChange, User } from "@shared/schema";
import { Phone, Plus, Loader2, Edit, Trash2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useState, useMemo } from "react";

interface CountryConfig {
  id: string;
  name: string;
  code: string;
  flag: string;
  currency: string;
  operators: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
}

export default function WithdrawalNumbersPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<WithdrawalNumber | null>(null);
  const [newNumber, setNewNumber] = useState({ phoneNumber: "", operatorName: "", label: "" });

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  
  // Fetch deposit config to get dynamic operators by country
  const { data: depositConfig } = useQuery<{ countries: CountryConfig[] }>({
    queryKey: ["/api/deposit-config"],
  });

  // Find the user's country in the config and get its operators
  const operators = useMemo(() => {
    if (!depositConfig?.countries || !user?.country) return [];
    
    const userCountry = depositConfig.countries.find(c => 
      c.name === user.country || c.name.toLowerCase() === user.country?.toLowerCase()
    );
    
    if (!userCountry) return [];
    
    return userCountry.operators
      .filter(op => op.isActive)
      .map(op => op.name);
  }, [depositConfig?.countries, user?.country]);

  const { data: withdrawalNumbers = [], isLoading: numbersLoading } = useQuery<WithdrawalNumber[]>({
    queryKey: ["/api/withdrawal-numbers"],
  });

  const { data: changeRequests = [] } = useQuery<WithdrawalNumberChange[]>({
    queryKey: ["/api/withdrawal-number-changes"],
  });

  const addNumberMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; operatorName: string; label?: string }) => {
      const res = await apiRequest("POST", "/api/withdrawal-numbers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-numbers"] });
      setIsAddDialogOpen(false);
      setNewNumber({ phoneNumber: "", operatorName: "", label: "" });
      toast({ title: "Numéro ajouté", description: "Le numéro de retrait a été enregistré avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const requestChangeMutation = useMutation({
    mutationFn: async (data: { id: string; phoneNumber: string; operatorName: string; label?: string }) => {
      const res = await apiRequest("POST", `/api/withdrawal-numbers/${data.id}/request-change`, {
        phoneNumber: data.phoneNumber,
        operatorName: data.operatorName,
        label: data.label,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-number-changes"] });
      setIsEditDialogOpen(false);
      setEditingNumber(null);
      toast({ 
        title: "Demande envoyée", 
        description: "Votre demande de modification a été envoyée pour approbation" 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
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
            <p className="text-muted-foreground">Gérez vos numéros de téléphone pour les retraits</p>
          </div>
          {withdrawalNumbers.length < 2 && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-number">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un numéro
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un numéro de retrait</DialogTitle>
                  <DialogDescription>
                    Vous pouvez enregistrer jusqu'à 2 numéros de téléphone pour les retraits
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Opérateur</Label>
                    <Select 
                      value={newNumber.operatorName} 
                      onValueChange={(value) => setNewNumber({ ...newNumber, operatorName: value })}
                    >
                      <SelectTrigger data-testid="select-new-operator">
                        <SelectValue placeholder="Choisir un opérateur" />
                      </SelectTrigger>
                      <SelectContent>
                        {operators.map((op) => (
                          <SelectItem key={op} value={op}>{op}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Numéro de téléphone</Label>
                    <Input
                      placeholder="+237 6XX XXX XXX"
                      value={newNumber.phoneNumber}
                      onChange={(e) => setNewNumber({ ...newNumber, phoneNumber: e.target.value })}
                      data-testid="input-new-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Libellé (optionnel)</Label>
                    <Input
                      placeholder="ex: Principal, Secondaire"
                      value={newNumber.label}
                      onChange={(e) => setNewNumber({ ...newNumber, label: e.target.value })}
                      data-testid="input-new-label"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => addNumberMutation.mutate(newNumber)}
                    disabled={addNumberMutation.isPending || !newNumber.phoneNumber || !newNumber.operatorName}
                    data-testid="button-confirm-add"
                  >
                    {addNumberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Enregistrer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Mes numéros enregistrés
            </CardTitle>
            <CardDescription>
              Maximum 2 numéros autorisés. Pour modifier un numéro, une approbation de l'administrateur est requise.
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingNumber(number);
                          setIsEditDialogOpen(true);
                        }}
                        data-testid={`button-edit-${number.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
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

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Demande de modification</DialogTitle>
              <DialogDescription>
                Cette modification nécessite l'approbation d'un administrateur
              </DialogDescription>
            </DialogHeader>
            {editingNumber && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Opérateur</Label>
                  <Select
                    value={editingNumber.operatorName}
                    onValueChange={(value) => setEditingNumber({ ...editingNumber, operatorName: value })}
                  >
                    <SelectTrigger data-testid="select-edit-operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Numéro de téléphone</Label>
                  <Input
                    value={editingNumber.phoneNumber}
                    onChange={(e) => setEditingNumber({ ...editingNumber, phoneNumber: e.target.value })}
                    data-testid="input-edit-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Libellé (optionnel)</Label>
                  <Input
                    value={editingNumber.label || ""}
                    onChange={(e) => setEditingNumber({ ...editingNumber, label: e.target.value })}
                    data-testid="input-edit-label"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => requestChangeMutation.mutate({
                    id: editingNumber.id,
                    phoneNumber: editingNumber.phoneNumber,
                    operatorName: editingNumber.operatorName,
                    label: editingNumber.label || undefined,
                  })}
                  disabled={requestChangeMutation.isPending}
                  data-testid="button-confirm-edit"
                >
                  {requestChangeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Soumettre la demande
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
