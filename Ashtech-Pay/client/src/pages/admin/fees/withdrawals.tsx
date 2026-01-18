import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "../layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, DollarSign, Percent, ArrowUpCircle, Filter } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Fee, Country, Operator } from "@shared/schema";

export default function AdminFeesWithdrawals() {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterOperator, setFilterOperator] = useState<string>("all");
  const [formData, setFormData] = useState({
    name: "",
    transactionType: "withdrawal",
    feeType: "percentage",
    feeValue: "",
    minFee: "",
    maxFee: "",
    countryId: "",
    operatorId: "",
    isActive: true,
  });

  const { data: fees, isLoading } = useQuery<Fee[]>({
    queryKey: ["/api/admin/fees"],
  });

  const { data: countries } = useQuery<Country[]>({
    queryKey: ["/api/admin/countries"],
  });

  const { data: operators } = useQuery<Operator[]>({
    queryKey: ["/api/admin/operators"],
  });

  const withdrawalFees = useMemo(() => {
    let filtered = fees?.filter(f => f.transactionType === "withdrawal") || [];
    if (filterCountry !== "all") {
      filtered = filtered.filter(f => f.countryId === filterCountry || !f.countryId);
    }
    if (filterOperator !== "all") {
      filtered = filtered.filter(f => f.operatorId === filterOperator || !f.operatorId);
    }
    return filtered;
  }, [fees, filterCountry, filterOperator]);

  const filteredOperators = useMemo(() => {
    if (filterCountry === "all") return operators || [];
    return operators?.filter(op => op.countryId === filterCountry) || [];
  }, [operators, filterCountry]);

  const formOperators = useMemo(() => {
    if (!formData.countryId) return [];
    return operators?.filter(op => op.countryId === formData.countryId) || [];
  }, [operators, formData.countryId]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/admin/fees", {
        ...data,
        feeValue: data.feeValue,
        minFee: data.minFee || null,
        maxFee: data.maxFee || null,
        countryId: data.countryId || null,
        operatorId: data.operatorId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Frais de retrait créé" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/admin/fees/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Frais mis à jour" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/fees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Frais supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setShowModal(false);
    setEditingFee(null);
    setFormData({
      name: "",
      transactionType: "withdrawal",
      feeType: "percentage",
      feeValue: "",
      minFee: "",
      maxFee: "",
      countryId: "",
      operatorId: "",
      isActive: true,
    });
  };

  const openEdit = (fee: Fee) => {
    setEditingFee(fee);
    setFormData({
      name: fee.name,
      transactionType: fee.transactionType,
      feeType: fee.feeType,
      feeValue: fee.feeValue,
      minFee: fee.minFee || "",
      maxFee: fee.maxFee || "",
      countryId: fee.countryId || "",
      operatorId: fee.operatorId || "",
      isActive: fee.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (editingFee) {
      updateMutation.mutate({ id: editingFee.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getCountryName = (id: string | null) => {
    if (!id) return "Global";
    return countries?.find(c => c.id === id)?.name || "Inconnu";
  };

  const getOperatorName = (id: string | null) => {
    if (!id) return "Tous";
    return operators?.find(o => o.id === id)?.name || "Inconnu";
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <ArrowUpCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Frais de Retrait</h1>
              <p className="text-muted-foreground">Configurez les frais pour les retraits</p>
            </div>
          </div>
          <Button onClick={() => setShowModal(true)} className="gap-2" data-testid="button-add-withdrawal-fee">
            <Plus className="w-4 h-4" />
            Nouveau frais
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filtrer:</span>
              </div>
              <Select value={filterCountry} onValueChange={(v) => { setFilterCountry(v); setFilterOperator("all"); }}>
                <SelectTrigger className="w-[180px]" data-testid="filter-country">
                  <SelectValue placeholder="Tous les pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les pays</SelectItem>
                  {countries?.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterOperator} onValueChange={setFilterOperator} disabled={filterCountry === "all"}>
                <SelectTrigger className="w-[180px]" data-testid="filter-operator">
                  <SelectValue placeholder={filterCountry === "all" ? "Sélectionnez un pays" : "Tous opérateurs"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous opérateurs</SelectItem>
                  {filteredOperators.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type de frais</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Min/Max</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Opérateur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : !withdrawalFees.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucun frais de retrait configuré
                    </TableCell>
                  </TableRow>
                ) : (
                  withdrawalFees.map((fee) => (
                    <TableRow key={fee.id} data-testid={`fee-row-${fee.id}`}>
                      <TableCell className="font-medium">{fee.name}</TableCell>
                      <TableCell>
                        {fee.feeType === "percentage" ? (
                          <span className="flex items-center gap-1">
                            <Percent className="w-4 h-4" /> Pourcentage
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" /> Fixe
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-bold">
                        {fee.feeType === "percentage" 
                          ? `${fee.feeValue}%` 
                          : `${fee.feeValue} XAF`}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {fee.minFee || fee.maxFee ? (
                          <>
                            {fee.minFee && <span>Min: {fee.minFee} XAF</span>}
                            {fee.minFee && fee.maxFee && " / "}
                            {fee.maxFee && <span>Max: {fee.maxFee} XAF</span>}
                          </>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{getCountryName(fee.countryId)}</TableCell>
                      <TableCell>{getOperatorName(fee.operatorId)}</TableCell>
                      <TableCell>
                        <Badge variant={fee.isActive ? "default" : "secondary"}>
                          {fee.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => openEdit(fee)}
                            data-testid={`button-edit-fee-${fee.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Supprimer ce frais ?")) {
                                deleteMutation.mutate(fee.id);
                              }
                            }}
                            className="text-destructive"
                            data-testid={`button-delete-fee-${fee.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showModal} onOpenChange={() => resetForm()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFee ? "Modifier le frais de retrait" : "Nouveau frais de retrait"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Frais retrait Orange Cameroun"
                  data-testid="input-fee-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Type de frais</Label>
                <Select
                  value={formData.feeType}
                  onValueChange={(v) => setFormData({ ...formData, feeType: v })}
                >
                  <SelectTrigger data-testid="select-fee-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                    <SelectItem value="fixed">Montant fixe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Valeur</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.feeValue}
                    onChange={(e) => setFormData({ ...formData, feeValue: e.target.value })}
                    placeholder={formData.feeType === "percentage" ? "2.5" : "100"}
                    data-testid="input-fee-value"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min (optionnel)</Label>
                  <Input
                    type="number"
                    value={formData.minFee}
                    onChange={(e) => setFormData({ ...formData, minFee: e.target.value })}
                    placeholder="50"
                    data-testid="input-fee-min"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max (optionnel)</Label>
                  <Input
                    type="number"
                    value={formData.maxFee}
                    onChange={(e) => setFormData({ ...formData, maxFee: e.target.value })}
                    placeholder="5000"
                    data-testid="input-fee-max"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pays (optionnel)</Label>
                  <Select
                    value={formData.countryId || "all"}
                    onValueChange={(v) => setFormData({ 
                      ...formData, 
                      countryId: v === "all" ? "" : v,
                      operatorId: "" 
                    })}
                  >
                    <SelectTrigger data-testid="select-fee-country">
                      <SelectValue placeholder="Global (tous)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Global (tous)</SelectItem>
                      {countries?.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Opérateur (optionnel)</Label>
                  <Select
                    value={formData.operatorId || "all"}
                    onValueChange={(v) => setFormData({ ...formData, operatorId: v === "all" ? "" : v })}
                    disabled={!formData.countryId}
                  >
                    <SelectTrigger data-testid="select-fee-operator">
                      <SelectValue placeholder={formData.countryId ? "Tous opérateurs" : "Sélectionnez d'abord un pays"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous opérateurs</SelectItem>
                      {formOperators.map((op) => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-fee-active"
                />
                <Label>Actif</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} data-testid="button-save-fee">
                {editingFee ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
