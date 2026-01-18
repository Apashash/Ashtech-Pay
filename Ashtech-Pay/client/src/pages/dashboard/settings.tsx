import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { Settings, User as UserIcon, Bell, Shield, Globe, Smartphone, Mail, Lock, Save } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    marketing: false,
  });

  const handleSave = () => {
    toast({
      title: "Paramètres enregistrés",
      description: "Vos modifications ont été sauvegardées avec succès.",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">Gérez les paramètres de votre compte</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                Informations personnelles
              </CardTitle>
              <CardDescription>Mettez à jour vos informations de profil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom complet</Label>
                  <Input defaultValue={user?.fullName} data-testid="input-fullname" />
                </div>
                <div className="space-y-2">
                  <Label>Nom d'utilisateur</Label>
                  <Input defaultValue={user?.username} data-testid="input-username" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" defaultValue={user?.email} data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input defaultValue={user?.phone || ""} placeholder="+237 6XX XXX XXX" data-testid="input-phone" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pays</Label>
                <Select defaultValue={user?.country || "Cameroon"}>
                  <SelectTrigger data-testid="select-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cameroon">Cameroun</SelectItem>
                    <SelectItem value="Senegal">Sénégal</SelectItem>
                    <SelectItem value="Ivory Coast">Côte d'Ivoire</SelectItem>
                    <SelectItem value="Mali">Mali</SelectItem>
                    <SelectItem value="Burkina Faso">Burkina Faso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} data-testid="button-save-profile">
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
              <CardDescription>Configurez vos préférences de notification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Notifications par email</p>
                    <p className="text-sm text-muted-foreground">Recevez des alertes par email</p>
                  </div>
                </div>
                <Switch 
                  checked={notifications.email} 
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))}
                  data-testid="switch-email-notifications"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Notifications push</p>
                    <p className="text-sm text-muted-foreground">Notifications dans le navigateur</p>
                  </div>
                </div>
                <Switch 
                  checked={notifications.push} 
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, push: checked }))}
                  data-testid="switch-push-notifications"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Notifications SMS</p>
                    <p className="text-sm text-muted-foreground">Alertes par SMS</p>
                  </div>
                </div>
                <Switch 
                  checked={notifications.sms} 
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, sms: checked }))}
                  data-testid="switch-sms-notifications"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Communications marketing</p>
                    <p className="text-sm text-muted-foreground">Nouvelles et promotions</p>
                  </div>
                </div>
                <Switch 
                  checked={notifications.marketing} 
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, marketing: checked }))}
                  data-testid="switch-marketing-notifications"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Sécurité
              </CardTitle>
              <CardDescription>Gérez la sécurité de votre compte</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Mot de passe actuel</Label>
                <Input type="password" placeholder="••••••••" data-testid="input-current-password" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nouveau mot de passe</Label>
                  <Input type="password" placeholder="••••••••" data-testid="input-new-password" />
                </div>
                <div className="space-y-2">
                  <Label>Confirmer le mot de passe</Label>
                  <Input type="password" placeholder="••••••••" data-testid="input-confirm-password" />
                </div>
              </div>
              <Button variant="outline" data-testid="button-change-password">
                Changer le mot de passe
              </Button>

              <div className="border-t border-border pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Authentification à deux facteurs</p>
                      <p className="text-sm text-muted-foreground">Ajoutez une couche de sécurité supplémentaire</p>
                    </div>
                  </div>
                  <Button variant="outline" data-testid="button-enable-2fa">
                    Activer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
