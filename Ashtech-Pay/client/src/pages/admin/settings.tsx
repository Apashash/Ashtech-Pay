import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Settings,
  Save,
  Globe,
  DollarSign,
  Shield,
  AlertTriangle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlatformSetting } from "@shared/schema";

export default function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({
    platform_name: "Ashtech Pay",
    default_currency: "XAF",
    maintenance_mode: "false",
    exchange_rate_usd: "625",
    exchange_rate_eur: "656",
    min_transfer: "100",
    max_transfer: "5000000",
    support_email: "support@ashtechpay.com",
    support_phone: "+237 6XX XXX XXX",
  });

  const { data: savedSettings, isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (savedSettings) {
      const newSettings = { ...settings };
      savedSettings.forEach(s => {
        newSettings[s.key] = s.value;
      });
      setSettings(newSettings);
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: string; description?: string }) => {
      return apiRequest("POST", "/api/admin/settings", { key, value, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Paramètre enregistré" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const handleSave = (key: string, description?: string) => {
    saveMutation.mutate({ key, value: settings[key], description });
  };

  const handleSaveAll = () => {
    Object.entries(settings).forEach(([key, value]) => {
      saveMutation.mutate({ key, value });
    });
  };

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
          <Button onClick={handleSaveAll} className="gap-2" data-testid="button-save-all">
            <Save className="w-4 h-4" />
            Tout enregistrer
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
                <DollarSign className="w-5 h-5" />
                Devises & Taux de change
              </CardTitle>
              <CardDescription>
                Configurez les taux de conversion vers XAF
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Devise par défaut</Label>
                  <Input
                    value={settings.default_currency}
                    onChange={(e) => setSettings({ ...settings, default_currency: e.target.value })}
                    data-testid="input-default-currency"
                  />
                </div>
                <div className="space-y-2">
                  <Label>1 USD = ? XAF</Label>
                  <Input
                    type="number"
                    value={settings.exchange_rate_usd}
                    onChange={(e) => setSettings({ ...settings, exchange_rate_usd: e.target.value })}
                    data-testid="input-rate-usd"
                  />
                </div>
                <div className="space-y-2">
                  <Label>1 EUR = ? XAF</Label>
                  <Input
                    type="number"
                    value={settings.exchange_rate_eur}
                    onChange={(e) => setSettings({ ...settings, exchange_rate_eur: e.target.value })}
                    data-testid="input-rate-eur"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Limites globales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Transfert minimum (XAF)</Label>
                  <Input
                    type="number"
                    value={settings.min_transfer}
                    onChange={(e) => setSettings({ ...settings, min_transfer: e.target.value })}
                    data-testid="input-min-transfer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Transfert maximum (XAF)</Label>
                  <Input
                    type="number"
                    value={settings.max_transfer}
                    onChange={(e) => setSettings({ ...settings, max_transfer: e.target.value })}
                    data-testid="input-max-transfer"
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
