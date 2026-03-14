import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Smartphone, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlatformSetting } from "@shared/schema";
import { ALL_FX_CURRENCIES } from "@shared/schema";

export default function AdminSettingsRates() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [fxRates, setFxRates] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    ALL_FX_CURRENCIES.forEach(c => {
      defaults[`fx_rate_${c.code}`] = String(c.defaultRate);
    });
    return defaults;
  });
  const [ratesModified, setRatesModified] = useState(false);

  const { data: savedSettings, isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (savedSettings) {
      const newFxRates = { ...fxRates };
      savedSettings.forEach(s => {
        if (s.key.startsWith("fx_rate_")) {
          newFxRates[s.key] = s.value;
        }
      });
      setFxRates(newFxRates);
    }
  }, [savedSettings]);

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

  const handleFxRateChange = (code: string, value: string) => {
    setFxRates(prev => ({ ...prev, [`fx_rate_${code}`]: value }));
    setRatesModified(true);
  };

  const handleResetRate = (code: string, defaultRate: number) => {
    setFxRates(prev => ({ ...prev, [`fx_rate_${code}`]: String(defaultRate) }));
    setRatesModified(true);
  };

  const handleSaveAll = () => {
    saveFxRatesMutation.mutate(fxRates);
  };

  if (isLoading) {
    return <AdminLayout><div className="p-6">Chargement...</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/admin/settings")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Taux de change</h1>
              <p className="text-muted-foreground">Gérez les taux par devise</p>
            </div>
          </div>
          {ratesModified && (
            <Button 
              onClick={handleSaveAll}
              disabled={saveFxRatesMutation.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Enregistrer les taux
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Taux de change par devise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ALL_FX_CURRENCIES.map(currency => (
                <div key={currency.code} className="space-y-2 p-3 border rounded-lg">
                  <Label className="font-semibold">{currency.code} ({currency.name})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={fxRates[`fx_rate_${currency.code}`] || ""}
                    onChange={(e) => handleFxRateChange(currency.code, e.target.value)}
                    data-testid={`input-fx-rate-${currency.code}`}
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full gap-1"
                    onClick={() => handleResetRate(currency.code, currency.defaultRate)}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Réinitialiser
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
