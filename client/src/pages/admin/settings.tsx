import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Settings,
  Save,
  Globe,
  DollarSign,
  Shield,
  AlertTriangle,
  MessageCircle,
  Mail,
  Phone,
  Search,
  RefreshCw
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlatformSetting } from "@shared/schema";
import { ALL_FX_CURRENCIES } from "@shared/schema";

export default function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({
    platform_name: "Ashtech Pay",
    default_currency: "XAF",
    maintenance_mode: "false",
    exchange_rate_usd: "585",
    exchange_rate_eur: "656",
    exchange_rate_cdf: "0.27",
    min_transfer: "2650",
    max_transfer: "5000000",
    min_withdrawal: "2650",
    max_withdrawal: "5000000",
    payment_link_fee_percent: "2",
    deposit_fee_percent: "0",
    support_email: "support@ashtechpay.com",
    support_phone: "+237 6XX XXX XXX",
    contact_email: "",
    contact_whatsapp: "",
    contact_telegram: "",
  });

  const [fxRates, setFxRates] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    ALL_FX_CURRENCIES.forEach(c => {
      defaults[`fx_rate_${c.code}`] = String(c.defaultRate);
    });
    return defaults;
  });

  const [rateSearch, setRateSearch] = useState("");
  const [ratesModified, setRatesModified] = useState(false);

  const { data: savedSettings, isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (savedSettings) {
      const newSettings = { ...settings };
      const newFxRates = { ...fxRates };
      savedSettings.forEach(s => {
        if (s.key.startsWith("fx_rate_")) {
          newFxRates[s.key] = s.value;
        } else {
          newSettings[s.key] = s.value;
        }
      });
      setSettings(newSettings);
      setFxRates(newFxRates);
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: string; description?: string }) => {
      return apiRequest("POST", "/api/admin/settings", { key, value, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-info"] });
      toast({ title: "Paramètre enregistré" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const saveAllMutation = useMutation({
    mutationFn: async (allSettings: Record<string, string>) => {
      return apiRequest("POST", "/api/admin/settings/bulk", { settings: allSettings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/exchange-rates"] });
      toast({ title: "Tous les paramètres ont été enregistrés" });
    },
    onError: () => toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" }),
  });

  const saveFxRatesMutation = useMutation({
    mutationFn: async (rates: Record<string, string>) => {
      return apiRequest("POST", "/api/admin/settings/bulk", { settings: rates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/exchange-rates"] });
      setRatesModified(false);
      toast({ title: "Taux de change enregistrés", description: `${ALL_FX_CURRENCIES.length} devises mises à jour` });
    },
    onError: () => toast({ title: "Erreur lors de l'enregistrement des taux", variant: "destructive" }),
  });

  const handleSave = (key: string, description?: string) => {
    saveMutation.mutate({ key, value: settings[key], description });
  };

  const handleSaveAll = () => {
    saveAllMutation.mutate(settings);
  };

  const handleSaveFxRates = () => {
    saveFxRatesMutation.mutate(fxRates);
  };

  const handleFxRateChange = (code: string, value: string) => {
    setFxRates(prev => ({ ...prev, [`fx_rate_${code}`]: value }));
    setRatesModified(true);
  };

  const handleResetRate = (code: string, defaultRate: number) => {
    setFxRates(prev => ({ ...prev, [`fx_rate_${code}`]: String(defaultRate) }));
    setRatesModified(true);
  };

  const filteredCurrencies = ALL_FX_CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(rateSearch.toLowerCase()) ||
    c.name.toLowerCase().includes(rateSearch.toLowerCase())
  );

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center">
          <p>Chargement...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Paramètres Généraux</h1>
            <p className="text-muted-foreground">Configuration de la plateforme</p>
          </div>
          <Button 
            onClick={handleSaveAll} 
            className="gap-2" 
            data-testid="button-save-all"
            disabled={saveAllMutation.isPending}
          >
            <Save className="w-4 h-4" />
            {saveAllMutation.isPending ? "Enregistrement..." : "Tout enregistrer"}
          </Button>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Informations de la plateforme
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom de la plateforme</Label>
                  <Input
                    value={settings.platform_name}
                    onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                    data-testid="input-platform-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email support</Label>
                  <Input
                    value={settings.support_email}
                    onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                    data-testid="input-support-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone support</Label>
                  <Input
                    value={settings.support_phone}
                    onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
                    data-testid="input-support-phone"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Informations de contact (page publique)
              </CardTitle>
              <CardDescription>
                Ces informations seront affichées sur la page Contact du site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email de contact
                  </Label>
                  <Input
                    type="email"
                    placeholder="contact@ashtechpay.com"
                    value={settings.contact_email}
                    onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                    data-testid="input-contact-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    WhatsApp
                  </Label>
                  <Input
                    placeholder="+237 6XX XXX XXX"
                    value={settings.contact_whatsapp}
                    onChange={(e) => setSettings({ ...settings, contact_whatsapp: e.target.value })}
                    data-testid="input-contact-whatsapp"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Telegram
                  </Label>
                  <Input
                    placeholder="@ashtechpay"
                    value={settings.contact_telegram}
                    onChange={(e) => setSettings({ ...settings, contact_telegram: e.target.value })}
                    data-testid="input-contact-telegram"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Devises & Taux de change
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Taux utilisés pour la conversion lors des paiements par lien. Format : 1 USD = X devise.
                    Ces taux s'appliquent quand un client d'un autre pays effectue un dépôt via lien de paiement.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {ratesModified && (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                      Modifié
                    </Badge>
                  )}
                  <Button
                    onClick={handleSaveFxRates}
                    disabled={saveFxRatesMutation.isPending || !ratesModified}
                    className="gap-2"
                    data-testid="button-save-fx-rates"
                  >
                    <Save className="w-4 h-4" />
                    {saveFxRatesMutation.isPending ? "Enregistrement..." : "Enregistrer les taux"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une devise (ex: KES, Kenya...)"
                  value={rateSearch}
                  onChange={(e) => setRateSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-rate-search"
                />
              </div>

              <div className="text-xs text-muted-foreground">
                {filteredCurrencies.length} devise{filteredCurrencies.length !== 1 ? "s" : ""} — taux exprimé en unités par 1 USD
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredCurrencies.map((currency) => {
                  const key = `fx_rate_${currency.code}`;
                  const currentVal = fxRates[key] ?? String(currency.defaultRate);
                  const isModified = currentVal !== String(currency.defaultRate) &&
                    savedSettings?.find(s => s.key === key)?.value !== currentVal;
                  return (
                    <div
                      key={currency.code}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      data-testid={`fx-rate-row-${currency.code}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{currency.name}</div>
                        <Badge variant="outline" className="text-xs mt-0.5 font-mono">
                          {currency.code}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">1 USD =</span>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={currentVal}
                          onChange={(e) => handleFxRateChange(currency.code, e.target.value)}
                          className="w-28 h-8 text-sm text-right font-mono"
                          data-testid={`input-fx-rate-${currency.code}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          title="Réinitialiser au taux par défaut"
                          onClick={() => handleResetRate(currency.code, currency.defaultRate)}
                          data-testid={`button-reset-rate-${currency.code}`}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Limites globales de transaction
              </CardTitle>
              <CardDescription>
                Montants minimum et maximum autorisés pour les transferts et retraits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Montant minimum — Transfert</Label>
                  <Input
                    type="number"
                    value={settings.min_transfer}
                    onChange={(e) => setSettings({ ...settings, min_transfer: e.target.value })}
                    data-testid="input-min-transfer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Montant maximum — Transfert</Label>
                  <Input
                    type="number"
                    value={settings.max_transfer}
                    onChange={(e) => setSettings({ ...settings, max_transfer: e.target.value })}
                    data-testid="input-max-transfer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Montant minimum — Retrait</Label>
                  <Input
                    type="number"
                    value={settings.min_withdrawal}
                    onChange={(e) => setSettings({ ...settings, min_withdrawal: e.target.value })}
                    data-testid="input-min-withdrawal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Montant maximum — Retrait</Label>
                  <Input
                    type="number"
                    value={settings.max_withdrawal}
                    onChange={(e) => setSettings({ ...settings, max_withdrawal: e.target.value })}
                    data-testid="input-max-withdrawal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frais Lien de paiement (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={settings.payment_link_fee_percent}
                    onChange={(e) => setSettings({ ...settings, payment_link_fee_percent: e.target.value })}
                    data-testid="input-payment-link-fee"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frais Dépôt (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={settings.deposit_fee_percent}
                    onChange={(e) => setSettings({ ...settings, deposit_fee_percent: e.target.value })}
                    data-testid="input-deposit-fee"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={settings.maintenance_mode === "true" ? "border-destructive" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Mode Maintenance
              </CardTitle>
              <CardDescription>
                Désactive l'accès public à la plateforme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {settings.maintenance_mode === "true" && (
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  )}
                  <span>Mode maintenance</span>
                </div>
                <Switch
                  checked={settings.maintenance_mode === "true"}
                  onCheckedChange={(checked) => {
                    setSettings({ ...settings, maintenance_mode: checked ? "true" : "false" });
                    saveMutation.mutate({ 
                      key: "maintenance_mode", 
                      value: checked ? "true" : "false",
                      description: "Active/désactive le mode maintenance"
                    });
                  }}
                  data-testid="switch-maintenance-mode"
                />
              </div>
              {settings.maintenance_mode === "true" && (
                <p className="text-sm text-destructive mt-2">
                  La plateforme est actuellement en mode maintenance. Les utilisateurs ne peuvent pas accéder aux services.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
