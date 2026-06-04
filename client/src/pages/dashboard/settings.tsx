import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BottomSheet, BottomSheetContent, BottomSheetDescription, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient, setAuthToken } from "@/lib/queryClient";
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
  Monitor,
  Tablet,
  LogOut,
  MapPin,
  Clock,
  KeyRound,
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

interface DeviceSession {
  id: string;
  isCurrent: boolean;
  ip: string;
  device: string;
  browser: string;
  loginAt: string | null;
  expire: string;
}

function DeviceIcon({ device }: { device: string }) {
  if (device === "Mobile") return <Smartphone className="w-5 h-5 text-muted-foreground" />;
  if (device === "Tablette") return <Tablet className="w-5 h-5 text-muted-foreground" />;
  return <Monitor className="w-5 h-5 text-muted-foreground" />;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Heure inconnue";
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return `Il y a ${Math.floor(diff / 86400)} j`;
}

function ConnectedDevicesSection() {
  const { toast } = useToast();
  const { data: sessions, isLoading, refetch } = useQuery<DeviceSession[]>({
    queryKey: ["/api/user/sessions"],
    refetchOnWindowFocus: true,
  });

  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const disconnectOneMutation = useMutation({
    mutationFn: async (sid: string) => {
      const res = await apiRequest("DELETE", `/api/user/sessions/${sid}`);
      return res.json();
    },
    onSuccess: (_data, sid) => {
      setDisconnectingId(null);
      refetch();
      toast({
        title: "Appareil déconnecté",
        description: "L'appareil a été déconnecté avec succès.",
      });
    },
    onError: () => {
      setDisconnectingId(null);
      toast({ title: "Erreur", description: "Impossible de déconnecter cet appareil.", variant: "destructive" });
    },
  });

  const disconnectAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/user/sessions/others");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.token) setAuthToken(data.token);
      refetch();
      toast({
        title: "Appareils déconnectés",
        description: data.count > 0
          ? `${data.count} autre(s) appareil(s) déconnecté(s).`
          : "Aucun autre appareil connecté.",
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de déconnecter les appareils.", variant: "destructive" });
    },
  });

  const otherCount = (sessions || []).filter(s => !s.isCurrent).length;

  return (
    <>
      <SectionLabel>Appareils connectés</SectionLabel>
      <SettingsCard>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted-foreground">Aucune session active trouvée.</div>
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                <DeviceIcon device={s.device} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">
                      {s.device} · {s.browser}
                    </p>
                    {s.isCurrent && (
                      <span className="text-[10px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5">
                        Cet appareil
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" /> {s.ip}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /> {formatRelativeTime(s.loginAt)}
                    </span>
                  </div>
                </div>
                {!s.isCurrent && (
                  <button
                    className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    onClick={() => {
                      setDisconnectingId(s.id);
                      disconnectOneMutation.mutate(s.id);
                    }}
                    disabled={disconnectingId === s.id || disconnectAllMutation.isPending}
                    title="Déconnecter cet appareil"
                    data-testid={`button-disconnect-device-${s.id}`}
                  >
                    {disconnectingId === s.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <LogOut className="w-4 h-4" />}
                  </button>
                )}
              </div>
            ))}
            {otherCount > 0 && (
              <div className="px-4 py-3">
                <button
                  className="flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  onClick={() => disconnectAllMutation.mutate()}
                  disabled={disconnectAllMutation.isPending || disconnectingId !== null}
                  data-testid="button-disconnect-others"
                >
                  {disconnectAllMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <LogOut className="w-4 h-4" />}
                  Déconnecter tous les autres appareils ({otherCount})
                </button>
              </div>
            )}
          </div>
        )}
      </SettingsCard>
    </>
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
  const [showOtpSheet, setShowOtpSheet] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [showSuccessSheet, setShowSuccessSheet] = useState(false);

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

  const requestPasswordChangeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/password-change/request", {
        currentPassword,
        newPassword,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur");
      return data;
    },
    onSuccess: () => {
      setShowOtpSheet(true);
      setOtpValue("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const confirmPasswordChangeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/password-change/confirm", { otp: otpValue });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur");
      return data;
    },
    onSuccess: () => {
      setShowOtpSheet(false);
      setShowSuccessSheet(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtpValue("");
      setSecurityOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Code incorrect", description: error.message, variant: "destructive" });
    },
  });

  function handleChangePasswordClick() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Erreur", description: "Le nouveau mot de passe doit contenir au moins 6 caractères.", variant: "destructive" });
      return;
    }
    requestPasswordChangeMutation.mutate();
  }

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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleChangePasswordClick}
                  disabled={requestPasswordChangeMutation.isPending}
                  data-testid="button-change-password"
                >
                  {requestPasswordChangeMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Lock className="w-3.5 h-3.5 mr-1.5" />}
                  {t.settings.changePasswordBtn}
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

        {/* APPAREILS CONNECTÉS */}
        <ConnectedDevicesSection />

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

      <BottomSheet open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t.settings.deleteDialogTitle}
            </BottomSheetTitle>
            <BottomSheetDescription>
              {t.settings.deleteDialogDesc}
            </BottomSheetDescription>
          </BottomSheetHeader>
          <div className="py-4 space-y-3">
            <Label className="text-sm">{t.settings.deleteConfirmLabel}</Label>
            <Input
              placeholder={user?.username || ""}
              value={deleteConfirmUsername}
              onChange={(e) => setDeleteConfirmUsername(e.target.value)}
              data-testid="input-delete-confirm-username"
            />
            <p className="text-xs text-muted-foreground">
              {t.settings.deleteConfirmHint} <span className="font-mono text-foreground">{user?.username}</span> {t.settings.deleteConfirmHint2}
            </p>
          </div>
          <BottomSheetFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeleteConfirmUsername(""); }}>
              {t.settings.cancelDelete}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteAccountMutation.mutate(deleteConfirmUsername)}
              disabled={deleteConfirmUsername !== user?.username || deleteAccountMutation.isPending}
              data-testid="button-confirm-delete-account"
            >
              {deleteAccountMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {t.settings.confirmDelete}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>

      {/* OTP Confirmation Sheet */}
      <BottomSheet open={showOtpSheet} onOpenChange={(open) => { if (!open) { setShowOtpSheet(false); setOtpValue(""); } }}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Confirmer le changement
            </BottomSheetTitle>
            <BottomSheetDescription>
              Un code à 4 chiffres a été envoyé à votre adresse email. Entrez-le ci-dessous pour confirmer le changement de mot de passe.
            </BottomSheetDescription>
          </BottomSheetHeader>
          <div className="py-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Code OTP</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="• • • •"
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="text-center text-2xl font-bold tracking-[0.5em] h-14"
                autoFocus
                data-testid="input-password-otp"
              />
              <p className="text-xs text-muted-foreground text-center">Ce code expire dans 10 minutes.</p>
            </div>
          </div>
          <BottomSheetFooter>
            <Button variant="outline" onClick={() => { setShowOtpSheet(false); setOtpValue(""); }}>
              Annuler
            </Button>
            <Button
              onClick={() => confirmPasswordChangeMutation.mutate()}
              disabled={otpValue.length !== 4 || confirmPasswordChangeMutation.isPending}
              data-testid="button-confirm-otp"
            >
              {confirmPasswordChangeMutation.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Check className="w-4 h-4 mr-2" />}
              Confirmer
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>

      {/* Success Sheet */}
      <BottomSheet open={showSuccessSheet} onOpenChange={setShowSuccessSheet}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              Mot de passe modifié avec succès
            </BottomSheetTitle>
            <BottomSheetDescription>
              Votre mot de passe a été mis à jour. Vous pouvez maintenant utiliser votre nouveau mot de passe pour vous connecter.
            </BottomSheetDescription>
          </BottomSheetHeader>
          <div className="h-2" />
          <BottomSheetFooter>
            <Button className="w-full" onClick={() => setShowSuccessSheet(false)}>
              Fermer
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </DashboardLayout>
  );
}
