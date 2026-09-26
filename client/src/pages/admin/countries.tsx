import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Pencil, Trash2, Globe, Smartphone, AlertTriangle, Bitcoin, Save, Search, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Country, Operator, PlatformSetting } from "@shared/schema";

interface AdminCryptoNetwork {
  id: string;
  label: string;
  assetCode: string;
  memoRequired?: boolean;
  memoType?: string | null;
}

interface AdminCryptoCoin {
  name: string;
  networks: AdminCryptoNetwork[];
}

interface AdminCryptoResponse {
  coins: Record<string, AdminCryptoCoin>;
  disabled: string[];
}

interface CryptoWithdrawalFeeRule {
  fixedUsdt: number;
  percentage: number;
}

interface CryptoWithdrawalFeeConfig {
  global: Record<string, CryptoWithdrawalFeeRule>;
  countries: Record<string, Record<string, CryptoWithdrawalFeeRule>>;
}

export default function AdminCountries() {
  const { toast } = useToast();
  const [showCountryModal, setShowCountryModal] = useState(false);

  // Crypto USDT settings
  const [cryptoSettings, setCryptoSettings] = useState({
    fx_rate_USDT: "620",
    izichange_fee_percent: "2.5",
    izichange_provider_fee_percent: "0",
  });
  const [cryptoWithdrawalLimits, setCryptoWithdrawalLimits] = useState({
    minUsdt: "",
    maxUsdt: "",
  });
  const { data: savedSettings } = useQuery<PlatformSetting[]>({ queryKey: ["/api/admin/settings"] });
  useEffect(() => {
    if (savedSettings) {
      const patch: Record<string, string> = {};
      savedSettings.forEach(s => {
        if (["fx_rate_USDT", "izichange_fee_percent", "izichange_provider_fee_percent"].includes(s.key))
          patch[s.key] = s.value;
      });
      if (Object.keys(patch).length) setCryptoSettings(prev => ({ ...prev, ...patch }));
    }
  }, [savedSettings]);
  useEffect(() => {
    const setting = savedSettings?.find(item => item.key === "crypto_withdrawal_limits");
    if (!setting) {
      setCryptoWithdrawalLimits({ minUsdt: "", maxUsdt: "" });
      return;
    }
    try {
      const parsed = JSON.parse(setting.value);
      setCryptoWithdrawalLimits({
        minUsdt: parsed?.minUsdt == null ? "" : String(parsed.minUsdt),
        maxUsdt: parsed?.maxUsdt == null ? "" : String(parsed.maxUsdt),
      });
    } catch {
      setCryptoWithdrawalLimits({ minUsdt: "", maxUsdt: "" });
    }
  }, [savedSettings]);
  const saveSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => apiRequest("POST", "/api/admin/settings", { key, value }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] }); toast({ title: "Paramètre enregistré" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const [cryptoSearch, setCryptoSearch] = useState("");
  const { data: adminCryptoAssets, isLoading: loadingCryptoAssets } = useQuery<AdminCryptoResponse>({
    queryKey: ["/api/admin/crypto/assets"],
  });
  const [payoutFeeScope, setPayoutFeeScope] = useState("global");
  const [payoutFeeConfig, setPayoutFeeConfig] = useState<CryptoWithdrawalFeeConfig>({
    global: {},
    countries: {},
  });
  useEffect(() => {
    const setting = savedSettings?.find(item => item.key === "crypto_withdrawal_fees");
    if (!setting) return;
    try {
      const parsed = JSON.parse(setting.value);
      if (parsed && typeof parsed === "object") {
        setPayoutFeeConfig({
          global: parsed.global && typeof parsed.global === "object" ? parsed.global : {},
          countries: parsed.countries && typeof parsed.countries === "object" ? parsed.countries : {},
        });
      }
    } catch {
      setPayoutFeeConfig({ global: {}, countries: {} });
    }
  }, [savedSettings]);

  const updatePayoutFee = (assetCode: string, key: keyof CryptoWithdrawalFeeRule, value: number) => {
    setPayoutFeeConfig(current => {
      const existing = payoutFeeScope === "global"
        ? current.global[assetCode]
        : current.countries[payoutFeeScope]?.[assetCode] || current.global[assetCode];
      const rule = { fixedUsdt: existing?.fixedUsdt ?? 0, percentage: existing?.percentage ?? 0 };
      rule[key] = Number.isFinite(value) && value >= 0 ? value : 0;
      if (payoutFeeScope === "global") {
        return { ...current, global: { ...current.global, [assetCode]: rule } };
      }
      return {
        ...current,
        countries: {
          ...current.countries,
          [payoutFeeScope]: { ...(current.countries[payoutFeeScope] || {}), [assetCode]: rule },
        },
      };
    });
  };
  const cryptoMinValue = cryptoWithdrawalLimits.minUsdt.trim() === "" ? null : Number(cryptoWithdrawalLimits.minUsdt);
  const cryptoMaxValue = cryptoWithdrawalLimits.maxUsdt.trim() === "" ? null : Number(cryptoWithdrawalLimits.maxUsdt);
  const cryptoLimitsAreCleared = cryptoMinValue === null && cryptoMaxValue === null;
  const cryptoLimitsAreValid = cryptoLimitsAreCleared || (
    cryptoMinValue !== null &&
    cryptoMaxValue !== null &&
    Number.isFinite(cryptoMinValue) &&
    Number.isFinite(cryptoMaxValue) &&
    cryptoMinValue > 0 &&
    cryptoMaxValue >= cryptoMinValue &&
    Math.abs(Math.round(cryptoMinValue * 100) / 100 - cryptoMinValue) <= 1e-9 &&
    Math.abs(Math.round(cryptoMaxValue * 100) / 100 - cryptoMaxValue) <= 1e-9
  );
  const saveCryptoWithdrawalLimits = () => {
    if (!cryptoLimitsAreValid) {
      toast({
        title: "Limites invalides",
        description: "Saisissez un minimum et un maximum positifs, avec au plus deux décimales. Le maximum doit être supérieur ou égal au minimum.",
        variant: "destructive",
      });
      return;
    }
    saveSettingMutation.mutate({
      key: "crypto_withdrawal_limits",
      value: JSON.stringify({
        minUsdt: cryptoMinValue,
        maxUsdt: cryptoMaxValue,
      }),
    });
  };

  const toggleCryptoMutation = useMutation({
    mutationFn: async ({ assetCode, enabled }: { assetCode: string; enabled: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/crypto/assets/toggle", { assetCode, enabled });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Impossible de modifier le réseau");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crypto/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/disabled-assets"] });
      toast({ title: "Réseau crypto mis à jour" });
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  
  const [countryForm, setCountryForm] = useState({
    name: "",
    code: "",
    flag: "🌍",
    dialCode: "+1",
    currency: "XAF",
    exchangeRate: "1",
    minDeposit: "100",
    maxDeposit: "5000000",
    minWithdrawal: "500",
    maxWithdrawal: "2000000",
    isActive: true,
    isActiveForRegistration: true,
    isActiveForDeposit: true,
    isActiveForTransfer: true,
    isActiveForWithdrawal: true,
  });

  const [operatorForm, setOperatorForm] = useState({
    name: "",
    type: "mobile_money",
    countryId: "",
    dailyLimit: "1000000",
    isActive: true,
    isInMaintenance: false,
    gateway: "soleapay",
  });

  const { data: countries, isLoading: loadingCountries } = useQuery<Country[]>({
    queryKey: ["/api/admin/countries"],
  });

  const { data: operators, isLoading: loadingOperators } = useQuery<Operator[]>({
    queryKey: ["/api/admin/operators"],
  });

  const createCountryMutation = useMutation({
    mutationFn: async (data: typeof countryForm) => {
      const res = await apiRequest("POST", "/api/admin/countries", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur lors de la création");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/countries"] });
      toast({ title: "Pays créé" });
      resetCountryForm();
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const updateCountryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof countryForm> }) => {
      const res = await apiRequest("PATCH", `/api/admin/countries/${id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur lors de la mise à jour");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/countries"] });
      // Also bust the public exchange-rates cache so the convert page picks up the new rate immediately
      queryClient.invalidateQueries({ queryKey: ["/api/public/exchange-rates"] });
      toast({ title: "Pays mis à jour" });
      resetCountryForm();
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const toggleCountryMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/countries/${id}`, { isActive });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Erreur lors de la modification du pays");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/countries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/countries"] });
      toast({ title: variables.isActive ? "Pays activé" : "Pays désactivé" });
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteCountryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/countries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/countries"] });
      toast({ title: "Pays supprimé" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const createOperatorMutation = useMutation({
    mutationFn: async (data: typeof operatorForm) => {
      return apiRequest("POST", "/api/admin/operators", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      toast({ title: "Opérateur créé" });
      resetOperatorForm();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const updateOperatorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof operatorForm> }) => {
      return apiRequest("PATCH", `/api/admin/operators/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      toast({ title: "Opérateur mis à jour" });
      resetOperatorForm();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteOperatorMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/operators/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      toast({ title: "Opérateur supprimé" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const toggleAllOperatorsMutation = useMutation({
    mutationFn: async ({ countryId, isActive }: { countryId: string; isActive: boolean }) => {
      return apiRequest("POST", `/api/admin/countries/${countryId}/toggle-operators`, { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      toast({ title: variables.isActive ? "Tous les opérateurs activés" : "Tous les opérateurs désactivés" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const resetCountryForm = () => {
    setShowCountryModal(false);
    setEditingCountry(null);
    setCountryForm({
      name: "",
      code: "",
      flag: "🌍",
      dialCode: "+1",
      currency: "XAF",
      exchangeRate: "1",
      minDeposit: "100",
      maxDeposit: "5000000",
      minWithdrawal: "500",
      maxWithdrawal: "2000000",
      isActive: true,
      isActiveForRegistration: true,
      isActiveForDeposit: true,
      isActiveForTransfer: true,
      isActiveForWithdrawal: true,
    });
  };

  const resetOperatorForm = () => {
    setShowOperatorModal(false);
    setEditingOperator(null);
    setOperatorForm({
      name: "",
      type: "mobile_money",
      countryId: "",
      dailyLimit: "1000000",
      isActive: true,
      isInMaintenance: false,
      gateway: "soleapay",
    });
  };

  const openEditCountry = (country: Country) => {
    setEditingCountry(country);
    setCountryForm({
      name: country.name,
      code: country.code,
      flag: country.flag || "🌍",
      dialCode: country.dialCode || "+1",
      currency: country.currency,
      exchangeRate: country.exchangeRate || "1",
      minDeposit: country.minDeposit,
      maxDeposit: country.maxDeposit,
      minWithdrawal: country.minWithdrawal,
      maxWithdrawal: country.maxWithdrawal,
      isActive: country.isActive ?? true,
      isActiveForRegistration: country.isActiveForRegistration ?? true,
      isActiveForDeposit: country.isActiveForDeposit ?? true,
      isActiveForTransfer: country.isActiveForTransfer ?? true,
      isActiveForWithdrawal: country.isActiveForWithdrawal ?? true,
    });
    setShowCountryModal(true);
  };

  const openEditOperator = (operator: Operator) => {
    setEditingOperator(operator);
    setOperatorForm({
      name: operator.name,
      type: operator.type,
      countryId: operator.countryId,
      dailyLimit: operator.dailyLimit,
      isActive: operator.isActive ?? true,
      isInMaintenance: operator.isInMaintenance ?? false,
      gateway: (operator as any).gateway || "soleapay",
    });
    setShowOperatorModal(true);
  };

  const getCountryName = (id: string) => {
    return countries?.find(c => c.id === id)?.name || "Inconnu";
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pays & Opérateurs</h1>
          <p className="text-muted-foreground">Gérez les pays et leurs opérateurs de paiement</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Pays</p>
                <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4 text-muted-foreground" />Pays actifs</CardTitle>
              </div>
              <Button onClick={() => setShowCountryModal(true)} size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pays</TableHead>
                      <TableHead>Devise</TableHead>
                      <TableHead className="text-center">Global</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingCountries ? (
                      <TableRow><TableCell colSpan={4} className="text-center">Chargement...</TableCell></TableRow>
                    ) : countries?.map((country) => (
                      <TableRow key={country.id}>
                        <TableCell>
                          <span className="mr-2">{country.flag}</span>
                          {country.name}
                          {!country.isActive && <Badge variant="secondary" className="ml-2">Inactif</Badge>}
                        </TableCell>
                        <TableCell>{country.currency}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={country.isActive !== false}
                              disabled={toggleCountryMutation.isPending}
                              onCheckedChange={(checked) =>
                                toggleCountryMutation.mutate({ id: country.id, isActive: checked })
                              }
                              aria-label={`${country.isActive !== false ? "Désactiver" : "Activer"} ${country.name} globalement`}
                              data-testid={`switch-country-global-${country.id}`}
                            />
                            <span className={`hidden sm:inline text-xs font-medium ${country.isActive !== false ? "text-green-600" : "text-muted-foreground"}`}>
                              {country.isActive !== false ? "Actif" : "Inactif"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => openEditCountry(country)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* USDT Crypto Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Crypto</p>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bitcoin className="w-4 h-4 text-blue-400" />
                  USDT TRC20 — Monde entier
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Taux USDT/XAF (1 USDT = X XAF)</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={cryptoSettings.fx_rate_USDT}
                  onChange={(e) => setCryptoSettings(p => ({ ...p, fx_rate_USDT: e.target.value }))}
                  placeholder="620"
                  data-testid="input-fx-rate-usdt"
                />
                <p className="text-xs text-muted-foreground">Taux utilisé pour convertir les montants XAF en USDT sur les liens de paiement.</p>
                <Button
                  size="sm"
                  onClick={() => saveSettingMutation.mutate({ key: "fx_rate_USDT", value: cryptoSettings.fx_rate_USDT })}
                  disabled={saveSettingMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />Enregistrer
                </Button>
              </div>

              {/* ── Frais AshtechPay (marge) ── */}
              <div className="space-y-2">
                <Label>Frais AshtechPay — dépôt &amp; lien de paiement (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={cryptoSettings.izichange_fee_percent}
                  onChange={(e) => setCryptoSettings(p => ({ ...p, izichange_fee_percent: e.target.value }))}
                  placeholder="2.5"
                  data-testid="input-izichange-fee"
                />
                <p className="text-xs text-muted-foreground">Marge AshtechPay sur les dépôts et liens de paiement crypto.</p>
                <Button
                  size="sm"
                  onClick={() => saveSettingMutation.mutate({ key: "izichange_fee_percent", value: cryptoSettings.izichange_fee_percent })}
                  disabled={saveSettingMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />Enregistrer
                </Button>
              </div>

              {/* ── Frais fournisseur (IziChange) ── */}
              <div className="space-y-2">
                <Label>Frais fournisseur IziChange (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={cryptoSettings.izichange_provider_fee_percent}
                  onChange={(e) => setCryptoSettings(p => ({ ...p, izichange_provider_fee_percent: e.target.value }))}
                  placeholder="0"
                  data-testid="input-izichange-provider-fee"
                />
                <p className="text-xs text-muted-foreground">Frais prélevés par IziChange (coût fournisseur, non reversé à Ashtech).</p>
                <Button
                  size="sm"
                  onClick={() => saveSettingMutation.mutate({ key: "izichange_provider_fee_percent", value: cryptoSettings.izichange_provider_fee_percent })}
                  disabled={saveSettingMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />Enregistrer
                </Button>
              </div>

              {/* ── Total frais (calculé, lecture seule) ── */}
              {(() => {
                const ashtech = parseFloat(cryptoSettings.izichange_fee_percent || "0");
                const provider = parseFloat(cryptoSettings.izichange_provider_fee_percent || "0");
                const total = (ashtech + provider).toFixed(2);
                return (
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Total frais crypto</p>
                      <p className="text-xs text-muted-foreground mt-0.5">AshtechPay {ashtech}% + Fournisseur {provider}%</p>
                    </div>
                    <span className="text-xl font-bold text-primary">{total}%</span>
                  </div>
                );
              })()}
              <p className="text-xs text-amber-500 font-medium">⚠️ Ce total est déduit du montant de chaque dépôt et lien de paiement crypto.</p>

            </CardContent>
          </Card>
        </div>

        {/* Crypto networks activation */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Crypto</p>
              <CardTitle className="text-base flex items-center gap-2">
                <Bitcoin className="w-4 h-4 text-blue-400" />
                Réseaux crypto disponibles
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Désactivez un réseau pour le retirer des dépôts et des liens de paiement.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={cryptoSearch}
                onChange={(event) => setCryptoSearch(event.target.value)}
                placeholder="Rechercher un coin ou réseau..."
                className="pl-9"
                data-testid="input-crypto-network-search"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loadingCryptoAssets ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement des réseaux...
              </div>
            ) : !adminCryptoAssets?.coins || Object.keys(adminCryptoAssets.coins).length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                Catalogue crypto indisponible pour le moment.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(adminCryptoAssets.coins)
                  .filter(([code, coin]) => {
                    const query = cryptoSearch.trim().toLowerCase();
                    return !query ||
                      code.toLowerCase().includes(query) ||
                      coin.name.toLowerCase().includes(query) ||
                      coin.networks.some(network =>
                        `${network.id} ${network.label} ${network.assetCode}`.toLowerCase().includes(query)
                      );
                  })
                  .map(([code, coin]) => (
                    <div key={code} className="rounded-lg border bg-card/50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold">{code}</p>
                          <p className="text-xs text-muted-foreground">{coin.name}</p>
                        </div>
                        <Badge variant="outline">{coin.networks.length} réseau{coin.networks.length > 1 ? "x" : ""}</Badge>
                      </div>
                      <div className="space-y-2">
                        {coin.networks.map(network => {
                          const enabled = !(adminCryptoAssets.disabled || []).includes(network.assetCode);
                          return (
                            <div key={network.assetCode} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                              <div className="min-w-0">
                                <p className={`text-sm font-medium ${enabled ? "" : "text-muted-foreground line-through"}`}>
                                  {network.label}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-mono truncate">{network.assetCode}</p>
                              </div>
                              <Switch
                                checked={enabled}
                                disabled={toggleCryptoMutation.isPending}
                                onCheckedChange={(checked) =>
                                  toggleCryptoMutation.mutate({ assetCode: network.assetCode, enabled: checked })
                                }
                                aria-label={`${enabled ? "Désactiver" : "Activer"} ${network.assetCode}`}
                                data-testid={`switch-crypto-${network.assetCode.replace(/[^a-zA-Z0-9]/g, "-")}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Retraits crypto</p>
            <CardTitle className="text-base">Limites des retraits USDT</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ces limites s’appliquent au montant demandé en USDT, quel que soit le pays ou le réseau choisi.
              Les retraits restent désactivés tant que les deux valeurs ne sont pas renseignées.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="crypto-withdrawal-min-usdt">Minimum (USDT)</Label>
                <Input
                  id="crypto-withdrawal-min-usdt"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={cryptoWithdrawalLimits.minUsdt}
                  onChange={event => setCryptoWithdrawalLimits(current => ({ ...current, minUsdt: event.target.value }))}
                  placeholder="Non configuré"
                  data-testid="input-crypto-withdrawal-min-usdt"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crypto-withdrawal-max-usdt">Maximum (USDT)</Label>
                <Input
                  id="crypto-withdrawal-max-usdt"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={cryptoWithdrawalLimits.maxUsdt}
                  onChange={event => setCryptoWithdrawalLimits(current => ({ ...current, maxUsdt: event.target.value }))}
                  placeholder="Non configuré"
                  data-testid="input-crypto-withdrawal-max-usdt"
                />
              </div>
            </div>
            <Button
              onClick={saveCryptoWithdrawalLimits}
              disabled={saveSettingMutation.isPending || !cryptoLimitsAreValid}
              className="gap-2"
              data-testid="button-save-crypto-withdrawal-limits"
            >
              <Save className="h-4 w-4" />
              Enregistrer les limites
            </Button>
            {cryptoLimitsAreCleared && (
              <p className="text-xs text-amber-600">
                Les deux champs sont vides : enregistrer cette configuration désactivera les retraits crypto.
              </p>
            )}
            {!cryptoLimitsAreValid && (
              <p className="text-xs text-destructive">
                Renseignez les deux montants avec au plus deux décimales et vérifiez que le maximum est supérieur ou égal au minimum.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Retraits crypto</p>
            <CardTitle className="text-base">Frais USDT par pays et réseau</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configurez un montant fixe et un pourcentage. Sans règle propre au pays, le tarif global s’applique.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="max-w-sm space-y-2">
              <Label>Pays de la grille tarifaire</Label>
              <Select value={payoutFeeScope} onValueChange={setPayoutFeeScope}>
                <SelectTrigger><SelectValue placeholder="Choisir un pays" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Tarif global</SelectItem>
                  {countries?.map(country => (
                    <SelectItem key={country.id} value={country.id}>{country.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!adminCryptoAssets?.coins?.USDT?.networks?.length ? (
              <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
                Les réseaux USDT ne sont pas encore disponibles dans le catalogue.
              </p>
            ) : (
              <div className="space-y-3">
                {adminCryptoAssets.coins.USDT.networks.map(network => {
                  const localRule = payoutFeeScope === "global"
                    ? payoutFeeConfig.global[network.assetCode]
                    : payoutFeeConfig.countries[payoutFeeScope]?.[network.assetCode];
                  const displayRule = localRule || payoutFeeConfig.global[network.assetCode] || { fixedUsdt: 0, percentage: 0 };
                  return (
                    <div key={network.assetCode} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_160px_160px] sm:items-end">
                      <div className="min-w-0">
                        <p className="font-medium">{network.label}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">{network.assetCode}</p>
                        {payoutFeeScope !== "global" && !localRule && (
                          <Badge variant="outline" className="mt-2">Tarif global utilisé</Badge>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`crypto-fee-fixed-${network.assetCode}`}>Fixe (USDT)</Label>
                        <Input
                          id={`crypto-fee-fixed-${network.assetCode}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(displayRule.fixedUsdt)}
                          onChange={event => updatePayoutFee(network.assetCode, "fixedUsdt", Number(event.target.value))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`crypto-fee-percent-${network.assetCode}`}>Pourcentage (%)</Label>
                        <Input
                          id={`crypto-fee-percent-${network.assetCode}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={String(displayRule.percentage)}
                          onChange={event => updatePayoutFee(network.assetCode, "percentage", Number(event.target.value))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              onClick={() => saveSettingMutation.mutate({
                key: "crypto_withdrawal_fees",
                value: JSON.stringify(payoutFeeConfig),
              })}
              disabled={saveSettingMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Enregistrer les tarifs crypto
            </Button>
            <p className="text-xs text-muted-foreground">
              Les frais IziChange sont payés séparément par le compte marchand. Cette grille définit uniquement les frais AshTechPay facturés à l’utilisateur.
            </p>
          </CardContent>
        </Card>

        <Dialog open={showCountryModal} onOpenChange={() => resetCountryForm()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCountry ? "Modifier le pays" : "Nouveau pays"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du pays</Label>
                  <Input
                    value={countryForm.name}
                    onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })}
                    placeholder="Cameroun"
                    data-testid="input-country-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code ISO</Label>
                  <Input
                    value={countryForm.code}
                    onChange={(e) => setCountryForm({ ...countryForm, code: e.target.value.toUpperCase() })}
                    placeholder="CM"
                    maxLength={2}
                    data-testid="input-country-code"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Drapeau (emoji)</Label>
                  <Input
                    value={countryForm.flag}
                    onChange={(e) => setCountryForm({ ...countryForm, flag: e.target.value })}
                    placeholder="🇨🇲"
                    data-testid="input-country-flag"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Indicatif téléphonique</Label>
                  <Input
                    value={countryForm.dialCode}
                    onChange={(e) => setCountryForm({ ...countryForm, dialCode: e.target.value })}
                    placeholder="+237"
                    data-testid="input-country-dialcode"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Devise</Label>
                  <Select
                    value={countryForm.currency}
                    onValueChange={(v) => setCountryForm({ ...countryForm, currency: v })}
                  >
                    <SelectTrigger data-testid="select-country-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XAF">XAF (Franc CFA CEMAC)</SelectItem>
                      <SelectItem value="XOF">XOF (Franc CFA UEMOA)</SelectItem>
                      <SelectItem value="CDF">CDF (Franc Congolais)</SelectItem>
                      <SelectItem value="MGA">MGA (Ariary Malgache)</SelectItem>
                      <SelectItem value="MAD">MAD (Dirham Marocain)</SelectItem>
                      <SelectItem value="TND">TND (Dinar Tunisien)</SelectItem>
                      <SelectItem value="DZD">DZD (Dinar Algérien)</SelectItem>
                      <SelectItem value="USD">USD (Dollar US)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Taux de change (vers XAF)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={countryForm.exchangeRate}
                    onChange={(e) => setCountryForm({ ...countryForm, exchangeRate: e.target.value })}
                    placeholder="1"
                    data-testid="input-exchange-rate"
                  />
                  <p className="text-xs text-muted-foreground">1 {countryForm.currency} = {countryForm.exchangeRate} XAF</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dépôt min</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={countryForm.minDeposit}
                    onChange={(e) => setCountryForm({ ...countryForm, minDeposit: e.target.value })}
                    data-testid="input-min-deposit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dépôt max</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={countryForm.maxDeposit}
                    onChange={(e) => setCountryForm({ ...countryForm, maxDeposit: e.target.value })}
                    data-testid="input-max-deposit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retrait min</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={countryForm.minWithdrawal}
                    onChange={(e) => setCountryForm({ ...countryForm, minWithdrawal: e.target.value })}
                    data-testid="input-min-withdrawal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retrait max</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={countryForm.maxWithdrawal}
                    onChange={(e) => setCountryForm({ ...countryForm, maxWithdrawal: e.target.value })}
                    data-testid="input-max-withdrawal"
                  />
                </div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <Label className="text-sm font-medium">Options d'activation</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={countryForm.isActive}
                      onCheckedChange={(checked) => setCountryForm({ ...countryForm, isActive: checked })}
                      data-testid="switch-country-active"
                    />
                    <Label className="text-sm">Global</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={countryForm.isActiveForRegistration}
                      onCheckedChange={(checked) => setCountryForm({ ...countryForm, isActiveForRegistration: checked })}
                    />
                    <Label className="text-sm">Inscription</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={countryForm.isActiveForDeposit}
                      onCheckedChange={(checked) => setCountryForm({ ...countryForm, isActiveForDeposit: checked })}
                    />
                    <Label className="text-sm">Dépôt</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={countryForm.isActiveForTransfer}
                      onCheckedChange={(checked) => setCountryForm({ ...countryForm, isActiveForTransfer: checked })}
                    />
                    <Label className="text-sm">Transfert</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={countryForm.isActiveForWithdrawal}
                      onCheckedChange={(checked) => setCountryForm({ ...countryForm, isActiveForWithdrawal: checked })}
                    />
                    <Label className="text-sm">Retrait</Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetCountryForm}>Annuler</Button>
              <Button 
                onClick={() => {
                  if (editingCountry) {
                    updateCountryMutation.mutate({ id: editingCountry.id, data: countryForm });
                  } else {
                    createCountryMutation.mutate(countryForm);
                  }
                }}
                data-testid="button-save-country"
              >
                {editingCountry ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showOperatorModal} onOpenChange={() => resetOperatorForm()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOperator ? "Modifier l'opérateur" : "Nouvel opérateur"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={operatorForm.name}
                  onChange={(e) => setOperatorForm({ ...operatorForm, name: e.target.value })}
                  placeholder="MTN Mobile Money"
                  data-testid="input-operator-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={operatorForm.type}
                    onValueChange={(v) => setOperatorForm({ ...operatorForm, type: v })}
                  >
                    <SelectTrigger data-testid="select-operator-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank">Banque</SelectItem>
                      <SelectItem value="crypto">Crypto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pays</Label>
                  <Select
                    value={operatorForm.countryId}
                    onValueChange={(v) => setOperatorForm({ ...operatorForm, countryId: v })}
                  >
                    <SelectTrigger data-testid="select-operator-country">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {countries?.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Limite journalière</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={operatorForm.dailyLimit}
                  onChange={(e) => setOperatorForm({ ...operatorForm, dailyLimit: e.target.value })}
                  data-testid="input-operator-limit"
                />
              </div>
              <div className="space-y-2">
                <Label>Passerelle de paiement</Label>
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
                  <Badge className="bg-orange-600">AfribaPay / PixPay</Badge>
                  <span className="text-sm text-muted-foreground">Fournisseur configuré par opérateur</span>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={operatorForm.isActive}
                    onCheckedChange={(checked) => setOperatorForm({ ...operatorForm, isActive: checked })}
                    data-testid="switch-operator-active"
                  />
                  <Label>Actif</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={operatorForm.isInMaintenance}
                    onCheckedChange={(checked) => setOperatorForm({ ...operatorForm, isInMaintenance: checked })}
                    data-testid="switch-operator-maintenance"
                  />
                  <Label>En maintenance</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetOperatorForm}>Annuler</Button>
              <Button 
                onClick={() => {
                  if (editingOperator) {
                    updateOperatorMutation.mutate({ id: editingOperator.id, data: operatorForm });
                  } else {
                    createOperatorMutation.mutate(operatorForm);
                  }
                }}
                data-testid="button-save-operator"
              >
                {editingOperator ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
