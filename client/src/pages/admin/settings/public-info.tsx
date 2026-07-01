import { getAdminPath } from "@/lib/adminPath";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Globe } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlatformSetting } from "@shared/schema";

export default function AdminSettingsPublicInfo() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<Record<string, string>>({
    contact_email: "",
    contact_whatsapp: "",
    contact_telegram: "",
  });

  const { data: savedSettings, isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (savedSettings) {
      const newSettings = { ...settings };
      savedSettings.forEach(s => {
        if (s.key === "contact_email" || s.key === "contact_whatsapp" || s.key === "contact_telegram") {
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
      queryClient.invalidateQueries({ queryKey: ["/api/contact-info"] });
      toast({ title: "Information publique enregistrée" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const handleSave = (key: string) => {
    saveMutation.mutate({ key, value: settings[key] });
  };

  if (isLoading) {
    return <AdminLayout><div className="p-6">Chargement...</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation(`${getAdminPath()}/settings`)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Info page public</h1>
            <p className="text-muted-foreground">Informations affichées publiquement</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Contacts publics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email de contact</Label>
              <Input
                type="email"
                value={settings.contact_email}
                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                placeholder="contact@ashtechpay.com"
                data-testid="input-contact-email"
              />
              <Button 
                size="sm"
                onClick={() => handleSave("contact_email")}
                disabled={saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={settings.contact_whatsapp}
                onChange={(e) => setSettings({ ...settings, contact_whatsapp: e.target.value })}
                placeholder="+237 6XX XXX XXX"
                inputMode="tel"
                data-testid="input-contact-whatsapp"
              />
              <Button 
                size="sm"
                onClick={() => handleSave("contact_whatsapp")}
                disabled={saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Telegram</Label>
              <Input
                value={settings.contact_telegram}
                onChange={(e) => setSettings({ ...settings, contact_telegram: e.target.value })}
                placeholder="@ashtechpay"
                data-testid="input-contact-telegram"
              />
              <Button 
                size="sm"
                onClick={() => handleSave("contact_telegram")}
                disabled={saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
