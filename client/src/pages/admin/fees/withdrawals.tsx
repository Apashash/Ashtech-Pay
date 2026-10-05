import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "../layout";
import { AdminSectionTabs } from "@/components/admin/AdminSectionTabs";
import { getAdminPath } from "@/lib/adminPath";
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
import { Pencil, ArrowUpCircle, Send, Info, ChevronDown, ChevronRight, Zap, Globe, Copy, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isProviderAvailable } from "@/lib/providerCountries";
import { ProviderCountryCoverage } from "@/components/admin/ProviderCountryCoverage";
import { guessPawaPayProviderCode } from "@/lib/pawapayProviderCode";
import type { Fee, Country, Operator } from "@shared/schema";
import { getOperatorDisplayName } from "@/lib/operator-logos";

const A = getAdminPath();

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
  if (n.includes("mixx") || n.includes("t-money") || n.includes("tmoney")) return "tmoney";
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
  const [pawapayFee, setPawapayFee] = useState("");
  const [ashtechMargin, setAshtechMargin] = useState("");
  const [minFee, setMinFee] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [localProvider, setLocalProvider] = useState<"afribapay" | "pixpay" | "pawapay">("afribapay");
  const [localAfribapayCode, setLocalAfribapayCode] = useState("");
  const [localPawapayCode, setLocalPawapayCode] = useState("");

  const sticky = useRef<{ afribapayFee: string; pixpayFee: string; pawapayFee: string; afribaMargin: string; pixpayMargin: string; pawapayMargin: string }>({
    afribapayFee: "3.00", pixpayFee: "3.00", pawapayFee: "3.00", afribaMargin: "2.00", pixpayMargin: "2.00", pawapayMargin: "2.00",
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
    const provider = ((op as any).paymentProvider || "afribapay") as "afribapay" | "pixpay" | "pawapay";
    setEditing({ fee: fee ?? null, operator: op, country, needsCreate });
    if (!needsCreate && fee) {
      const aFee = (fee as any)?.afribapayFee ?? sticky.current.afribapayFee;
      const pFee = (fee as any)?.pixpayFee ?? sticky.current.pixpayFee;
      const pawaFee = (fee as any)?.pawapayFee ?? sticky.current.pawapayFee;
      const margin = (fee as any)?.ashtechMargin ?? (provider === "pixpay" ? sticky.current.pixpayMargin : provider === "pawapay" ? sticky.current.pawapayMargin : sticky.current.afribaMargin);
      setAfribapayFee(aFee); sticky.current.afribapayFee = aFee;
      setPixpayFee(pFee); sticky.current.pixpayFee = pFee;
      setPawapayFee(pawaFee); sticky.current.pawapayFee = pawaFee;
      setAshtechMargin(margin);
      if (provider === "afribapay") sticky.current.afribaMargin = margin;
      else if (provider === "pixpay") sticky.current.pixpayMargin = margin;
      else if (provider === "pawapay") sticky.current.pawapayMargin = margin;
    } else {
      setAfribapayFee(sticky.current.afribapayFee);
      setPixpayFee(sticky.current.pixpayFee);
      setPawapayFee(sticky.current.pawapayFee);
      const margin = provider === "afribapay" ? sticky.current.afribaMargin
        : provider === "pixpay" ? sticky.current.pixpayMargin : provider === "pawapay" ? sticky.current.pawapayMargin
        : sticky.current.afribaMargin;
      setAshtechMargin(margin);
    }
    setMinFee(fee?.minFee?.toString() || "");
    setIsActive(fee?.isActive ?? true);
    setLocalProvider(provider);
    setLocalAfribapayCode((op as any).afribapayOperatorCode || guessAfribaCode(op.name));
    setLocalPawapayCode((op as any).pawapayProviderCode || guessPawaPayProviderCode(op.name, country.code));
  };

  const closeEdit = () => {
    setEditing(null);
    setAfribapayFee("");
    setPixpayFee("");
    setPawapayFee("");
    setAshtechMargin("");
    setMinFee("");
    setIsActive(true);
    setLocalProvider("afribapay");
    setLocalAfribapayCode("");
    setLocalPawapayCode("");
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
    mutationFn: async ({ opId, provider, afribaCode, pawapayCode }: { opId: string; provider: string; afribaCode: string; pawapayCode: string }) =>
      apiRequest("PATCH", `/api/admin/operators/${opId}/provider`, {
        paymentProvider: provider,
        afribapayOperatorCode: afribaCode || null,
        pawapayProviderCode: pawapayCode || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
    },
    onError: (err: any) => toast({ title: "Erreur fournisseur", description: err?.message || "Erreur serveur", variant: "destructive" }),
  });

  const operatorToggleMutation = useMutation({
    mutationFn: async ({ operatorId, isActive }: { operatorId: string; isActive: boolean }) =>
      apiRequest("PATCH", "/api/admin/fees/operator-toggle", {
        operatorId,
        transactionType: "withdrawal",
        isActive,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: variables.isActive ? "Opérateur retrait activé" : "Opérateur retrait désactivé" });
    },
    onError: (err: any) => toast({ title: "Erreur d'activation", description: err?.message || "Erreur serveur", variant: "destructive" }),
  });

  const pawapayMutation = useMutation({
    mutationFn: async ({ id, pawaFee, margin, active, min }: { id: string; pawaFee: string; margin: string; active: boolean; min: string }) =>
      apiRequest("PATCH", `/api/admin/fees/${id}/pawapay`, { pawapayFee: pawaFee, ashtechMargin: margin, isActive: active, minFee: min }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      toast({ title: "Frais PawaPay mis à jour" });
      closeEdit();
    },
    onError: (err: any) => toast({ title: "Erreur PawaPay", description: err?.message || "Erreur serveur", variant: "destructive" }),
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

  const syncToTransferMutation = useMutation({
    mutationFn: async (operatorId: string) =>
      apiRequest("POST", "/api/admin/fees/sync-withdrawals-to-transfers", { operatorId }),
    onError: () => {},
  });

  const handleSave = async () => {
    if (!editing) return;
    const originalProvider = ((editing.operator as any).paymentProvider || "afribapay") as "afribapay" | "pixpay" | "pawapay";
    const providerChanged = localProvider !== originalProvider ||
      localAfribapayCode !== ((editing.operator as any).afribapayOperatorCode || "") ||
      localPawapayCode !== ((editing.operator as any).pawapayProviderCode || "");
    if (providerChanged) {
      await providerMutation.mutateAsync({
        opId: editing.operator.id,
        provider: localProvider,
        afribaCode: localAfribapayCode,
        pawapayCode: localPawapayCode,
      });
    }
    if (editing.needsCreate) {
      const afribaFeeVal = parseFloat(afribapayFee || "0");
      const pixpayFeeVal = parseFloat(pixpayFee || "0");
      const pawapayFeeVal = parseFloat(pawapayFee || "0");
      const marginVal = parseFloat(ashtechMargin || "0");
      const totalFee = localProvider === "afribapay"
        ? afribaFeeVal + marginVal
        : localProvider === "pixpay" ? pixpayFeeVal + marginVal : pawapayFeeVal + marginVal;
      await createFeeMutation.mutateAsync({
        name: `Retrait - ${getOperatorDisplayName(editing.operator.name)}`,
        transactionType: "withdrawal",
        feeType: (editing.fee as any)?.feeType || "percentage",
        operatorId: editing.operator.id,
        countryId: editing.country.id,
        afribapayFee: String(afribaFeeVal),
        pixpayFee: String(pixpayFeeVal),
        pawapayFee: String(pawapayFeeVal),
        ashtechMargin: String(marginVal),
        feeValue: String(totalFee),
        minFee: minFee ? Number(minFee) : null,
        isActive,
      });
    } else if (localProvider === "pixpay") {
      await pixpayMutation.mutateAsync({ id: editing.fee!.id, pxFee: pixpayFee, margin: ashtechMargin, active: isActive, min: minFee });
    } else if (localProvider === "afribapay") {
      await afribaMutation.mutateAsync({ id: editing.fee!.id, afribaFee: afribapayFee, margin: ashtechMargin, active: isActive, min: minFee });
    } else {
      await pawapayMutation.mutateAsync({ id: editing.fee!.id, pawaFee: pawapayFee, margin: ashtechMargin, active: isActive, min: minFee });
    }
    syncToTransferMutation.mutate(editing.operator.id);
  };

  const isPending = afribaMutation.isPending || pixpayMutation.isPending || pawapayMutation.isPending || providerMutation.isPending || createFeeMutation.isPending;

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
        : parseFloat(pawapayFee || "0");
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

        <AdminSectionTabs
          label="Configuration des frais de retrait et d’envoi"
          items={[
            { href: `${A}/fees/withdrawals`, label: "Retraits", icon: ArrowUpCircle },
            { href: `${A}/fees/transfers`, label: "Envois", icon: Send },
          ]}
        />

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2 text-sm text-blue-400">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">Note :</span> Seuls les opérateurs <span className="font-semibold">actifs</span> sont affichés.
                Les frais fournisseur et la marge Ashtech sont configurables séparément par fournisseur.
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
              const pawapayOps = ops.filter(op => (op as any).paymentProvider === "pawapay");
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
                        {pawapayOps.length > 0 && <Badge className="text-xs bg-teal-500/20 text-teal-600 border-teal-500/30">● {pawapayOps.length} PawaPay</Badge>}
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
                        const provider = ((op as any).paymentProvider || "afribapay") as "afribapay" | "pixpay" | "pawapay";
                        const isAfribaPay = provider === "afribapay";
                        const isPixPay = provider === "pixpay";
                        const isPawaPay = provider === "pawapay";
                        const provFee = isAfribaPay
                          ? parseFloat((fee as any)?.afribapayFee || "0")
                          : isPixPay
                            ? parseFloat((fee as any)?.pixpayFee || "0")
                            : isPawaPay ? parseFloat((fee as any)?.pawapayFee || "0") : parseFloat((fee as any)?.pixpayFee || "0");
                        const margin = parseFloat((fee as any)?.ashtechMargin || "0");
                        const total = provFee + margin;
                         const feeIsActive = fee?.isActive !== false;
                         return (
                           <div
                             key={op.id}
                             className="w-full px-4 py-3 hover:bg-muted/30 transition-colors flex items-center gap-3"
                           >
                             <button
                               type="button"
                               className="flex-1 min-w-0 text-left"
                               onClick={() => openEdit(op, country)}
                               data-testid={`op-fee-${op.id}`}
                             >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                 <span className="font-medium text-sm">{getOperatorDisplayName(op.name)}</span>
                                {isAfribaPay ? (
                                  <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-xs shrink-0">
                                    <Zap className="w-3 h-3 mr-1" />AfribaPay
                                  </Badge>
                                ) : isPixPay ? (
                                  <Badge className="bg-indigo-500/20 text-indigo-600 border-indigo-500/30 text-xs shrink-0">🔷 PixPay</Badge>
                                ) : isPawaPay ? (
                                  <Badge className="bg-teal-500/20 text-teal-600 border-teal-500/30 text-xs shrink-0">● PawaPay</Badge>
                                ) : null}
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
                             </button>
                             <div className="flex items-center gap-2 shrink-0">
                               <span className={`hidden sm:inline text-xs font-medium ${feeIsActive ? "text-green-500" : "text-muted-foreground"}`}>
                                 {feeIsActive ? "Actif" : "Désactivé"}
                               </span>
                               <Switch
                                 checked={feeIsActive}
                                 disabled={operatorToggleMutation.isPending}
                                 onCheckedChange={(checked) => operatorToggleMutation.mutate({ operatorId: op.id, isActive: checked })}
                                  aria-label={`${feeIsActive ? "Désactiver" : "Activer"} ${getOperatorDisplayName(op.name)} pour les retraits`}
                                 data-testid={`switch-operator-withdrawal-${op.id}`}
                               />
                               <button
                                 type="button"
                                 className="p-1 rounded-md hover:bg-muted"
                                 onClick={() => openEdit(op, country)}
                                  aria-label={`Modifier les frais de ${getOperatorDisplayName(op.name)}`}
                               >
                                 <Pencil className="w-4 h-4 text-muted-foreground" />
                               </button>
                             </div>
                           </div>
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
                 {editing?.needsCreate ? "Configurer les frais" : "Modifier les frais"} retrait — {getOperatorDisplayName(editing?.operator.name)} ({editing?.country.flag} {editing?.country.name})
              </DialogTitle>
            </DialogHeader>
            {editing && (() => {
              const currency = getCurrency(editing.country.id);
              return (
                <div className="overflow-y-auto flex-1 space-y-4 py-4 pr-1">
                  {editing.needsCreate && (
                    <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-400/30 text-xs text-orange-500">
                       Un frais spécifique sera créé pour <strong>{getOperatorDisplayName(editing.operator.name)}</strong> uniquement. Les autres opérateurs ne seront pas affectés.
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Fournisseur de paiement</Label>
                    <Select value={localProvider} onValueChange={(v) => {
                      if (localProvider === "afribapay") sticky.current.afribaMargin = ashtechMargin;
                      else if (localProvider === "pixpay") sticky.current.pixpayMargin = ashtechMargin;
                       else if (localProvider === "pawapay") sticky.current.pawapayMargin = ashtechMargin;
                       setLocalProvider(v as "afribapay" | "pixpay" | "pawapay");
                      if (v === "afribapay") { setAshtechMargin(sticky.current.afribaMargin); if (!localAfribapayCode) setLocalAfribapayCode(guessAfribaCode(editing?.operator.name || "")); }
                      else if (v === "pixpay") setAshtechMargin(sticky.current.pixpayMargin);
                       else if (v === "pawapay") {
                         setAshtechMargin(sticky.current.pawapayMargin);
                         if (!localPawapayCode) setLocalPawapayCode(guessPawaPayProviderCode(editing.operator.name, editing.country.code));
                       }
                    }} data-testid="select-provider">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="afribapay" disabled={!isProviderAvailable("afribapay", editing.country.code)}>
                          ⚡ AfribaPay{!isProviderAvailable("afribapay", editing.country.code) ? " (non disponible)" : ""}
                        </SelectItem>
                        <SelectItem value="pixpay" disabled={!isProviderAvailable("pixpay", editing.country.code)}>
                          🔷 PixPay{!isProviderAvailable("pixpay", editing.country.code) ? " (non disponible)" : ""}
                        </SelectItem>
                        <SelectItem value="pawapay" disabled={!isProviderAvailable("pawapay", editing.country.code)}>
                          ● PawaPay{!isProviderAvailable("pawapay", editing.country.code) ? " (non disponible)" : ""}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                   <ProviderCountryCoverage provider={localProvider} countries={countries || []} />

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
                  {localProvider === "pawapay" && (
                    <div className="space-y-2">
                      <Label>Code fournisseur PawaPay</Label>
                       <Input placeholder="Ex. MTN_MOMO_CMR" value={localPawapayCode} onChange={(e) => setLocalPawapayCode(e.target.value)} data-testid="input-pawapay-code" />
                       <p className="text-xs text-muted-foreground">Rempli automatiquement selon le pays et l’opérateur PawaPay. Modifiable si votre compte utilise un code personnalisé.</p>
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
                        type="text" inputMode="decimal"
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
                        type="text" inputMode="decimal"
                        value={pixpayFee}
                        onChange={(e) => { setPixpayFee(e.target.value); sticky.current.pixpayFee = e.target.value; }}
                        placeholder="3.00"
                        data-testid="input-pixpay-fee"
                      />
                    </div>
                  ) : localProvider === "pawapay" ? (
                    <div className="space-y-2">
                      <Label>Frais PawaPay (%)</Label>
                      <Input type="text" inputMode="decimal" value={pawapayFee} onChange={(e) => { setPawapayFee(e.target.value); sticky.current.pawapayFee = e.target.value; }} placeholder="3.00" data-testid="input-pawapay-fee" />
                    </div>
                   ) : null}

                  <div className="space-y-2">
                    <Label>Marge Ashtech Pay (%)</Label>
                    <Input
                      type="text" inputMode="decimal"
                      value={ashtechMargin}
                      onChange={(e) => {
                        setAshtechMargin(e.target.value);
                        if (localProvider === "afribapay") sticky.current.afribaMargin = e.target.value;
                        else if (localProvider === "pixpay") sticky.current.pixpayMargin = e.target.value;
                       else if (localProvider === "pawapay") sticky.current.pawapayMargin = e.target.value;
                      }}
                      placeholder="2.00"
                      data-testid="input-ashtech-margin"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Minimum de charge ({currency})</Label>
                    <Input
                      type="text" inputMode="decimal"
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
