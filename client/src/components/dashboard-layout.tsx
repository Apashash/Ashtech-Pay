import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient, removeAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Link2,
  CreditCard,
  Wallet,
  History,
  Shield,
  Headphones,
  Key,
  Settings,
  LogOut,
  HelpCircle,
  BadgeCheck,
  Clock3,
  Send,
  X,
  Check,
  Coins,
  RefreshCw,
  Receipt,
  Megaphone,
  Phone,
  Wrench,
} from "lucide-react";
import { SiWhatsapp, SiFacebook } from "react-icons/si";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter, BottomSheetDescription } from "@/components/ui/bottom-sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link as RouterLink } from "wouter";

import { CurrencySelector } from "@/components/currency-selector";
import { formatCurrency, formatWalletBalance } from "@/lib/currency";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import type { SupportedCurrency } from "@shared/schema";
import { COUNTRY_CURRENCIES } from "@shared/schema";
import { useLanguage } from "@/lib/language";
import { LoadingScreen } from "@/components/loading-indicator";
import { ProfileImage } from "@/components/profile-image";
import { LanguageSwitcher } from "@/components/language-switcher";

const MENU_URLS = [
  { key: "dashboard", url: "/dashboard", icon: LayoutDashboard, imageSrc: "/sidebar-icons/dashboard.png", color: "bg-primary/10 text-primary" },
  { key: "links", url: "/dashboard/links", icon: Link2, imageSrc: "/sidebar-icons/links.png", color: "bg-blue-500/10 text-blue-500" },
  { key: "transactions", url: "/dashboard/transactions", icon: History, imageSrc: "/sidebar-icons/transactions.png", color: "bg-purple-500/10 text-purple-500" },
  { key: "deposit", url: "/dashboard/deposit", icon: CreditCard, imageSrc: "/sidebar-icons/deposit.png", color: "bg-green-500/10 text-green-500" },
  { key: "withdraw", url: "/dashboard/withdraw", icon: Wallet, imageSrc: "/sidebar-icons/withdraw.png", color: "bg-orange-500/10 text-orange-500" },
  { key: "send", url: "/dashboard/send", icon: Send, imageSrc: "/sidebar-icons/send.png", color: "bg-sky-500/10 text-sky-500" },
  { key: "wallets", url: "/dashboard/wallets", icon: Coins, imageSrc: "/sidebar-icons/wallets.png", color: "bg-teal-500/10 text-teal-500" },
] as const;

const SETTINGS_URLS = [
  { key: "kyc", url: "/dashboard/kyc", icon: Shield, imageSrc: "/sidebar-icons/kyc.png", color: "bg-green-500/10 text-green-500" },
  { key: "support", url: "/dashboard/support", icon: Headphones, imageSrc: "/sidebar-icons/support.png", color: "bg-blue-500/10 text-blue-500" },
  { key: "apiKeys", url: "/dashboard/api-keys", icon: Key, imageSrc: "/sidebar-icons/api-keys.png", color: "bg-purple-500/10 text-purple-500" },
  { key: "settings", url: "/dashboard/settings", icon: Settings, imageSrc: "/sidebar-icons/settings.png", color: "bg-slate-500/10 text-slate-500" },
  { key: "fees", url: "/dashboard/fee-details", icon: Receipt, imageSrc: "/sidebar-icons/fees.png", color: "bg-amber-500/10 text-amber-500" },
] as const;

function SidebarIconBadge({ icon: Icon, imageSrc, color, className = "" }: { icon: React.ComponentType<{ className?: string }>; imageSrc?: string; color: string; className?: string }) {
  return (
    <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${color} ${className}`}>
      {imageSrc ? (
        <img src={imageSrc} alt="" aria-hidden="true" className="h-7 w-7 object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.14)]" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
    </span>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [showKycUpdateDialog, setShowKycUpdateDialog] = useState(false);
  const { rates } = useExchangeRates();
  const { t, language } = useLanguage();

  // ── Logo click counter — admin account only ───────────────────────────────
  const [logoClickCount, setLogoClickCount] = useState(0);
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuItems = MENU_URLS.map(item => ({ title: t.sidebar[item.key], url: item.url, icon: item.icon, imageSrc: item.imageSrc, color: item.color }));

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
  });
  const settingsItems = SETTINGS_URLS
    .map(item => ({ title: t.sidebar[item.key], url: item.url, icon: item.icon, imageSrc: item.imageSrc, color: item.color }));
  const isAdminAccount = user?.role === "admin";

  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    if (!isAdminAccount) return;
    e.preventDefault();
    setLogoClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
        setLocation("/admin-panel-verify");
        return 0;
      }
      if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
      logoClickTimer.current = setTimeout(() => setLogoClickCount(0), 2000);
      return next;
    });
  }, [isAdminAccount, setLocation]);

  const { data: maintenanceData } = useQuery<{ active: boolean }>({
    queryKey: ["/api/public/maintenance"],
    staleTime: 30000,
    refetchInterval: 60000,
    queryFn: async () => {
      const res = await fetch("/api/public/maintenance");
      return res.json();
    },
  });

  const { data: wallets = [] } = useQuery<{ currency: string; balance: string }[]>({
    queryKey: ["/api/wallets"],
    enabled: !!user,
  });

  useEffect(() => {
    if (user) {
      queryClient.prefetchQuery({ queryKey: ["/api/dashboard"] });
      queryClient.prefetchQuery({ queryKey: ["/api/transactions"] });
      queryClient.prefetchQuery({ queryKey: ["/api/payment-links"] });
    }
  }, [!!user]);

  const preferredCurrency = user?.preferredCurrency || "XAF";
  const sidebarBalance = (() => {
    if (wallets.length === 0) return user?.balance || "0";
    // fxRates are XAF-direct: fxRates[currency] = how many XAF = 1 unit of that currency
    const localRate = rates[preferredCurrency] || 1;
    let total = 0;
    for (const wallet of wallets) {
      const walletRate = rates[wallet.currency] || 1;
      // Convert wallet balance to preferredCurrency: balance * walletRate (→XAF) / localRate (→preferred)
      total += parseFloat(wallet.balance || "0") * (walletRate / localRate);
    }
    return total.toFixed(preferredCurrency === "USD" || preferredCurrency === "EUR" ? 2 : 0);
  })();

  const handleKycClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocation("/dashboard/kyc-verified");
  };

  const confirmKycUpdate = () => {
    setShowKycUpdateDialog(false);
    setLocation("/dashboard/kyc");
  };

  interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    transactionId: string | null;
    isRead: boolean;
    createdAt: string | null;
  }

  const { data: notificationData } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const { data: activeGlobalMessages = [] } = useQuery<{ id: string; title: string; message: string; createdAt: string | null }[]>({
    queryKey: ["/api/global-messages/active"],
    refetchInterval: 60000,
  });

  const { data: ticketStats } = useQuery<{ unreadCount: number; totalCount: number }>({
    queryKey: ["/api/tickets/stats"],
    refetchInterval: 30000,
  });

  const hasUnreadGlobalMessage = (notificationData?.notifications ?? []).some(
    n => n.type === "global_message" && !n.isRead
  );

  const [showPusdConvert, setShowPusdConvert] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [pusdAmount, setPusdAmount] = useState("");
  const [pusdCountry, setPusdCountry] = useState("CM");
  const convertPusdMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/convert-fiat-to-pusd", {
        countryCode: pusdCountry,
        amount: parseFloat(pusdAmount),
      });
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Conversion Fiat vers pUSD réussie" });
      setShowPusdConvert(false);
      setPusdAmount("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "La conversion a échoué",
        variant: "destructive" 
      });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try { await apiRequest("POST", "/api/auth/logout"); } catch { /* ignore network errors */ }
    },
    onSuccess: () => {
      removeAuthToken();
      queryClient.clear();
      sessionStorage.removeItem("impersonatedBy");
      sessionStorage.removeItem("impersonatedUsername");
      sessionStorage.removeItem("impersonationBannerPos");
      toast({ title: "Déconnexion réussie", description: "À bientôt!" });
      // Hard redirect: forces full page reload, resets ALL React state
      window.location.href = "/";
    },
    onError: () => {
      // Even if API fails, clear local state and redirect
      removeAuthToken();
      queryClient.clear();
      sessionStorage.removeItem("impersonatedBy");
      sessionStorage.removeItem("impersonatedUsername");
      sessionStorage.removeItem("impersonationBannerPos");
      window.location.href = "/";
    },
  });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoadingScreen />;
  }

  const isPrivilegedUser = ["admin", "support", "finance"].includes(user.role);
  if (maintenanceData?.active && !isPrivilegedUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="flex items-center gap-2 mb-8">
          <img src="/logo.png" alt="AshTech Pay" className="h-28 w-auto opacity-80" />
        </div>
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
          <Wrench className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-3">Maintenance en cours</h1>
        <p className="text-muted-foreground max-w-sm leading-relaxed mb-4">
          La plateforme est momentanément en maintenance. Vous serez notifié dès qu'elle sera de nouveau disponible.
        </p>
        <p className="text-sm text-muted-foreground/70">Désolé pour la gêne occasionnée.</p>
      </div>
    );
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-dvh w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <div className="flex items-center justify-between gap-2">
              <div
                className={`flex items-center gap-2 select-none ${isAdminAccount ? "cursor-pointer" : "cursor-default"}`}
                onClick={isAdminAccount ? handleLogoClick : undefined}
                data-testid="logo-ashtech"
              >
                <img src="/logo.png" alt="AshTech Pay" className="h-12 w-auto" />
              </div>
              <SidebarTrigger
                data-testid="button-sidebar-close"
                aria-label="Fermer la sidebar"
                className="shrink-0"
              />
            </div>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <div className="mx-2 my-2 overflow-hidden rounded-2xl border border-[#1A237E] bg-[#1A237E] px-4 py-4 shadow-sm">
                <p className="mb-1 text-sm text-white/75">{t.sidebar.availableBalance}</p>
                <p className="whitespace-nowrap text-2xl font-bold text-white" data-testid="text-sidebar-balance">
                  {formatWalletBalance(sidebarBalance, preferredCurrency)}
                </p>
              </div>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="px-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.sidebar.mainMenu}</SidebarGroupLabel>
              <SidebarGroupContent className="px-2">
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url} className="h-11 rounded-xl gap-3 text-sm font-semibold group-data-[collapsible=icon]:h-9!">
                        <Link href={item.url}>
                          <SidebarIconBadge icon={item.icon} imageSrc={item.imageSrc} color={item.color} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="px-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.sidebar.settingsSupport}</SidebarGroupLabel>
              <SidebarGroupContent className="px-2">
                <SidebarMenu>
                  {settingsItems.map((item) => {
                    const badgeCount = item.url === "/dashboard/support" ? (ticketStats?.unreadCount || 0) : 0;
                    const isKyc = item.url === "/dashboard/kyc";
                    
                    if (isKyc && (user?.kycStatus === "approved" || user?.kycStatus === "verified")) {
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton 
                            isActive={location === item.url}
                            onClick={handleKycClick}
                            className="cursor-pointer h-11 rounded-xl gap-3 text-sm font-semibold group-data-[collapsible=icon]:h-9!"
                          >
                            <SidebarIconBadge icon={item.icon} imageSrc={item.imageSrc} color={item.color} />
                            <span className="flex-1">{item.title}</span>
                            <Badge className="ml-auto bg-green-500 text-white h-5 px-1.5 text-xs">
                              {t.sidebar.verified}
                            </Badge>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    if (isKyc && user?.kycStatus === "pending") {
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={location === item.url} className="h-11 rounded-xl gap-3 text-sm font-semibold group-data-[collapsible=icon]:h-9!">
                            <Link href={item.url}>
                              <SidebarIconBadge icon={item.icon} imageSrc={item.imageSrc} color="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
                              <span className="flex-1">{item.title}</span>
                              <Badge className="ml-auto bg-amber-500 text-white h-5 px-1.5 text-xs">
                                {t.sidebar.pending}
                              </Badge>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    if (isKyc && user?.kycStatus !== "approved" && user?.kycStatus !== "verified") {
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={location === item.url} className="h-11 rounded-xl gap-3 text-sm font-semibold group-data-[collapsible=icon]:h-9!">
                            <Link href={item.url}>
                              <SidebarIconBadge icon={item.icon} imageSrc={item.imageSrc} color="bg-red-500/10 text-red-500" className="animate-bell-ring" />
                              <span className="flex-1 text-red-500 font-semibold">{item.title}</span>
                              <span className="relative ml-auto flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={location === item.url} className="h-11 rounded-xl gap-3 text-sm font-semibold group-data-[collapsible=icon]:h-9!">
                          <Link href={item.url}>
                            <SidebarIconBadge icon={item.icon} imageSrc={item.imageSrc} color={item.color} />
                            <span className="flex-1">{item.title}</span>
                            {badgeCount > 0 && (
                              <Badge className="ml-auto bg-red-500 text-white h-5 min-w-5 px-1.5 text-xs">
                                {badgeCount > 9 ? "9+" : badgeCount}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 mb-2 px-2 py-2 rounded-xl hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring transition-colors"
              data-testid="link-sidebar-profile-settings"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                <ProfileImage
                  profileImagePath={user.profileImagePath}
                  alt="Photo de profil"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </Link>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-10 rounded-xl gap-3 text-red-500 hover:text-red-500 hover:bg-red-500/10" 
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <SidebarIconBadge icon={LogOut} color="bg-red-500/10 text-red-500" />
              {t.sidebar.logout}
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-background/80 backdrop-blur-md">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <LanguageSwitcher variant="compact" />
              {activeGlobalMessages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  onClick={() => setLocation("/dashboard/global-message")}
                  data-testid="button-global-message-shortcut"
                  title="Message officiel"
                >
                  <Megaphone className="w-5 h-5 text-purple-500" />
                  {hasUnreadGlobalMessage && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setLocation("/dashboard/notifications")}
                data-testid="button-user-notifications"
              >
                <img
                  src="/notification-icon.png"
                  alt=""
                  aria-hidden="true"
                  className={`w-5 h-5 object-contain ${(notificationData?.unreadCount || 0) > 0 ? "animate-bell-ring" : ""}`}
                />
                {(notificationData?.unreadCount || 0) > 0 && (
                  <>
                    <span className="absolute inset-0 rounded-full animate-ping bg-red-500/30 pointer-events-none" />
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                      {notificationData!.unreadCount > 9 ? "9+" : notificationData!.unreadCount}
                    </Badge>
                  </>
                )}
              </Button>
              <div className="relative">
                {hasUnreadGlobalMessage && (
                  <span className="absolute -inset-1.5 rounded-full bg-red-500/40 animate-ping pointer-events-none" />
                )}
                <div
                  className={`relative w-10 h-10 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors ${hasUnreadGlobalMessage ? "ring-2 ring-red-500 ring-offset-1 ring-offset-background" : ""}`}
                  onClick={() => setLocation(hasUnreadGlobalMessage ? "/dashboard/global-message" : "/dashboard/settings")}
                  data-testid="button-profile"
                >
                  <ProfileImage
                    profileImagePath={user.profileImagePath}
                    alt="Photo de profil"
                    className="w-full h-full object-cover"
                  />
                </div>
                {user.isVerified && user.kycStatus !== "pending" && user.kycStatus !== "rejected" ? (
                  <div 
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center cursor-pointer"
                    onClick={() => toast({ title: t.kyc.statusApproved, description: t.kyc.statusApprovedDesc })}
                    data-testid="badge-verified"
                  >
                    <BadgeCheck className="w-3 h-3 text-white" />
                  </div>
                ) : user.kycStatus === "pending" ? (
                  <RouterLink href="/dashboard/kyc" aria-label={t.kyc.statusPending}>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500/30 animate-pulse pointer-events-none" />
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center cursor-pointer"
                      data-testid="badge-pending"
                      title={t.kyc.statusPending}
                    >
                      <Clock3 className="w-3 h-3 text-white" />
                    </div>
                  </RouterLink>
                ) : (
                  <RouterLink href="/dashboard/kyc">
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500/40 animate-ping pointer-events-none" />
                    <div 
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center cursor-pointer animate-bounce"
                      data-testid="badge-unverified"
                    >
                      <HelpCircle className="w-3 h-3 text-white" />
                    </div>
                  </RouterLink>
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 pb-10">
            {children}
          </main>
        </div>
      </div>

      <AlertDialog open={showKycUpdateDialog} onOpenChange={setShowKycUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Compte déjà vérifié</AlertDialogTitle>
            <AlertDialogDescription>
              Votre compte est déjà vérifié. Voulez-vous mettre à jour votre KYC ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non</AlertDialogCancel>
            <AlertDialogAction onClick={confirmKycUpdate}>
              Oui
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomSheet open={showPusdConvert} onOpenChange={setShowPusdConvert}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>Conversion Fiat vers pUSD</BottomSheetTitle>
            <BottomSheetDescription>
              Convertit les fonds en monnaie locale du wallet fournisseur en pUSD pour les retraits.
            </BottomSheetDescription>
          </BottomSheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pays (Source Fiat)</Label>
              <Select value={pusdCountry} onValueChange={setPusdCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CM">Cameroun (XAF)</SelectItem>
                  <SelectItem value="SN">Sénégal (XOF)</SelectItem>
                  <SelectItem value="CI">Côte d'Ivoire (XOF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Montant Fiat</Label>
              <Input 
                type="number" 
                placeholder="Ex: 5000" 
                value={pusdAmount}
                onChange={(e) => setPusdAmount(e.target.value)}
              />
            </div>
          </div>
          <BottomSheetFooter>
            <Button variant="outline" onClick={() => setShowPusdConvert(false)}>Annuler</Button>
            <Button 
              onClick={() => convertPusdMutation.mutate()} 
              disabled={convertPusdMutation.isPending || !pusdAmount}
            >
              {convertPusdMutation.isPending ? "Conversion..." : "Convertir"}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>

      {/* Floating contact button — dashboard only */}
      {location === "/dashboard" && <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {showContactMenu && (
          <div className="flex flex-col items-end gap-2">
            <a
              href="https://whatsapp.com/channel/0029VbC5tPPCxoAveJ44Vs2w"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setShowContactMenu(false)}
              className="flex items-center gap-2.5 bg-[#25D366] text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg hover:bg-[#20bc5a] transition-all"
              data-testid="link-contact-whatsapp"
            >
              <SiWhatsapp className="w-4 h-4" />
              WhatsApp
            </a>
            <a
              href="https://www.facebook.com/share/1Eczpeowdp/?mibextid=wwXIfr"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setShowContactMenu(false)}
              className="flex items-center gap-2.5 bg-[#1877F2] text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg hover:bg-[#1460c8] transition-all"
              data-testid="link-contact-facebook"
            >
              <SiFacebook className="w-4 h-4" />
              Facebook
            </a>
            <button
              onClick={() => { setShowContactMenu(false); setLocation("/dashboard/support"); }}
              className="flex items-center gap-2.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-full shadow-lg hover:opacity-90 transition-all"
              data-testid="link-contact-support"
            >
              <Phone className="w-4 h-4" />
              Service client
            </button>
          </div>
        )}
        <button
          onClick={() => setShowContactMenu(prev => !prev)}
           className="relative flex h-16 w-16 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          data-testid="button-contact-menu"
           title={showContactMenu ? "Fermer le menu de contact" : "Nous contacter"}
           aria-label={showContactMenu ? "Fermer le menu de contact" : "Nous contacter"}
           aria-expanded={showContactMenu}
        >
           <span
             className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out ${
               showContactMenu ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
             }`}
             aria-hidden="true"
           >
             <img
               src="/support-assistant.png"
               alt=""
               className="h-16 w-16 object-contain drop-shadow-lg"
             />
           </span>
           <span
             className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out ${
               showContactMenu ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"
             }`}
             aria-hidden="true"
           >
             <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/90 shadow-lg">
               <X className="h-7 w-7 text-white" strokeWidth={2.5} />
             </span>
           </span>
        </button>
      </div>}
    </SidebarProvider>
  );
}
