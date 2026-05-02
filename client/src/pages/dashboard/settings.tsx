import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { User as UserIcon, Bell, Lock, Save, Globe, Smartphone, Mail, Loader2, Sun, Moon, Palette, AlertTriangle, Trash2, Phone, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [, setLocation] = useLocation();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState("");
  
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    marketing: false,
  });

  useEffect(() => {
    if (user && !isInitialized) {
      setFullName(user.fullName || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setCountry(user.country || "Cameroon");
      setIsInitialized(true);
    }
  }, [user, isInitialized]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { fullName: string }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées avec succès.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ fullName });
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Paramètres enregistrés",
      description: "Vos préférences de notification ont été sauvegardées.",
    });
  };

  const deleteAccountMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest("DELETE", "/api/user/account", { username });
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      toast({
        title: "Compte supprimé",
        description: "Votre compte a été supprimé avec succès.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAccount = () => {
    if (deleteConfirmUsername === user?.username) {
      deleteAccountMutation.mutate(deleteConfirmUsername);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Paramètres</h1>
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
                  <Input 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Votre nom complet"
                    data-testid="input-fullname" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom d'utilisateur</Label>
                  <Input 
                    value={user?.username || ""} 
                    disabled 
                    className="bg-muted"
                    data-testid="input-username" 
                  />
                  <p className="text-xs text-muted-foreground">Le nom d'utilisateur ne peut pas être modifié</p>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    value={email}
                    disabled
                    className="bg-muted"
                    data-testid="input-email" 
                  />
                  <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input 
                    value={phone}
                    disabled
                    className="bg-muted"
                    data-testid="input-phone" 
                  />
                  <p className="text-xs text-muted-foreground">Le téléphone ne peut pas être modifié</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pays</Label>
                <Input 
                  value={country}
                  disabled
                  className="bg-muted"
                  data-testid="input-country" 
                />
                <p className="text-xs text-muted-foreground">Le pays ne peut pas être modifié</p>
              </div>
              <Button 
                onClick={handleSaveProfile} 
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Apparence
              </CardTitle>
              <CardDescription>Choisissez le thème de l'interface</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    theme === "light" 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50"
                  }`}
                  data-testid="theme-light"
                >
                  <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                    <Sun className="w-6 h-6 text-yellow-500" />
                  </div>
                  <span className="font-medium text-foreground">Clair</span>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    theme === "dark" 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50"
                  }`}
                  data-testid="theme-dark"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <Moon className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="font-medium text-foreground">Sombre</span>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Numéros de retrait
              </CardTitle>
              <CardDescription>Gérez vos numéros de téléphone pour les retraits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div>
                  <p className="font-medium text-foreground">Configurer vos numéros</p>
                  <p className="text-sm text-muted-foreground">Ajoutez jusqu'à 2 numéros pour recevoir vos retraits</p>
                </div>
                <Link href="/dashboard/withdrawal-numbers">
                  <Button variant="outline" className="gap-2">
                    Gérer
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
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

              <Button onClick={handleSaveNotifications} variant="outline">
                <Save className="w-4 h-4 mr-2" />
                Enregistrer les préférences
              </Button>
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
                <Lock className="w-4 h-4 mr-2" />
                Changer le mot de passe
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                Zone Danger
              </CardTitle>
              <CardDescription>Actions irréversibles sur votre compte</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                <h4 className="font-medium text-red-500 mb-2">Supprimer mon compte définitivement</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Cette action supprimera définitivement votre compte et toutes vos données. Cette action est irréversible.
                </p>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid="button-delete-account"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer mon compte
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Supprimer votre compte définitivement
            </DialogTitle>
            <DialogDescription>
              Voulez-vous supprimer définitivement votre compte ? Cette action est irréversible et supprimera toutes vos données.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Entrez votre nom d'utilisateur pour confirmer</Label>
              <Input 
                placeholder={user?.username || "Votre nom d'utilisateur"}
                value={deleteConfirmUsername}
                onChange={(e) => setDeleteConfirmUsername(e.target.value)}
                data-testid="input-delete-confirm-username"
              />
              <p className="text-xs text-muted-foreground">
                Tapez <span className="font-mono text-foreground">{user?.username}</span> pour confirmer
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setDeleteConfirmUsername("");
            }}>
              Non, annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount}
              disabled={deleteConfirmUsername !== user?.username || deleteAccountMutation.isPending}
              data-testid="button-confirm-delete-account"
            >
              {deleteAccountMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Oui, supprimer mon compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
