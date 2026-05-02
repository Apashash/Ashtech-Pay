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
import { useLanguage } from "@/lib/language";

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
  const { t } = useLanguage();

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
      toast({ title: t.settings.profileUpdated, description: t.settings.profileUpdatedDesc });
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
      toast({ title: t.settings.accountDeleted, description: t.settings.accountDeletedDesc });
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
          <h1 className="text-2xl font-semibold text-foreground">{t.settings.title}</h1>
          <p className="text-sm text-muted-foreground">{t.settings.subtitle}</p>
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
                <BadgeCheck className="w-3.5 h-3.5" /> {t.settings.verified}
              </div>
            ) : kycPending ? (
              <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-600 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0">
                <Shield className="w-3.5 h-3.5" /> {t.settings.pendingVerif}
              </div>
            ) : (
              <Link href="/dashboard/kyc">
                <div className="flex items-center gap-1 bg-red-500/10 text-red-500 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 cursor-pointer">
                  <HelpCircle className="w-3.5 h-3.5" /> {t.settings.unverified}
                </div>
              </Link>
            )}
          </div>

          <SettingsRow icon={Mail} label={t.settings.emailLabel} value={user?.email} iconColor="text-blue-500" />
          <SettingsRow icon={Phone} label={t.settings.phoneLabel} value={user?.phone || "—"} iconColor="text-green-500" />
          <SettingsRow icon={Globe} label={t.settings.countryLabel} value={user?.country || "—"} iconColor="text-purple-500" />
        </SettingsCard>

        {/* VÉRIFICATION KYC */}
        <SectionLabel>{t.settings.verificationSection}</SectionLabel>
        <SettingsCard>
          <SettingsRow
            icon={Shield}
            label={t.settings.kycTitle}
            value={kycVerified ? t.settings.kycVerified : kycPending ? t.settings.kycPending : t.settings.kycComplete}
            iconColor={kycVerified ? "text-green-500" : kycPending ? "text-yellow-500" : "text-red-500"}
            onClick={kycVerified ? undefined : () => setLocation("/dashboard/kyc")}
            right={kycVerified ? <BadgeCheck className="w-4 h-4 text-green-500 shrink-0" /> : undefined}
            data-testid="row-kyc"
          />
        </SettingsCard>

        {/* APPARENCE */}
        <SectionLabel>{t.settings.appearanceSection}</SectionLabel>
        <SettingsCard>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Palette className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium text-foreground">{t.settings.themeLabel}</span>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${theme === "light" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="theme-light"
              >
                <Sun className="w-3.5 h-3.5" /> {t.settings.themeLight}
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${theme === "dark" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="theme-dark"
              >
                <Moon className="w-3.5 h-3.5" /> {t.settings.themeDark}
              </button>
            </div>
          </div>
        </SettingsCard>

        {/* FINANCES */}
        <SectionLabel>{t.settings.financesSection}</SectionLabel>
        <SettingsCard>
          <SettingsRow
            icon={Phone}
            label={t.settings.withdrawalNumbers}
            value={t.settings.manage}
            iconColor="text-orange-500"
            onClick={() => setLocation("/dashboard/withdrawal-numbers")}
            data-testid="row-withdrawal-numbers"
          />
        </SettingsCard>

        {/* NOTIFICATIONS */}
        <SectionLabel>{t.settings.notificationsSection}</SectionLabel>
        <SettingsCard>
          <Collapsible open={notifOpen} onOpenChange={setNotifOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left" data-testid="row-notifications">
                <Bell className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">{t.settings.notifPreferences}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform duration-200 ${notifOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border divide-y divide-border">
                {[
                  { key: "email" as const, icon: Mail, label: t.settings.notifEmail, desc: t.settings.notifEmailDesc, color: "text-blue-500" },
                  { key: "push" as const, icon: Bell, label: t.settings.notifPush, desc: t.settings.notifPushDesc, color: "text-purple-500" },
                  { key: "sms" as const, icon: Smartphone, label: t.settings.notifSms, desc: t.settings.notifSmsDesc, color: "text-green-500" },
                  { key: "marketing" as const, icon: Globe, label: t.settings.notifMarketing, desc: t.settings.notifMarketingDesc, color: "text-orange-500" },
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
                    onClick={() => toast({ title: t.settings.prefsSaved, description: t.settings.prefsSavedDesc })}
                    data-testid="button-save-notifications"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" /> {t.settings.savePrefs}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </SettingsCard>

        {/* SÉCURITÉ */}
        <SectionLabel>{t.settings.securitySection}</SectionLabel>
        <SettingsCard>
          <Collapsible open={securityOpen} onOpenChange={setSecurityOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left" data-testid="row-security">
                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">{t.settings.changePassword}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform duration-200 ${securityOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.settings.currentPassword}</Label>
                  <Input type="password" placeholder="••••••••" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} data-testid="input-current-password" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.settings.newPassword}</Label>
                  <Input type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} data-testid="input-new-password" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.settings.confirmPassword}</Label>
                  <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} data-testid="input-confirm-password" />
                </div>
                <Button size="sm" variant="outline" data-testid="button-change-password">
                  <Lock className="w-3.5 h-3.5 mr-1.5" /> {t.settings.changePasswordBtn}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
          <SettingsRow
            icon={Shield}
            label={t.settings.apiKeysLabel}
            iconColor="text-indigo-500"
            onClick={() => setLocation("/dashboard/api-keys")}
            data-testid="row-api-keys"
          />
        </SettingsCard>

        {/* DANGER ZONE */}
        <SectionLabel>{t.settings.dangerSection}</SectionLabel>
        <SettingsCard>
          <button
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-500/5 transition-colors text-left"
            onClick={() => setShowDeleteDialog(true)}
            data-testid="button-delete-account"
          >
            <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-500">{t.settings.deleteAccount}</p>
              <p className="text-xs text-muted-foreground">{t.settings.deleteAccountDesc}</p>
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
