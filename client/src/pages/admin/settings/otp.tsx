import { getAdminPath } from "@/lib/adminPath";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Mail, ShieldCheck, ShieldOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlatformSetting } from "@shared/schema";

export default function AdminSettingsOtp() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [otpEnabled, setOtpEnabled] = useState(true);

  const { data: savedSettings, isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (savedSettings) {
      const setting = savedSettings.find(s => s.key === "otp_email_enabled");
      setOtpEnabled(setting ? setting.value !== "false" : true);
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("POST", "/api/admin/settings", { key: "otp_email_enabled", value: String(enabled) });
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "OTP email " + (enabled ? "activé" : "désactivé") });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const handleToggle = () => {
    const next = !otpEnabled;
    setOtpEnabled(next);
    saveMutation.mutate(next);
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
            <h1 className="text-2xl font-bold">OTP par email</h1>
            <p className="text-muted-foreground">Vérification par code email pour retraits et envois</p>
          </div>
        </div>

        <Card className={otpEnabled ? "border-green-500/50 bg-green-500/5" : "border-orange-500/50 bg-orange-500/5"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Code de vérification par email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-3">
                {otpEnabled ? (
                  <ShieldCheck className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <ShieldOff className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">OTP email pour retraits & envois</p>
                  <p className="text-sm text-muted-foreground">
                    {otpEnabled
                      ? "Activé — l'utilisateur doit recevoir un email et saisir le code reçu pour valider un retrait ou un envoi d'argent."
                      : "Désactivé — l'utilisateur peut lancer un retrait ou un envoi sans recevoir ni saisir de code email."}
                  </p>
                </div>
              </div>
              <Switch
                checked={otpEnabled}
                onCheckedChange={handleToggle}
                disabled={saveMutation.isPending}
                data-testid="switch-otp-email"
              />
            </div>

            {!otpEnabled && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-sm text-orange-700">
                  ⚠️ La vérification par email est actuellement désactivée. Les retraits et les envois d'argent seront traités sans code de confirmation. Cela réduit la sécurité des transactions.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
