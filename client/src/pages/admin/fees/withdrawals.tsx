import { useState, useMemo, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, ArrowUpCircle, Info, ChevronDown, ChevronRight, Zap, Globe, Copy, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Fee, Country, Operator } from "@shared/schema";

interface EditState {
  fee: Fee | null;
  operator: Operator;
  country: Country;
  needsCreate: boolean;
}

const guessAfribaCode = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes("orange")) return "orange";
  if (n.includes("mtn")) return "mtn";
  if (n.includes("wave")) return "wave";
  if (n.includes("moov") || n.includes("flooz")) return "moov";
  if (n.includes("ligdi")) return "ligdicash";
  if (n.includes("t-money") || n.includes("tmoney")) return "tmoney";
  if (n.includes("airtel")) return "airtel";
  if (n.includes("free money") || n.includes("free")) return "free";
  if (n.includes("afrimoney")) return "afrimoney";
  if (n.includes("m-pesa") || n.includes("mpesa")) return "mpesa";
  return "";
};

export default function AdminFeesWithdrawals() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [openCountries, setOpenCountries] = useState<Set<string>>(new Set());

  const [afribapayFee, setAfribapayFee] = useState("");
  const [pixpayFee, setPixpayFee] = useState("");
  const [ashtechMargin, setAshtechMargin] = useState("");
  const [minFee, setMinFee] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [localProvider, setLocalProvider] = useState("swychr");
  const [localAfribapayCode, setLocalAfribapayCode] = useState("");

  const sticky = useRef<{ afribapayFee: string; pixpayFee: string; swychrMargin: string; afribaMargin: string; pixpayMargin: string }>({
    afribapayFee: "3.00", pixpayFee: "3.00", swychrMargin: "2.00", afribaMargin: "2.00", pixpayMargin: "2.00",
  });

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
    const needsCreate = !fee || (fee as any).operatorId !== op.id;
    const provider = (op as any).paymentProvider || "swychr";
    setEditing({ fee: fee ?? null, operator: op, country, needsCreate });
    if (!needsCreate && fee) {
      const aFee = (fee as any)?.afribapayFee ?? sticky.current.afribapayFee;
      const pFee = (fee as any)?.pixpayFee ?? sticky.current.pixpayFee;
      const margin = (fee as any)?.ashtechMargin ?? sticky.current.swychrMargin;
      setAfribapayFee(aFee); sticky.current.afribapayFee = aFee;
      setPixpayFee(pFee); sticky.current.pixpayFee = pFee;
      setAshtechMargin(margin);
      if (provider === "afribapay") sticky.current.afribaMargin = margin;
      else if (provider === "pixpay") sticky.current.pixpayMargin = margin;
      else sticky.current.swychrMargin = margin;
    } else {
      setAfribapayFee(sticky.current.afribapayFee);
      setPixpayFee(sticky.current.pixpayFee);
      const margin = provider === "afribapay" ? sticky.current.afribaMargin
        : provider === "pixpay" ? sticky.current.pixpayMargin
        : sticky.current.swychrMargin;
      setAshtechMargin(margin);
    }
    setMinFee(fee?.minFee?.toString() || "");
    setIsActive(fee?.isActive ?? true);
    setLocalProvider(provider);
    setLocalAfribapayCode((op as any).afribapayOperatorCode || guessAfribaCode(op.name));
  };

  const closeEdit = () => {
    setEditing(null);
    setAfribapayFee("");
    setPixpayFee("");
    setAshtechMargin("");
    setMinFee("");
    setIsActive(true);
    setLocalProvider("swychr");
    setLocalAfribapayCode("");
  };

  const createFeeMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      apiRequest("POST", "/api/admin/fees", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Frais créés pour cet opérateur" });
      closeEdit();
    },
    onError: (err: any) => toast({ title: "Erreur création", description: err?.message || "Erreur serveur", variant: "destructive" }),
  });

  const providerMutation = useMutation({
    mutationFn: async ({ opId, provider, code }: { opId: string; provider: string; code: string }) =>
      apiRequest("PATCH", `/api/admin/operators/${opId}/provider`, {
        paymentProvider: provider,
        afribapayOperatorCode: code || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
    },
    onError: (err: any) => toast({ title: "Erreur fournisseur", description: err?.message || "Erreur serveur", variant: "destructive" }),
  });

  const pixpayMutation = useMutation({
    mutationFn: async ({ id, pxFee, margin, active, min }: { id: string; pxFee: string; margin: string; active: boolean; min: string }) =>
      apiRequest("PATCH", `/api/admin/fees/${id}/pixpay`, {
        pixpayFee: pxFee,
        ashtechMargin: margin,
        isActive: active,
        minFee: min,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Frais PixPay mis à jour" });
      closeEdit();
    },
    onError: (err: any) => toast({ title: "Erreur PixPay", description: err?.message || "Erreur serveur", variant: "destructive" }),
  });

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

  const handleSave = async () => {
    if (!editing) return;
    const originalProvider = (editing.operator as any).paymentProvider || "swychr";
    const providerChanged = localProvider !== originalProvider ||
      localAfribapayCode !== ((editing.operator as any).afribapayOperatorCode || "");
    if (providerChanged) {
      await providerMutation.mutateAsync({
        opId: editing.operator.id,
        provider: localProvider,
        code: localAfribapayCode,
      });
    }
    if (editing.needsCreate) {
      const swychrFeeVal = parseFloat((editing.fee as any)?.swychrFee || "0");
      const afribaFeeVal = parseFloat(afribapayFee || "0");
      const pixpayFeeVal = parseFloat(pixpayFee || "0");
      const marginVal = parseFloat(ashtechMargin || "0");
      const totalFee = localProvider === "afribapay"
        ? afribaFeeVal + marginVal
        : localProvider === "pixpay"
          ? pixpayFeeVal + marginVal
          : swychrFeeVal + marginVal;
      createFeeMutation.mutate({
        name: `Retrait - ${editing.operator.name}`,
        transactionType: "withdrawal",
        feeType: (editing.fee as any)?.feeType || "percentage",
        operatorId: editing.operator.id,
        countryId: editing.country.id,
        swychrFee: String(swychrFeeVal),
        afribapayFee: String(afribaFeeVal),
        pixpayFee: String(pixpayFeeVal),
        ashtechMargin: String(marginVal),
        feeValue: String(totalFee),
        minFee: minFee ? Number(minFee) : null,
        isActive,
      });
    } else if (localProvider === "pixpay") {
      pixpayMutation.mutate({ id: editing.fee!.id, pxFee: pixpayFee, margin: ashtechMargin, active: isActive, min: minFee });
    } else if (localProvider === "afribapay") {
      afribaMutation.mutate({ id: editing.fee!.id, afribaFee: afribapayFee, margin: ashtechMargin, active: isActive, min: minFee });
    } else {
      swychrMutation.mutate({ id: editing.fee!.id, margin: ashtechMargin, active: isActive, min: minFee });
    }
  };

  const isPending = swychrMutation.isPending || afribaMutation.isPending || pixpayMutation.isPending || providerMutation.isPending || createFeeMutation.isPending;

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/fees/sync-withdrawals-to-transfers", {});
      return res.json();
    },
    onSuccess: (data: { synced: number; created: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({
        title: "Synchronisation réussie",
        description: `${data.synced} frais mis à jour, ${data.created} créé(s) pour l'envoi`,
      });
    },
    onError: () => toast({ title: "Erreur de synchronisation", variant: "destructive" }),
  });

  const computeTotal = (): string => {
    if (!editing) return "0";
    const provFee = localProvider === "afribapay"
      ? parseFloat(afribapayFee || "0")
      : localProvider === "pixpay"
        ? parseFloat(pixpayFee || "0")
        : parseFloat((editing.fee as any)?.swychrFee || "0");
    return (provFee + parseFloat(ashtechMargin || "0")).toFixed(2);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <ArrowUpCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Frais de Retrait</h1>
              <p className="text-muted-foreground">Par pays et opérateur actif — frais + minimum de charge</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
            data-testid="button-sync-withdrawals-to-transfers"
          >
            {syncMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Copy className="w-4 h-4" />}
            Copier vers Envoi
          </Button>
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
              const pixpayOps = ops.filter(op => (op as any).paymentProvider === "pixpay");
              const swychrOps = ops.filter(op => !["afribapay", "pixpay"].includes((op as any).paymentProvider));
              const currency = getCurrency(country.id);
              return (
                <Collapsible key={country.id} open={isOpen} onOpenChange={() => toggleCountry(country.id)}>
                  <CollapsibleTrigger asChild>
                    <button
                      className="w-full flex items-start justify-between p-4 bg-card border rounded-lg hover:bg-muted/40 transition-colors"
                      data-testid={`country-fees-${country.code}`}
                    >
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                        <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-semibold">{country.flag} {country.name}</span>
                        <Badge variant="outline" className="text-xs">{country.code}</Badge>
                        <Badge variant="outline" className="text-xs text-muted-foreground">{currency}</Badge>
                        {afribOps.length > 0 && (
                          <Badge className="text-xs bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                            <Zap className="w-3 h-3 mr-1" />{afribOps.length} AfribaPay
                          </Badge>
                        )}
                        {pixpayOps.length > 0 && (
                          <Badge className="text-xs bg-indigo-500/20 text-indigo-600 border-indigo-500/30">
                            🔷 {pixpayOps.length} PixPay
                          </Badge>
                        )}
                        {swychrOps.length > 0 && (
                          <Badge className="text-xs bg-blue-500/20 text-blue-600 border-blue-500/30">
                            {swychrOps.length} Swychr
                          </Badge>
                        )}
                      </div>
                      <div className="flex-shrink-0 mt-0.5 ml-2">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border border-t-0 rounded-b-lg divide-y">
                      {ops.map(op => {
                        const fee = findFee(op, country);
                        const isShared = fee && (fee as any).operatorId !== op.id;
                        const provider = (op as any).paymentProvider || "swychr";
                        const isAfribaPay = provider === "afribapay";
                        const isPixPay = provider === "pixpay";
                        const provFee = isAfribaPay
                          ? parseFloat((fee as any)?.afribapayFee || "0")
                          : isPixPay
                            ? parseFloat((fee as any)?.pixpayFee || "0")
                            : parseFloat((fee as any)?.swychrFee || "0");
                        const margin = parseFloat((fee as any)?.ashtechMargin || "0");
                        const total = provFee + margin;
                        return (
                          <button
                            key={op.id}
                            className="w-full text-left px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                            onClick={() => openEdit(op, country)}
                            data-testid={`op-fee-${op.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{op.name}</span>
                                {isAfribaPay ? (
                                  <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-xs shrink-0">
                                    <Zap className="w-3 h-3 mr-1" />AfribaPay
                                  </Badge>
                                ) : isPixPay ? (
                                  <Badge className="bg-indigo-500/20 text-indigo-600 border-indigo-500/30 text-xs shrink-0">🔷 PixPay</Badge>
                                ) : (
                                  <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-xs shrink-0">Swychr</Badge>
                                )}
                                {isShared && (
                                  <Badge variant="outline" className="text-xs text-orange-500 border-orange-400/50 shrink-0">Frais pays</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                {fee ? (
                                  <>
                                    <span>Frais : <span className="text-foreground font-medium">{provFee.toFixed(2)}%</span></span>
                                    <span>+</span>
                                    <span>Marge : <span className="text-orange-400 font-medium">{margin.toFixed(2)}%</span></span>
                                    <span>=</span>
                                    <span>Total : <span className="text-green-400 font-bold">{total.toFixed(2)}%</span></span>
                                    {fee.minFee && <span className="text-muted-foreground">· Min {fee.minFee} {currency}</span>}
                                    {isShared && <span className="text-orange-400 italic">— partagé</span>}
                                  </>
                                ) : (
                                  <span className="text-orange-400 italic">Aucun frais — cliquer pour configurer</span>
                                )}
                              </div>
                            </div>
                            <Pencil className="w-4 h-4 text-muted-foreground shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
          <DialogContent className="flex flex-col max-h-[92vh]">
            <DialogHeader>
              <DialogTitle>
                {editing?.needsCreate ? "Configurer les frais" : "Modifier les frais"} retrait — {editing?.operator.name} ({editing?.country.flag} {editing?.country.name})
              </DialogTitle>
            </DialogHeader>
            {editing && (() => {
              const currency = getCurrency(editing.country.id);
              return (
                <div className="overflow-y-auto flex-1 space-y-4 py-4 pr-1">
                  {editing.needsCreate && (
                    <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-400/30 text-xs text-orange-500">
                      Un frais spécifique sera créé pour <strong>{editing.operator.name}</strong> uniquement. Les autres opérateurs ne seront pas affectés.
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Fournisseur de paiement</Label>
                    <Select value={localProvider} onValueChange={(v) => {
                      if (localProvider === "afribapay") sticky.current.afribaMargin = ashtechMargin;
                      else if (localProvider === "pixpay") sticky.current.pixpayMargin = ashtechMargin;
                      else sticky.current.swychrMargin = ashtechMargin;
                      setLocalProvider(v);
                      if (v === "afribapay") { setAshtechMargin(sticky.current.afribaMargin); if (!localAfribapayCode) setLocalAfribapayCode(guessAfribaCode(editing?.operator.name || "")); }
                      else if (v === "pixpay") setAshtechMargin(sticky.current.pixpayMargin);
                      else setAshtechMargin(sticky.current.swychrMargin);
                    }} data-testid="select-provider">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="swychr">Swychr</SelectItem>
                        <SelectItem value="afribapay">⚡ AfribaPay</SelectItem>
                        <SelectItem value="pixpay">🔷 PixPay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {localProvider === "afribapay" && (
                    <div className="space-y-2">
                      <Label>Code opérateur AfribaPay</Label>
                      <Input
                        placeholder="ex: orange-ci, mtn-cm, wave-sn..."
                        value={localAfribapayCode}
                        onChange={(e) => setLocalAfribapayCode(e.target.value)}
                        data-testid="input-afribapay-code"
                      />
                    </div>
                  )}

                  {localProvider === "pixpay" && (
                    <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded p-2">
                      Service ID et type de flux configurés dans la page PixPay. Seul le taux de frais est modifiable ici.
                    </p>
                  )}

                  {localProvider === "afribapay" ? (
                    <div className="space-y-2">
                      <Label>Frais AfribaPay (%)</Label>
                      <Input
                        type="number" step="0.01" min="0" max="20"
                        value={afribapayFee}
                        onChange={(e) => { setAfribapayFee(e.target.value); sticky.current.afribapayFee = e.target.value; }}
                        placeholder="3.00"
                        data-testid="input-afribapay-fee"
                      />
                    </div>
                  ) : localProvider === "pixpay" ? (
                    <div className="space-y-2">
                      <Label>Frais PixPay (%)</Label>
                      <Input
                        type="number" step="0.01" min="0" max="20"
                        value={pixpayFee}
                        onChange={(e) => { setPixpayFee(e.target.value); sticky.current.pixpayFee = e.target.value; }}
                        placeholder="3.00"
                        data-testid="input-pixpay-fee"
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
                      onChange={(e) => {
                        setAshtechMargin(e.target.value);
                        if (localProvider === "afribapay") sticky.current.afribaMargin = e.target.value;
                        else if (localProvider === "pixpay") sticky.current.pixpayMargin = e.target.value;
                        else sticky.current.swychrMargin = e.target.value;
                      }}
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

                  <div className="p-3 rounded-lg bg-muted/40 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total facturé au client</span>
                    <span className="text-lg font-bold text-green-500">{computeTotal()}%</span>
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
