import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";
import { QRCodeSVG } from "qrcode.react";
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Globe, 
  Settings,
  Shield,
  MessageSquare,
  DollarSign,
  Link2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  X,
  Menu,
  Phone,
  ArrowDownCircle,
  ArrowUpCircle,
  Send,
  Bell,
  Clock,
  UserCheck,
  ArrowLeftRight,
  RefreshCw,
  Zap,
  Code2,
  Mail,
  Loader2,
  ShieldBan,
  Smartphone,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { User } from "@shared/schema";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  subItems?: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }[];
}

interface Notification {
  id: string;
  type: string;
  amount: string;
  userName: string;
  createdAt: string | null;
}

const typeLabels: Record<string, string> = {
  deposit: "Dépôt",
  withdrawal: "Retrait",
  transfer_out: "Envoi",
  payment_link: "Lien de paiement",
};

const typeColors: Record<string, string> = {
  deposit: "text-green-500",
  withdrawal: "text-orange-500",
  transfer_out: "text-blue-500",
  payment_link: "text-purple-500",
};

const ADMIN = import.meta.env.VITE_ADMIN_PATH as string;

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: ADMIN },
  { icon: Users, label: "Utilisateurs", href: `${ADMIN}/users` },
  { icon: UserCheck, label: "Vérifications KYC", href: `${ADMIN}/kyc` },
  { 
    icon: CreditCard, 
    label: "Transactions",
    subItems: [
      { icon: ArrowDownCircle, label: "Dépôts", href: `${ADMIN}/transactions/deposits` },
      { icon: ArrowUpCircle, label: "Retraits", href: `${ADMIN}/transactions/withdrawals` },
      { icon: Send, label: "Envois", href: `${ADMIN}/transactions/transfers` },
    ]
  },
  { icon: Clock, label: "Paiements en attente", href: `${ADMIN}/pending-payouts` },
  { icon: Phone, label: "Numéros de retrait", href: `${ADMIN}/withdrawal-numbers` },
  { 
    icon: DollarSign, 
    label: "Frais",
    subItems: [
      { icon: ArrowDownCircle, label: "Frais Dépôt", href: `${ADMIN}/fees/deposits` },
      { icon: ArrowUpCircle, label: "Frais Retrait", href: `${ADMIN}/fees/withdrawals` },
      { icon: Send, label: "Frais Envoi", href: `${ADMIN}/fees/transfers` },
    ]
  },
  { icon: ArrowLeftRight, label: "Conversions", href: `${ADMIN}/conversions` },
  { icon: Globe, label: "Pays & Opérateurs", href: `${ADMIN}/countries` },
  { icon: Zap, label: "AfribaPay", href: `${ADMIN}/afribapay` },
  { icon: Zap, label: "PixPay", href: `${ADMIN}/pixpay` },
  { icon: Mail, label: "Campagnes Email", href: `${ADMIN}/email-campaigns` },
  { icon: Code2, label: "Gestion des API", href: `${ADMIN}/api-management` },
  { icon: Link2, label: "Liens de paiement", href: `${ADMIN}/links` },
  { icon: MessageSquare, label: "Message Global", href: `${ADMIN}/global-messages` },
  { icon: MessageSquare, label: "Support", href: `${ADMIN}/support` },
  { icon: ShieldBan, label: "IPs Bloquées", href: `${ADMIN}/blocked-ips` },
  { icon: Shield, label: "Logs & Sécurité", href: `${ADMIN}/logs` },
  { icon: Shield, label: "Audit Sécurité", href: `${ADMIN}/audit` },
  { icon: Smartphone, label: "Diagnostic Sessions", href: `${ADMIN}/session-debug` },
  { icon: Settings, label: "Paramètres", href: `${ADMIN}/settings` },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Force light mode for the entire admin panel
  useLayoutEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => {
      if (hadDark) root.classList.add("dark");
    };
  }, []);

  const [sidebarOpen, setSidebarOpenState] = useState(() => {
    const stored = localStorage.getItem("admin_sidebar_open");
    return stored === null ? true : stored === "true";
  });

  const setSidebarOpen = (open: boolean) => {
    setSidebarOpenState(open);
    localStorage.setItem("admin_sidebar_open", String(open));
  };
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  // ─── TOTP setup modal ────────────────────────────────────────────────────────
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpSetupUri, setTotpSetupUri] = useState("");
  const [totpSetupSecret, setTotpSetupSecret] = useState("");
  const [totpSetupConfirmCode, setTotpSetupConfirmCode] = useState("");
  const [totpSetupError, setTotpSetupError] = useState("");
  const [totpSetupStep, setTotpSetupStep] = useState<"qr" | "done">("qr");
  const [totpSecretCopied, setTotpSecretCopied] = useState(false);
  const [showTotpDisable, setShowTotpDisable] = useState(false);
  const [totpDisableCode, setTotpDisableCode] = useState("");
  const [totpDisableError, setTotpDisableError] = useState("");

  const setupTotpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/totp/setup", {});
      return await res.json() as { uri: string; secret: string };
    },
    onSuccess: (data) => {
      setTotpSetupUri(data.uri);
      setTotpSetupSecret(data.secret);
      setTotpSetupStep("qr");
      setTotpSetupError("");
      setTotpSetupConfirmCode("");
    },
    onError: (err: Error) => {
      setTotpSetupError(err.message || "Erreur lors de la génération");
    },
  });

  const confirmTotpMutation = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest("POST", "/api/admin/totp/confirm", { code });
    },
    onSuccess: () => {
      setTotpSetupStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/totp/status"] });
    },
    onError: (err: Error) => {
      setTotpSetupError(err.message || "Code incorrect");
    },
  });

  const disableTotpMutation = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest("POST", "/api/admin/totp/disable", { code });
    },
    onSuccess: () => {
      setShowTotpDisable(false);
      setTotpDisableCode("");
      setTotpDisableError("");
      toast({ title: "TOTP désactivé", description: "L'authentificator a été retiré." });
    },
    onError: (err: Error) => {
      setTotpDisableError(err.message || "Code incorrect");
    },
  });

  const { toast } = useToast();
  const [showPusdConvert, setShowPusdConvert] = useState(false);
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

  const [conversionSeenAt, setConversionSeenAt] = useState<string>(() =>
    localStorage.getItem("ashtech_conv_seen_at") || new Date(0).toISOString()
  );

  const { data: layoutStats } = useQuery<{
    pendingDeposits: number;
    pendingWithdrawals: number;
    pendingTransfers: number;
    pendingManualPayouts: number;
    kycPending: number;
    ticketUnread: number;
    conversionCount: number;
    withdrawalNumberCount: number;
    notifications: Notification[];
    latestConversionAt: string | null;
  }>({
    queryKey: ["/api/admin/layout-stats"],
    refetchInterval: 12000,
    enabled: !!user,
  });

  const notifications = layoutStats?.notifications || [];

  const hasNewConversion = !!(
    layoutStats?.conversionCount &&
    layoutStats?.latestConversionAt &&
    layoutStats.latestConversionAt > conversionSeenAt
  );

  const pendingCounts: Record<string, number> = {
    [`${ADMIN}/transactions/deposits`]: layoutStats?.pendingDeposits || 0,
    [`${ADMIN}/transactions/withdrawals`]: layoutStats?.pendingWithdrawals || 0,
    [`${ADMIN}/transactions/transfers`]: layoutStats?.pendingTransfers || 0,
    [`${ADMIN}/pending-payouts`]: layoutStats?.pendingManualPayouts || 0,
    [`${ADMIN}/kyc`]: layoutStats?.kycPending || 0,
    [`${ADMIN}/support`]: layoutStats?.ticketUnread || 0,
    [`${ADMIN}/conversions`]: hasNewConversion ? (layoutStats?.conversionCount || 0) : 0,
    [`${ADMIN}/withdrawal-numbers`]: layoutStats?.withdrawalNumberCount || 0,
  };

  useEffect(() => {
    if (location === `${ADMIN}/conversions`) {
      const now = new Date().toISOString();
      localStorage.setItem("ashtech_conv_seen_at", now);
      setConversionSeenAt(now);
    }
  }, [location]);

  useEffect(() => {
    const transactionSubItem = menuItems.find(item => item.subItems)?.subItems?.find(
      sub => location.startsWith(sub.href)
    );
    if (transactionSubItem) {
      setOpenSubmenu("Transactions");
    }
  }, [location]);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    } else if (!isLoading && user && !["admin", "support", "finance"].includes(user.role)) {
      setLocation("/dashboard");
    }
  }, [isLoading, user, setLocation]);

  // ─── Admin IP Whitelist polling — every 3s ───────────────────────────────────
  // If the server-side whitelist is active and our IP is no longer allowed,
  // the server returns { kicked: true } → force logout + redirect.
  useEffect(() => {
    if (!user || !["admin", "support", "finance"].includes((user as any).role)) return;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/admin/ip-check", {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        if (cancelled) return;
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data.kicked || data.ipBlocked) {
            queryClient.clear();
            localStorage.removeItem("ashtech_auth_token");
            window.location.href = "/login?kicked=ip";
          }
        }
      } catch { /* network error — ignore, will retry */ }
    };

    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || !["admin", "support", "finance"].includes(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-background">
      {/* Mobile backdrop — closes sidebar when tapping outside */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={cn(
        "border-r border-border bg-card flex flex-col transition-all duration-300",
        // On mobile: fixed overlay; on desktop: static flex column
        "fixed inset-y-0 left-0 z-50 md:relative md:inset-auto md:z-auto",
        sidebarOpen ? "w-64" : "w-0 overflow-hidden"
      )}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">Admin Panel</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSidebarOpen(false)}
            data-testid="button-close-sidebar"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              if (item.subItems) {
                const isSubmenuActive = item.subItems.some(sub => location.startsWith(sub.href));
                const isOpen = openSubmenu === item.label;
                const totalPending = item.label === "Transactions" 
                  ? (layoutStats?.pendingDeposits || 0) + (layoutStats?.pendingWithdrawals || 0) + (layoutStats?.pendingTransfers || 0)
                  : 0;
                
                return (
                  <Collapsible 
                    key={item.label} 
                    open={isOpen}
                    onOpenChange={(open) => setOpenSubmenu(open ? item.label : null)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant={isSubmenuActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-between gap-2",
                          isSubmenuActive && "bg-primary/10 text-primary"
                        )}
                        data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        <span className="flex items-center gap-3">
                          <item.icon className="w-4 h-4" />
                          {item.label}
                        </span>
                        <span className="flex items-center gap-2">
                          {totalPending > 0 && (
                            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs h-5 min-w-5 px-1.5">
                              {totalPending}
                            </Badge>
                          )}
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </span>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 space-y-1 mt-1">
                      {item.subItems.map((subItem) => {
                        const isSubActive = location === subItem.href || location.startsWith(subItem.href);
                        const pendingCount = pendingCounts[subItem.href] || 0;
                        return (
                          <Link key={subItem.href} href={subItem.href}>
                            <Button
                              variant={isSubActive ? "secondary" : "ghost"}
                              size="sm"
                              className={cn(
                                "w-full justify-between gap-2",
                                isSubActive && "bg-primary/10 text-primary"
                              )}
                              data-testid={`admin-nav-${subItem.label.toLowerCase().replace(/\s/g, "-")}`}
                              onClick={() => setSidebarOpen(false)}
                            >
                              <span className="flex items-center gap-3">
                                <subItem.icon className="w-4 h-4" />
                                {subItem.label}
                              </span>
                              {pendingCount > 0 && (
                                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs h-5 min-w-5 px-1.5">
                                  {pendingCount}
                                </Badge>
                              )}
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }
              
              const isActive = location === item.href || 
                (item.href !== ADMIN && item.href && location.startsWith(item.href));
              const itemPendingCount = pendingCounts[item.href || ""] || 0;
              return (
                <Link key={item.href || item.label} href={item.href || "#"}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-between gap-3",
                      isActive && "bg-primary/10 text-primary"
                    )}
                    data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    {itemPendingCount > 0 && (
                      <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs h-5 min-w-5 px-1.5">
                        {itemPendingCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3"
              onClick={() => setShowPusdConvert(true)}
            >
              <RefreshCw className="w-4 h-4" />
              FTPUSD
            </Button>
          </nav>
        </ScrollArea>

        <div className="p-3 border-t border-border space-y-2">
          {/* TOTP Security Button */}
          <Button
            variant="ghost"
            className={cn("w-full justify-start gap-3 px-3 text-sm", "text-muted-foreground hover:text-foreground")}
            onClick={() => {
              setShowTotpSetup(true);
              setTotpSetupStep("qr");
              setTotpSetupUri("");
              setTotpSetupSecret("");
              setTotpSetupError("");
              setupTotpMutation.mutate();
            }}
            data-testid="button-totp-setup"
          >
            <><Smartphone className="w-4 h-4" /> Authenticator</>
          
          </Button>
          <Link href="/dashboard">
            <Button 
              variant="outline" 
              className="w-full gap-2" 
              data-testid="button-back-to-app"
              onClick={() => setSidebarOpen(false)}
            >
              <ChevronLeft className="w-4 h-4" />
              Retour à l'app
            </Button>
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center px-4 gap-4">
          {!sidebarOpen && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSidebarOpen(true)}
              data-testid="button-open-sidebar"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          <span className="text-sm text-muted-foreground">Administration Ashtech Pay</span>
          
          <div className="ml-auto flex items-center gap-4">
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                  <Bell className={`w-5 h-5 ${(notifications.length + (layoutStats?.ticketUnread || 0)) > 0 ? "animate-bell-ring text-red-500" : ""}`} />
                  {(notifications.length + (layoutStats?.ticketUnread || 0)) > 0 && (
                    <>
                      <span className="absolute inset-0 rounded-full animate-ping bg-red-500/30 pointer-events-none" />
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                        {(notifications.length + (layoutStats?.ticketUnread || 0)) > 9 ? "9+" : notifications.length + (layoutStats?.ticketUnread || 0)}
                      </Badge>
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                {(layoutStats?.ticketUnread || 0) > 0 && (
                  <>
                    <div className="p-3 border-b border-border">
                      <h4 className="font-semibold flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                        Messages Support non lus
                      </h4>
                    </div>
                    <Link href={`${ADMIN}/support`} onClick={() => { setNotificationsOpen(false); setSidebarOpen(false); }}>
                      <div className="p-3 hover-elevate cursor-pointer flex items-center justify-between gap-2 border-b border-border">
                        <div>
                          <span className="text-sm font-medium text-blue-500">
                            {layoutStats!.ticketUnread} message{layoutStats!.ticketUnread > 1 ? "s" : ""} non lu{layoutStats!.ticketUnread > 1 ? "s" : ""}
                          </span>
                          <p className="text-xs text-muted-foreground">Cliquez pour voir les conversations</p>
                        </div>
                        <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 shrink-0">
                          {layoutStats!.ticketUnread}
                        </Badge>
                      </div>
                    </Link>
                  </>
                )}
                <div className="p-3 border-b border-border">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Transactions en attente
                  </h4>
                </div>
                <ScrollArea className="max-h-64">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Aucune transaction en attente
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {notifications.map((notif) => (
                        <Link 
                          key={notif.id} 
                          href={notif.type === "deposit" || notif.type === "payment_link" 
                            ? `/admin/transactions/deposits?highlight=${notif.id}` 
                            : notif.type === "withdrawal" 
                              ? `/admin/transactions/withdrawals?highlight=${notif.id}` 
                              : `/admin/transactions/transfers?highlight=${notif.id}`}
                          onClick={() => setNotificationsOpen(false)}
                        >
                          <div className="p-3 hover-elevate cursor-pointer">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm font-medium ${typeColors[notif.type] || "text-foreground"}`}>
                                {typeLabels[notif.type] || notif.type}
                              </span>
                              <span className="text-sm font-bold">
                                {formatCurrency(notif.amount, "XAF")}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {notif.userName}
                              </span>
                              {notif.createdAt && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(notif.createdAt), "dd/MM HH:mm", { locale: fr })}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <div className="text-sm">
              <span className="text-muted-foreground">Connecté: </span>
              <span className="font-medium">{user.fullName}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* ── TOTP Setup Modal ─────────────────────────────────────────────────── */}
      <Dialog open={showTotpSetup} onOpenChange={(open) => { setShowTotpSetup(open); if (!open) { setTotpSetupStep("qr"); setTotpSetupUri(""); setTotpSetupSecret(""); setTotpSetupConfirmCode(""); setTotpSetupError(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              {totpSetupStep === "done" ? "Authenticator activé !" : "Activer l'Authenticator"}
            </DialogTitle>
            <DialogDescription>
              {totpSetupStep === "done"
                ? "Google Authenticator est maintenant actif. Vous en aurez besoin à chaque connexion au panel admin."
                : "Scannez le QR code avec Google Authenticator ou Authy, puis confirmez avec le code généré."}
            </DialogDescription>
          </DialogHeader>

          {totpSetupStep === "done" ? (
            <div className="py-6 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">À partir de maintenant, chaque connexion au panel admin nécessitera votre application Authenticator.</p>
              <Button className="w-full" onClick={() => setShowTotpSetup(false)}>Fermer</Button>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {setupTotpMutation.isPending && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                  </div>
                  <p className="text-xs text-muted-foreground">Génération du secret…</p>
                </div>
              )}

              {totpSetupUri && !setupTotpMutation.isPending && (
                <>
                  {/* Step 1: QR Code */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">1. Scannez ce QR code</p>
                    <div className="flex justify-center p-4 bg-white rounded-2xl border border-border">
                      <QRCodeSVG value={totpSetupUri} size={180} level="M" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Ou entrez ce code manuellement :</p>
                      <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2">
                        <code className="text-xs font-mono flex-1 break-all select-all text-foreground">{totpSetupSecret}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => { navigator.clipboard.writeText(totpSetupSecret); setTotpSecretCopied(true); setTimeout(() => setTotpSecretCopied(false), 2000); }}
                          data-testid="button-copy-totp-secret"
                        >
                          {totpSecretCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Confirm code */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">2. Entrez le code généré pour confirmer</p>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={totpSetupConfirmCode}
                      onChange={(e) => { setTotpSetupConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setTotpSetupError(""); }}
                      className="text-center text-xl font-mono tracking-widest"
                      data-testid="input-totp-confirm"
                    />
                    {totpSetupError && (
                      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                        <ShieldBan className="w-4 h-4 shrink-0" />
                        <span>{totpSetupError}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    disabled={totpSetupConfirmCode.length !== 6 || confirmTotpMutation.isPending}
                    onClick={() => confirmTotpMutation.mutate(totpSetupConfirmCode)}
                    data-testid="button-totp-confirm"
                  >
                    {confirmTotpMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Vérification…</> : "Activer l'Authenticator"}
                  </Button>
                </>
              )}

              {setupTotpMutation.isError && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    <ShieldBan className="w-4 h-4 shrink-0" />
                    <span>{(setupTotpMutation.error as Error)?.message || "Erreur de génération"}</span>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setupTotpMutation.mutate()}>Réessayer</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── TOTP Disable Modal ───────────────────────────────────────────────── */}
      <Dialog open={showTotpDisable} onOpenChange={(open) => { setShowTotpDisable(open); if (!open) { setTotpDisableCode(""); setTotpDisableError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldBan className="w-5 h-5" />
              Désactiver l'Authenticator
            </DialogTitle>
            <DialogDescription>
              Entrez un code valide depuis votre application Authenticator pour confirmer la désactivation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={totpDisableCode}
              onChange={(e) => { setTotpDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setTotpDisableError(""); }}
              className="text-center text-xl font-mono tracking-widest"
              data-testid="input-totp-disable-code"
            />
            {totpDisableError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <ShieldBan className="w-4 h-4 shrink-0" />
                <span>{totpDisableError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTotpDisable(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={totpDisableCode.length !== 6 || disableTotpMutation.isPending}
              onClick={() => disableTotpMutation.mutate(totpDisableCode)}
              data-testid="button-totp-disable-confirm"
            >
              {disableTotpMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Désactivation…</> : "Désactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPusdConvert} onOpenChange={setShowPusdConvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conversion Fiat vers pUSD (AccountPE)</DialogTitle>
            <DialogDescription>
              Prend les fonds en monnaie locale présents sur le compte AccountPE et les transforme en pUSD pour les retraits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Wallet Source (Fiat Holding)</Label>
              <Select value={pusdCountry} onValueChange={setPusdCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="XAF">XAF Wallet (Cameroun)</SelectItem>
                  <SelectItem value="XOFB">XOFB Wallet (Benin)</SelectItem>
                  <SelectItem value="XAFG">XAFG Wallet (Gabon)</SelectItem>
                  <SelectItem value="XOFF">XOFF Wallet (Burkina Faso)</SelectItem>
                  <SelectItem value="XOFT">XOFT Wallet (Togo)</SelectItem>
                  <SelectItem value="GH">GHS Wallet (Ghana)</SelectItem>
                  <SelectItem value="NG">NGN Wallet (Nigéria)</SelectItem>
                  <SelectItem value="KE">KES Wallet (Kenya)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Montant Fiat</Label>
              <Input 
                type="text"
                inputMode="decimal"
                placeholder="Ex: 5000" 
                value={pusdAmount}
                onChange={(e) => setPusdAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPusdConvert(false)}>Annuler</Button>
            <Button 
              onClick={() => convertPusdMutation.mutate()} 
              disabled={convertPusdMutation.isPending || !pusdAmount}
            >
              {convertPusdMutation.isPending ? "Conversion..." : "Convertir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
