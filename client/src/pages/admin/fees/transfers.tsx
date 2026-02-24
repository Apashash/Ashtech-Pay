import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "../layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Pencil, Send, Filter, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Fee, Country } from "@shared/schema";

export default function AdminFeesTransfers() {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [ashtechMargin, setAshtechMargin] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: fees, isLoading } = useQuery<Fee[]>({
    queryKey: ["/api/admin/fees"],
  });

  const { data: countries } = useQuery<Country[]>({
    queryKey: ["/api/admin/countries"],
  });

  const transferFees = useMemo(() => {
    let filtered = fees?.filter(f => f.transactionType === "transfer") || [];
    if (filterCountry !== "all") {
      filtered = filtered.filter(f => f.countryId === filterCountry);
    }
    return filtered.sort((a, b) => {
      const ca = countries?.find(c => c.id === a.countryId)?.name || "";
      const cb = countries?.find(c => c.id === b.countryId)?.name || "";
      return ca.localeCompare(cb);
    });
  }, [fees, filterCountry, countries]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, margin, active }: { id: string; margin: string; active: boolean }) => {
      const swychrFee = parseFloat((editingFee as any)?.swychrFee || "0");
      const newMargin = parseFloat(margin);
      const newTotal = (swychrFee + newMargin).toFixed(4);
      return apiRequest("PATCH", `/api/admin/fees/${id}`, {
        ashtechMargin: margin,
        feeValue: newTotal,
        isActive: active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Marge mise à jour avec succès" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setShowModal(false);
    setEditingFee(null);
    setAshtechMargin("");
    setIsActive(true);
  };

  const openEdit = (fee: Fee) => {
    setEditingFee(fee);
    setAshtechMargin((fee as any).ashtechMargin || "2");
    setIsActive(fee.isActive ?? true);
    setShowModal(true);
  };

  const getCountryName = (id: string | null) => {
    if (!id) return "Global";
    const c = countries?.find(c => c.id === id);
    return c ? `${c.flag || ""} ${c.name}`.trim() : "Inconnu";
  };

  const getCountryCode = (id: string | null) => {
    if (!id) return "";
    return countries?.find(c => c.id === id)?.code || "";
  };

  const computedTotal = () => {
    if (!editingFee) return "0";
    const s = parseFloat((editingFee as any).swychrFee || "0");
    const m = parseFloat(ashtechMargin || "0");
    return (s + m).toFixed(2);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Send className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Frais d'Envoi</h1>
              <p className="text-muted-foreground">Frais Swychr + marge Ashtech Pay par pays</p>
            </div>
          </div>
        </div>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2 text-sm text-blue-400">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">Structure des frais Swychr :</span> Frais Swychr (fixé par Swychr, non modifiable) + Marge Ashtech (modifiable) = Total facturé au client.
                Seule la <span className="font-semibold">marge Ashtech</span> peut être modifiée par l'admin.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filtrer par pays:</span>
              </div>
              <Select value={filterCountry} onValueChange={setFilterCountry}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tous les pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les pays</SelectItem>
                  {countries?.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.flag} {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground ml-auto">
                {transferFees.length} pays configuré{transferFees.length > 1 ? "s" : ""}
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pays</TableHead>
                  <TableHead>Frais Swychr</TableHead>
                  <TableHead>Marge Ashtech</TableHead>
                  <TableHead className="font-bold">Total client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Chargement...</TableCell>
                  </TableRow>
                ) : !transferFees.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucun frais d'envoi configuré
                    </TableCell>
                  </TableRow>
                ) : (
                  transferFees.map((fee) => {
                    const swychr = parseFloat((fee as any).swychrFee || "0");
                    const margin = parseFloat((fee as any).ashtechMargin || "0");
                    const total = parseFloat(fee.feeValue);
                    const cc = getCountryCode(fee.countryId);
                    return (
                      <TableRow key={fee.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{getCountryName(fee.countryId)}</span>
                            {cc && <Badge variant="outline" className="text-xs">{cc}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">{swychr.toFixed(2)}%</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-orange-400 font-medium">{margin.toFixed(2)}%</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-green-400">{total.toFixed(2)}%</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={fee.isActive ? "default" : "secondary"}>
                            {fee.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(fee)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showModal} onOpenChange={() => resetForm()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier la marge — {editingFee ? getCountryName(editingFee.countryId) : ""}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Frais Swychr (non modifiable)</Label>
                <Input
                  value={`${parseFloat((editingFee as any)?.swychrFee || "0").toFixed(2)}%`}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Fixé par Swychr — contact Swychr pour changer</p>
              </div>

              <div className="space-y-2">
                <Label>Marge Ashtech Pay (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={ashtechMargin}
                  onChange={(e) => setAshtechMargin(e.target.value)}
                  placeholder="2.00"
                />
                <p className="text-xs text-muted-foreground">Revenu Ashtech Pay sur chaque transfert</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Total facturé au client</Label>
                <Input
                  value={`${computedTotal()}%`}
                  disabled
                  className="bg-muted font-bold"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label>Actif</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Annuler</Button>
              <Button
                onClick={() => editingFee && updateMutation.mutate({ id: editingFee.id, margin: ashtechMargin, active: isActive })}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
