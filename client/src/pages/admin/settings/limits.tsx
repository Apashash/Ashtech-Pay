import { getAdminPath } from "@/lib/adminPath";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Lock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlatformSetting } from "@shared/schema";

export default function AdminSettingsLimits() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<Record<string, string>>({
    min_transfer: "2650",
    max_transfer: "5000000",
    min_withdrawal: "300",
    max_withdrawal: "500000",
  });

  const { data: savedSettings, isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (savedSettings) {
      const newSettings = { ...settings };
      savedSettings.forEach(s => {
        if (s.key === "min_transfer" || s.key === "max_transfer" || s.key === "min_withdrawal" || s.key === "max_withdrawal") {
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
      toast({ title: "Limite enregistrée" });
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
            <h1 className="text-2xl font-bold">Limites globales</h1>
            <p className="text-muted-foreground">Min/max des transferts et retraits</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Limites des transferts
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Montant minimum</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={settings.min_transfer}
                  onChange={(e) => setSettings({ ...settings, min_transfer: e.target.value })}
                  data-testid="input-min-transfer"
                />
                <Button 
                  size="sm"
                  onClick={() => handleSave("min_transfer")}
                  disabled={saveMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Montant maximum</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={settings.max_transfer}
                  onChange={(e) => setSettings({ ...settings, max_transfer: e.target.value })}
                  data-testid="input-max-transfer"
                />
                <Button 
                  size="sm"
                  onClick={() => handleSave("max_transfer")}
                  disabled={saveMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Limites des retraits
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Montant minimum</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={settings.min_withdrawal}
                  onChange={(e) => setSettings({ ...settings, min_withdrawal: e.target.value })}
                  data-testid="input-min-withdrawal"
                />
                <Button 
                  size="sm"
                  onClick={() => handleSave("min_withdrawal")}
                  disabled={saveMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Montant maximum</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={settings.max_withdrawal}
                  onChange={(e) => setSettings({ ...settings, max_withdrawal: e.target.value })}
                  data-testid="input-max-withdrawal"
                />
                <Button 
                  size="sm"
                  onClick={() => handleSave("max_withdrawal")}
                  disabled={saveMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
