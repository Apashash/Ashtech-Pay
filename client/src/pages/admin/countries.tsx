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
import { Plus, Pencil, Trash2, Globe, Smartphone, AlertTriangle, Bitcoin, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Country, Operator, PlatformSetting } from "@shared/schema";

export default function AdminCountries() {
  const { toast } = useToast();
  const [showCountryModal, setShowCountryModal] = useState(false);

  // Crypto USDT settings
  const [cryptoSettings, setCryptoSettings] = useState({ fx_rate_USDT: "620", nowpayments_fee_percent: "2.5", nowpayments_min_deposit: "11" });
  const { data: savedSettings } = useQuery<PlatformSetting[]>({ queryKey: ["/api/admin/settings"] });
  useEffect(() => {
    if (savedSettings) {
      const patch: Record<string, string> = {};
      savedSettings.forEach(s => {
        if (["fx_rate_USDT", "nowpayments_fee_percent", "nowpayments_min_deposit"].includes(s.key)) patch[s.key] = s.value;
      });
      if (Object.keys(patch).length) setCryptoSettings(prev => ({ ...prev, ...patch }));
    }
  }, [savedSettings]);
  const saveSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => apiRequest("POST", "/api/admin/settings", { key, value }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] }); toast({ title: "Paramètre enregistré" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
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
    gateway: "swychr",
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
      toast({ title: "Pays mis à jour" });
      resetCountryForm();
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingCountries ? (
                      <TableRow><TableCell colSpan={3} className="text-center">Chargement...</TableCell></TableRow>
                    ) : countries?.map((country) => (
                      <TableRow key={country.id}>
                        <TableCell>
                          <span className="mr-2">{country.flag}</span>
                          {country.name}
                          {!country.isActive && <Badge variant="secondary" className="ml-2">Inactif</Badge>}
                        </TableCell>
                        <TableCell>{country.currency}</TableCell>
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

              <div className="space-y-2">
                <Label>Frais crypto NowPayments (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={cryptoSettings.nowpayments_fee_percent}
                  onChange={(e) => setCryptoSettings(p => ({ ...p, nowpayments_fee_percent: e.target.value }))}
                  placeholder="2.5"
                  data-testid="input-nowpayments-fee"
                />
                <p className="text-xs text-muted-foreground">Pourcentage déduit du montant USDT sur les dépôts et liens de paiement crypto. Appliqué automatiquement.</p>
                <Button
                  size="sm"
                  onClick={() => saveSettingMutation.mutate({ key: "nowpayments_fee_percent", value: cryptoSettings.nowpayments_fee_percent })}
                  disabled={saveSettingMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />Enregistrer
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Dépôt minimum USDT</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.5"
                  value={cryptoSettings.nowpayments_min_deposit}
                  onChange={(e) => setCryptoSettings(p => ({ ...p, nowpayments_min_deposit: e.target.value }))}
                  placeholder="11"
                  data-testid="input-nowpayments-min"
                />
                <p className="text-xs text-muted-foreground">Montant minimum accepté pour un dépôt USDT TRC20 (imposé par NowPayments). Appliqué sur la page dépôt.</p>
                <Button
                  size="sm"
                  onClick={() => saveSettingMutation.mutate({ key: "nowpayments_min_deposit", value: cryptoSettings.nowpayments_min_deposit })}
                  disabled={saveSettingMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

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
                      <SelectItem value="GNF">GNF (Franc Guinéen)</SelectItem>
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
                  <Badge className="bg-purple-600">Swychr</Badge>
                  <span className="text-sm text-muted-foreground">Intégration Swychr (tous les pays)</span>
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
