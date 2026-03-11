import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "../layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Pencil, ArrowDownCircle, Info, ChevronDown, ChevronRight, Zap, Globe } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Fee, Country, Operator } from "@shared/schema";

interface EditState {
  fee: Fee;
  operator: Operator;
  country: Country;
}

export default function AdminFeesDeposits() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [openCountries, setOpenCountries] = useState<Set<string>>(new Set());

  // Form fields
  const [afribapayFee, setAfribapayFee] = useState("");
  const [ashtechMargin, setAshtechMargin] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: fees, isLoading: feesLoading } = useQuery<Fee[]>({ queryKey: ["/api/admin/fees"] });
  const { data: countries } = useQuery<Country[]>({ queryKey: ["/api/admin/countries"] });
  const { data: operators } = useQuery<Operator[]>({ queryKey: ["/api/admin/operators"] });

  // Active operators grouped by country — only active operators
  const grouped = useMemo(() => {
    if (!countries || !operators || !fees) return [];
    return countries
      .map(country => {
        const activeOps = operators.filter(
          (op: any) => op.countryId === country.id && op.isActive
        );
        if (!activeOps.length) return null;
        return { country, ops: activeOps };
      })
      .filter(Boolean) as { country: Country; ops: Operator[] }[];
  }, [countries, operators, fees]);

  // Find the fee record for an operator (operator-specific first, then country-level)
  const findFee = (op: Operator): Fee | undefined => {
    if (!fees) return undefined;
    const depositFees = fees.filter(f => f.transactionType === "deposit");
    return (
      depositFees.find(f => f.operatorId === op.id) ||
      depositFees.find(f => f.countryId === (op as any).countryId && !f.operatorId)
    );
  };

  const toggleCountry = (id: string) => {
    setOpenCountries(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openEdit = (op: Operator, country: Country) => {
    const fee = findFee(op);
    if (!fee) {
      toast({ title: "Aucun frais trouvé pour ce pays", variant: "destructive" });
      return;
    }
    setEditing({ fee, operator: op, country });
    setAfribapayFee((fee as any).afribapayFee ?? "3.00");
    setAshtechMargin((fee as any).ashtechMargin ?? "2.00");
    setIsActive(fee.isActive ?? true);
  };

  const closeEdit = () => {
    setEditing(null);
    setAfribapayFee("");
    setAshtechMargin("");
    setIsActive(true);
  };

  // Swychr: update ashtechMargin only (swychrFee is fixed)
  const swychrMutation = useMutation({
    mutationFn: async ({ id, margin, active }: { id: string; margin: string; active: boolean }) => {
      const swychrFee = parseFloat((editing?.fee as any)?.swychrFee || "0");
      const total = (swychrFee + parseFloat(margin || "0")).toFixed(4);
      return apiRequest("PATCH", `/api/admin/fees/${id}`, {
        ashtechMargin: margin,
        feeValue: total,
        isActive: active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Frais mis à jour" });
      closeEdit();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  // AfribaPay: update afribapayFee + ashtechMargin
  const afribaMutation = useMutation({
    mutationFn: async ({ id, afribaFee, margin, active }: { id: string; afribaFee: string; margin: string; active: boolean }) =>
      apiRequest("PATCH", `/api/admin/fees/${id}/afribapay`, {
        afribapayFee: afribaFee,
        ashtechMargin: margin,
        isActive: active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Frais AfribaPay mis à jour" });
      closeEdit();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const handleSave = () => {
    if (!editing) return;
    const provider = (editing.operator as any).paymentProvider || "swychr";
    if (provider === "afribapay") {
      afribaMutation.mutate({ id: editing.fee.id, afribaFee: afribapayFee, margin: ashtechMargin, active: isActive });
    } else {
      swychrMutation.mutate({ id: editing.fee.id, margin: ashtechMargin, active: isActive });
    }
  };

  const isPending = swychrMutation.isPending || afribaMutation.isPending;

  const computeTotal = (): string => {
    if (!editing) return "0";
    const provider = (editing.operator as any).paymentProvider || "swychr";
    const provFee = provider === "afribapay"
      ? parseFloat(afribapayFee || "0")
      : parseFloat((editing.fee as any)?.swychrFee || "0");
    const margin = parseFloat(ashtechMargin || "0");
    return (provFee + margin).toFixed(2);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <ArrowDownCircle className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Frais de Dépôt &amp; Lien de Paiement</h1>
            <p className="text-muted-foreground">Par pays et opérateur actif — le frais de dépôt s'applique aussi aux liens de paiement</p>
          </div>
        </div>

        {/* Info banner */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2 text-sm text-blue-400">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">Structure des frais :</span> Frais fournisseur (AfribaPay modifiable / Swychr fixe) + Marge Ashtech = Total facturé au client.
                Seuls les opérateurs <span className="font-semibold">actifs</span> sont affichés.
                Le frais de dépôt s'applique identiquement aux <span className="font-semibold">liens de paiement</span>.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Countries accordion */}
        {feesLoading ? (
          <div className="text-center py-12 text-muted-foreground">Chargement...</div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Aucun pays avec des opérateurs actifs</div>
        ) : (
          <div className="space-y-2">
            {grouped.map(({ country, ops }) => {
              const isOpen = openCountries.has(country.id);
              const afribOps = ops.filter(op => (op as any).paymentProvider === "afribapay");
              const swychrOps = ops.filter(op => (op as any).paymentProvider !== "afribapay");
              return (
                <Collapsible key={country.id} open={isOpen} onOpenChange={() => toggleCountry(country.id)}>
                  <CollapsibleTrigger asChild>
                    <button
                      className="w-full flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted/40 transition-colors"
                      data-testid={`country-fees-${country.code}`}
                    >
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{country.flag} {country.name}</span>
                        <Badge variant="outline" className="text-xs">{country.code}</Badge>
                        {afribOps.length > 0 && (
                          <Badge className="text-xs bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                            <Zap className="w-3 h-3 mr-1" />
                            {afribOps.length} AfribaPay
                          </Badge>
                        )}
                        {swychrOps.length > 0 && (
                          <Badge className="text-xs bg-blue-500/20 text-blue-600 border-blue-500/30">
                            {swychrOps.length} Swychr
                          </Badge>
                        )}
                      </div>
                      {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border border-t-0 rounded-b-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 border-b">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Opérateur</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Fournisseur</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Frais fournisseur</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Marge Ashtech</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Total client</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Modifier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ops.map(op => {
                            const fee = findFee(op);
                            const provider = (op as any).paymentProvider || "swychr";
                            const isAfribaPay = provider === "afribapay";
                            const provFee = isAfribaPay
                              ? parseFloat((fee as any)?.afribapayFee || "0")
                              : parseFloat((fee as any)?.swychrFee || "0");
                            const margin = parseFloat((fee as any)?.ashtechMargin || "0");
                            const total = provFee + margin;
                            return (
                              <tr key={op.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`op-fee-${op.id}`}>
                                <td className="px-4 py-3 font-medium">{op.name}</td>
                                <td className="px-4 py-3">
                                  {isAfribaPay ? (
                                    <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-xs">
                                      <Zap className="w-3 h-3 mr-1" />AfribaPay
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-xs">Swychr</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {fee ? `${provFee.toFixed(2)}%` : <span className="text-destructive text-xs">Non configuré</span>}
                                  {isAfribaPay && fee && <span className="text-xs text-muted-foreground ml-1">(modifiable)</span>}
                                  {!isAfribaPay && fee && <span className="text-xs text-muted-foreground ml-1">(fixe)</span>}
                                </td>
                                <td className="px-4 py-3 text-orange-400 font-medium">
                                  {fee ? `${margin.toFixed(2)}%` : "—"}
                                </td>
                                <td className="px-4 py-3 font-bold text-green-400">
                                  {fee ? `${total.toFixed(2)}%` : "—"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => openEdit(op, country)}
                                    disabled={!fee}
                                    data-testid={`btn-edit-fee-${op.id}`}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Modifier les frais — {editing?.operator.name} ({editing?.country.flag} {editing?.country.name})
              </DialogTitle>
            </DialogHeader>
            {editing && (() => {
              const isAfribaPay = (editing.operator as any).paymentProvider === "afribapay";
              return (
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40">
                    {isAfribaPay ? (
                      <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                        <Zap className="w-3 h-3 mr-1" />AfribaPay
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">Swychr</Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {isAfribaPay ? "Les frais AfribaPay sont modifiables" : "Les frais Swychr sont fixés par Swychr"}
                    </span>
                  </div>

                  {isAfribaPay ? (
                    <div className="space-y-2">
                      <Label>Frais AfribaPay (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="20"
                        value={afribapayFee}
                        onChange={(e) => setAfribapayFee(e.target.value)}
                        placeholder="3.00"
                        data-testid="input-afribapay-fee"
                      />
                      <p className="text-xs text-muted-foreground">Frais prélevés par AfribaPay sur la transaction</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Frais Swychr (non modifiable)</Label>
                      <Input
                        value={`${parseFloat((editing.fee as any)?.swychrFee || "0").toFixed(2)}%`}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">Fixé par Swychr — contactez Swychr pour modifier</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Marge Ashtech Pay (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="20"
                      value={ashtechMargin}
                      onChange={(e) => setAshtechMargin(e.target.value)}
                      placeholder="2.00"
                      data-testid="input-ashtech-margin"
                    />
                    <p className="text-xs text-muted-foreground">Revenu Ashtech Pay sur chaque transaction</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Total facturé au client</Label>
                    <Input
                      value={`${computeTotal()}%`}
                      disabled
                      className="bg-muted font-bold text-green-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-fee-active" />
                    <Label>Actif</Label>
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={closeEdit}>Annuler</Button>
              <Button onClick={handleSave} disabled={isPending} data-testid="button-save-fee">
                {isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
