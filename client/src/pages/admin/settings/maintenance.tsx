import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlatformSetting } from "@shared/schema";

export default function AdminSettingsMaintenance() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const { data: savedSettings, isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (savedSettings) {
      const setting = savedSettings.find(s => s.key === "maintenance_mode");
      if (setting) {
        setMaintenanceMode(setting.value === "true");
      }
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("POST", "/api/admin/settings", { key: "maintenance_mode", value: String(enabled) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Mode maintenance " + (maintenanceMode ? "activé" : "désactivé") });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const handleToggle = () => {
    setMaintenanceMode(!maintenanceMode);
    saveMutation.mutate(!maintenanceMode);
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
            onClick={() => setLocation(`${(import.meta.env.VITE_ADMIN_PATH as string) || "/admin"}/settings`)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Mode maintenance</h1>
            <p className="text-muted-foreground">Contrôler l'accès à la plateforme</p>
          </div>
        </div>

        <Card className={maintenanceMode ? "border-orange-500/50 bg-orange-500/5" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              État du mode maintenance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-semibold">Mode maintenance</p>
                <p className="text-sm text-muted-foreground">
                  {maintenanceMode ? "Activé - La plateforme est en maintenance" : "Désactivé - La plateforme est opérationnelle"}
                </p>
              </div>
              <Switch 
                checked={maintenanceMode}
                onCheckedChange={handleToggle}
                disabled={saveMutation.isPending}
                data-testid="switch-maintenance-mode"
              />
            </div>

            {maintenanceMode && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-sm text-orange-700">
                  ⚠️ Le mode maintenance est actuellement activé. Les utilisateurs verront une page indiquant que la plateforme est en maintenance.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
