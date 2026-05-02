import { DashboardLayout } from "@/components/dashboard-layout";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import {
  User as UserIcon,
  Bell,
  Lock,
  Save,
  Globe,
  Smartphone,
  Mail,
  Loader2,
  Sun,
  Moon,
  Palette,
  AlertTriangle,
  Trash2,
  Phone,
  ChevronRight,
  ChevronDown,
  Shield,
  BadgeCheck,
  HelpCircle,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground select-none">
      {children}
    </p>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  onClick,
  right,
  iconColor,
  "data-testid": testId,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  onClick?: () => void;
  right?: React.ReactNode;
  iconColor?: string;
  "data-testid"?: string;
}) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left disabled:cursor-default"
      onClick={onClick}
      disabled={!onClick}
      data-testid={testId}
    >
      <Icon className={`w-4 h-4 shrink-0 ${iconColor || "text-muted-foreground"}`} />
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      {value && <span className="text-sm text-muted-foreground mr-1 truncate max-w-[40%] text-right">{value}</span>}
      {right !== undefined ? right : onClick ? <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" /> : null}
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-border mx-4" />;
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [, setLocation] = useLocation();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });

  const [fullName, setFullName] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState("");

  const [notifOpen, setNotifOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    marketing: false,
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user && !isInitialized) {
      setFullName(user.fullName || "");
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
      setEditingName(false);
      toast({ title: "Profil mis à jour", description: "Nom enregistré avec succès." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest("DELETE", "/api/user/account", { username });
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      toast({ title: "Compte supprimé", description: "Votre compte a été supprimé avec succès." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const kycVerified = user?.isVerified || user?.kycStatus === "approved" || user?.kycStatus === "verified";
  const kycPending = user?.kycStatus === "pending";

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto pb-10">
        <div className="px-4 pt-2 pb-4">
          <h1 className="text-2xl font-semibold text-foreground">Paramètres</h1>
          <p className="text-sm text-muted-foreground">Gérez les paramètres de votre compte</p>
        </div>

        {/* PROFIL */}
        <SectionLabel>Profil</SectionLabel>
        <SettingsCard>
          {/* Avatar + nom */}
          <div className="flex items-center gap-4 px-4 py-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <UserIcon className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-fullname"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-green-500"
                    onClick={() => updateProfileMutation.mutate({ fullName })}
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => { setEditingName(false); setFullName(user?.fullName || ""); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground truncate">{user?.fullName}</p>
                  <button onClick={() => setEditingName(true)} data-testid="button-edit-name" className="text-muted-foreground hover:text-primary transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
            </div>
            {kycVerified ? (
              <div className="flex items-center gap-1 bg-green-500/10 text-green-600 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0">
                <BadgeCheck className="w-3.5 h-3.5" /> Vérifié
              </div>
            ) : kycPending ? (
              <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-600 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0">
                <Shield className="w-3.5 h-3.5" /> En attente
              </div>
            ) : (
              <Link href="/dashboard/kyc">
                <div className="flex items-center gap-1 bg-red-500/10 text-red-500 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 cursor-pointer">
                  <HelpCircle className="w-3.5 h-3.5" /> Non vérifié
                </div>
              </Link>
            )}
          </div>

          <SettingsRow icon={Mail} label="Email" value={user?.email} iconColor="text-blue-500" />
          <SettingsRow icon={Phone} label="Téléphone" value={user?.phone || "—"} iconColor="text-green-500" />
          <SettingsRow icon={Globe} label="Pays" value={user?.country || "—"} iconColor="text-purple-500" />
        </SettingsCard>

        {/* VÉRIFICATION KYC */}
        <SectionLabel>Vérification</SectionLabel>
        <SettingsCard>
          <SettingsRow
            icon={Shield}
            label="Vérification KYC"
            value={kycVerified ? "Vérifié" : kycPending ? "En attente" : "Compléter"}
            iconColor={kycVerified ? "text-green-500" : kycPending ? "text-yellow-500" : "text-red-500"}
            onClick={kycVerified ? undefined : () => setLocation("/dashboard/kyc")}
            right={kycVerified ? <BadgeCheck className="w-4 h-4 text-green-500 shrink-0" /> : undefined}
            data-testid="row-kyc"
          />
        </SettingsCard>

        {/* APPARENCE */}
        <SectionLabel>Apparence</SectionLabel>
        <SettingsCard>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Palette className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium text-foreground">Thème</span>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${theme === "light" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="theme-light"
              >
                <Sun className="w-3.5 h-3.5" /> Clair
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${theme === "dark" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="theme-dark"
              >
                <Moon className="w-3.5 h-3.5" /> Sombre
              </button>
            </div>
          </div>
        </SettingsCard>

        {/* FINANCES */}
        <SectionLabel>Finances</SectionLabel>
        <SettingsCard>
          <SettingsRow
            icon={Phone}
            label="Numéros de retrait"
            value="Gérer"
            iconColor="text-orange-500"
            onClick={() => setLocation("/dashboard/withdrawal-numbers")}
            data-testid="row-withdrawal-numbers"
          />
        </SettingsCard>

        {/* NOTIFICATIONS */}
        <SectionLabel>Notifications</SectionLabel>
        <SettingsCard>
          <Collapsible open={notifOpen} onOpenChange={setNotifOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left" data-testid="row-notifications">
                <Bell className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">Préférences de notification</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform duration-200 ${notifOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border divide-y divide-border">
                {[
                  { key: "email" as const, icon: Mail, label: "Notifications email", desc: "Alertes par email", color: "text-blue-500" },
                  { key: "push" as const, icon: Bell, label: "Notifications push", desc: "Alertes dans le navigateur", color: "text-purple-500" },
                  { key: "sms" as const, icon: Smartphone, label: "Notifications SMS", desc: "Alertes par SMS", color: "text-green-500" },
                  { key: "marketing" as const, icon: Globe, label: "Communications marketing", desc: "Nouvelles et promotions", color: "text-orange-500" },
                ].map(({ key, icon: Icon, label, desc, color }) => (
                  <div key={key} className="flex items-center gap-3 px-4 py-3.5 bg-muted/20">
                    <Icon className={`w-4 h-4 ${color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={notifications[key]}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, [key]: checked }))}
                      data-testid={`switch-${key}-notifications`}
                    />
                  </div>
                ))}
                <div className="px-4 py-3 bg-muted/20">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast({ title: "Préférences enregistrées", description: "Vos préférences de notification ont été sauvegardées." })}
                    data-testid="button-save-notifications"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" /> Enregistrer
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </SettingsCard>

        {/* SÉCURITÉ */}
        <SectionLabel>Sécurité & API</SectionLabel>
        <SettingsCard>
          <Collapsible open={securityOpen} onOpenChange={setSecurityOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left" data-testid="row-security">
                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">Changer le mot de passe</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform duration-200 ${securityOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Mot de passe actuel</Label>
                  <Input type="password" placeholder="••••••••" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} data-testid="input-current-password" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nouveau mot de passe</Label>
                  <Input type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} data-testid="input-new-password" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Confirmer le mot de passe</Label>
                  <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} data-testid="input-confirm-password" />
                </div>
                <Button size="sm" variant="outline" data-testid="button-change-password">
                  <Lock className="w-3.5 h-3.5 mr-1.5" /> Changer le mot de passe
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
          <SettingsRow
            icon={Shield}
            label="Clés API & Développeur"
            iconColor="text-indigo-500"
            onClick={() => setLocation("/dashboard/api-keys")}
            data-testid="row-api-keys"
          />
        </SettingsCard>

        {/* DANGER ZONE */}
        <SectionLabel>Zone Danger</SectionLabel>
        <SettingsCard>
          <button
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-500/5 transition-colors text-left"
            onClick={() => setShowDeleteDialog(true)}
            data-testid="button-delete-account"
          >
            <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-500">Supprimer mon compte</p>
              <p className="text-xs text-muted-foreground">Action irréversible</p>
            </div>
            <ChevronRight className="w-4 h-4 text-red-500/40 shrink-0" />
          </button>
        </SettingsCard>

        <div className="h-8" />
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Supprimer votre compte définitivement
            </DialogTitle>
            <DialogDescription>
              Cette action est irréversible et supprimera toutes vos données.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label className="text-sm">Entrez votre nom d'utilisateur pour confirmer</Label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeleteConfirmUsername(""); }}>
              Non, annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteAccountMutation.mutate(deleteConfirmUsername)}
              disabled={deleteConfirmUsername !== user?.username || deleteAccountMutation.isPending}
              data-testid="button-confirm-delete-account"
            >
              {deleteAccountMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Oui, supprimer mon compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
