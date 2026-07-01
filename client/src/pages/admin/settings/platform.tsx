import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Settings, Bitcoin } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlatformSetting } from "@shared/schema";

export default function AdminSettingsPlatform() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<Record<string, string>>({
    platform_name: "Ashtech Pay",
    default_currency: "XAF",
    support_email: "support@ashtechpay.com",
    support_phone: "+237 6XX XXX XXX",
    fx_rate_USDT: "620",
    nowpayments_fee_percent: "2.5",
  });

  const { data: savedSettings, isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (savedSettings) {
      const newSettings = { ...settings };
      const allowedKeys = ["platform_name", "default_currency", "support_email", "support_phone", "fx_rate_USDT", "nowpayments_fee_percent"];
      savedSettings.forEach(s => {
        if (allowedKeys.includes(s.key)) {
          newSettings[s.key] = s.value;
        }
      });
      setSettings(newSettings);
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest("POST", "/api/admin/settings", { key, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Paramètre enregistré" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const handleSave = (key: string) => {
    saveMutation.mutate({ key, value: settings[key] });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6">Chargement...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation(`${(import.meta.env.VITE_ADMIN_PATH as string) || "/admin"}/settings`)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Info de la plateforme</h1>
            <p className="text-muted-foreground">Configuration de base</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Informations générales
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
                <Button 
                  size="sm"
                  onClick={() => handleSave("platform_name")}
                  disabled={saveMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Devise par défaut</Label>
                <Input
                  value={settings.default_currency}
                  onChange={(e) => setSettings({ ...settings, default_currency: e.target.value })}
                  data-testid="input-default-currency"
                />
                <Button 
                  size="sm"
                  onClick={() => handleSave("default_currency")}
                  disabled={saveMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Support client</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email support</Label>
                  <Input
                    value={settings.support_email}
                    onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                    data-testid="input-support-email"
                  />
                  <Button 
                    size="sm"
                    onClick={() => handleSave("support_email")}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Téléphone support</Label>
                  <Input
                    value={settings.support_phone}
                    onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
                    data-testid="input-support-phone"
                  />
                  <Button 
                    size="sm"
                    onClick={() => handleSave("support_phone")}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </AdminLayout>
  );
}
