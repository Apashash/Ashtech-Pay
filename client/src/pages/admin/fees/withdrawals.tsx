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
import { Pencil, ArrowUpCircle, Info, ChevronDown, ChevronRight, Zap, Globe } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Fee, Country, Operator } from "@shared/schema";

interface EditState {
  fee: Fee;
  operator: Operator;
  country: Country;
}

export default function AdminFeesWithdrawals() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [openCountries, setOpenCountries] = useState<Set<string>>(new Set());

  const [afribapayFee, setAfribapayFee] = useState("");
  const [ashtechMargin, setAshtechMargin] = useState("");
  const [minFee, setMinFee] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: fees, isLoading: feesLoading } = useQuery<Fee[]>({ queryKey: ["/api/admin/fees"] });
  const { data: countries } = useQuery<Country[]>({ queryKey: ["/api/admin/countries"] });
  const { data: operators } = useQuery<Operator[]>({ queryKey: ["/api/admin/operators"] });

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

  const findFee = (op: Operator, country: Country): Fee | undefined => {
    if (!fees) return undefined;
    const wFees = fees.filter(f => f.transactionType === "withdrawal");
    return (
      wFees.find(f => f.operatorId === op.id) ||
      wFees.find(f => f.countryId === op.countryId && !f.operatorId) ||
      wFees.find(f => f.countryId === country.id && !f.operatorId)
    );
  };

  const getCurrency = (countryId: string | null) => {
    if (!countryId) return "XAF";
    return countries?.find(c => c.id === countryId)?.currency || "XAF";
  };

  const toggleCountry = (id: string) => {
    setOpenCountries(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openEdit = (op: Operator, country: Country) => {
    const fee = findFee(op, country);
    if (!fee) {
      toast({ title: "Aucun frais trouvé pour ce pays", variant: "destructive" });
      return;
    }
    setEditing({ fee, operator: op, country });
    setAfribapayFee((fee as any).afribapayFee ?? "3.00");
    setAshtechMargin((fee as any).ashtechMargin ?? "2.00");
    setMinFee(fee.minFee?.toString() || "");
    setIsActive(fee.isActive ?? true);
  };

  const closeEdit = () => {
    setEditing(null);
    setAfribapayFee("");
    setAshtechMargin("");
    setMinFee("");
    setIsActive(true);
  };

  const swychrMutation = useMutation({
    mutationFn: async ({ id, margin, active, min }: { id: string; margin: string; active: boolean; min: string }) => {
      const swychrFee = parseFloat((editing?.fee as any)?.swychrFee || "0");
      const total = (swychrFee + parseFloat(margin || "0")).toFixed(4);
      return apiRequest("PATCH", `/api/admin/fees/${id}`, {
        ashtechMargin: margin,
        feeValue: total,
        isActive: active,
        minFee: min,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Frais mis à jour" });
      closeEdit();
    },
    onError: (err: any) => toast({ title: "Erreur lors de la mise à jour", description: err?.message || "Erreur serveur", variant: "destructive" }),
  });

  const afribaMutation = useMutation({
    mutationFn: async ({ id, afribaFee, margin, active, min }: { id: string; afribaFee: string; margin: string; active: boolean; min: string }) =>
      apiRequest("PATCH", `/api/admin/fees/${id}/afribapay`, {
        afribapayFee: afribaFee,
        ashtechMargin: margin,
        isActive: active,
        minFee: min,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Frais AfribaPay mis à jour" });
      closeEdit();
    },
    onError: (err: any) => toast({ title: "Erreur AfribaPay", description: err?.message || "Erreur serveur", variant: "destructive" }),
  });

  const handleSave = () => {
    if (!editing) return;
    const provider = (editing.operator as any).paymentProvider || "swychr";
    if (provider === "afribapay") {
      afribaMutation.mutate({ id: editing.fee.id, afribaFee: afribapayFee, margin: ashtechMargin, active: isActive, min: minFee });
    } else {
      swychrMutation.mutate({ id: editing.fee.id, margin: ashtechMargin, active: isActive, min: minFee });
    }
  };

  const isPending = swychrMutation.isPending || afribaMutation.isPending;

  const computeTotal = (): string => {
    if (!editing) return "0";
    const provider = (editing.operator as any).paymentProvider || "swychr";
    const provFee = provider === "afribapay"
      ? parseFloat(afribapayFee || "0")
      : parseFloat((editing.fee as any)?.swychrFee || "0");
    return (provFee + parseFloat(ashtechMargin || "0")).toFixed(2);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg">
            <ArrowUpCircle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Frais de Retrait</h1>
            <p className="text-muted-foreground">Par pays et opérateur actif — frais + minimum de charge</p>
          </div>
        </div>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2 text-sm text-blue-400">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">Note :</span> Seuls les opérateurs <span className="font-semibold">actifs</span> sont affichés.
                Pour les opérateurs AfribaPay, le frais est modifiable. Pour Swychr, seule la marge Ashtech est modifiable.
                Le minimum de charge est le montant minimum prélevé si le % est inférieur.
              </div>
            </div>
          </CardContent>
        </Card>

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
              const currency = getCurrency(country.id);
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
                        <Badge variant="outline" className="text-xs text-muted-foreground">{currency}</Badge>
                        {afribOps.length > 0 && (
                          <Badge className="text-xs bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                            <Zap className="w-3 h-3 mr-1" />{afribOps.length} AfribaPay
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
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Min charge ({currency})</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Modifier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ops.map(op => {
                            const fee = findFee(op, country);
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
                                </td>
                                <td className="px-4 py-3 text-orange-400 font-medium">
                                  {fee ? `${margin.toFixed(2)}%` : "—"}
                                </td>
                                <td className="px-4 py-3 font-bold text-green-400">
                                  {fee ? `${total.toFixed(2)}%` : "—"}
                                </td>
                                <td className="px-4 py-3 font-mono text-muted-foreground">
                                  {fee?.minFee ? `${fee.minFee} ${currency}` : "—"}
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
                Frais retrait — {editing?.operator.name} ({editing?.country.flag} {editing?.country.name})
              </DialogTitle>
            </DialogHeader>
            {editing && (() => {
              const isAfribaPay = (editing.operator as any).paymentProvider === "afribapay";
              const currency = getCurrency(editing.country.id);
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
                      {isAfribaPay ? "Frais AfribaPay modifiables" : "Frais Swychr fixés par Swychr"}
                    </span>
                  </div>

                  {isAfribaPay ? (
                    <div className="space-y-2">
                      <Label>Frais AfribaPay (%)</Label>
                      <Input
                        type="number" step="0.01" min="0" max="20"
                        value={afribapayFee}
                        onChange={(e) => setAfribapayFee(e.target.value)}
                        placeholder="3.00"
                        data-testid="input-afribapay-fee"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Frais Swychr (non modifiable)</Label>
                      <Input
                        value={`${parseFloat((editing.fee as any)?.swychrFee || "0").toFixed(2)}%`}
                        disabled className="bg-muted"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Marge Ashtech Pay (%)</Label>
                    <Input
                      type="number" step="0.01" min="0" max="20"
                      value={ashtechMargin}
                      onChange={(e) => setAshtechMargin(e.target.value)}
                      placeholder="2.00"
                      data-testid="input-ashtech-margin"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Minimum de charge ({currency})</Label>
                    <Input
                      type="number" step="1" min="0"
                      value={minFee}
                      onChange={(e) => setMinFee(e.target.value)}
                      placeholder="550"
                      data-testid="input-min-fee"
                    />
                    <p className="text-xs text-muted-foreground">Montant minimum prélevé si le % calcul est inférieur</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Total facturé au client</Label>
                    <Input value={`${computeTotal()}%`} disabled className="bg-muted font-bold text-green-500" />
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
