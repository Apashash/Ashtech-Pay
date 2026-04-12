import { useEffect, useState } from "react";
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
  User as UserIcon,
  HelpCircle,
  BadgeCheck,
  Send,
  Bell,
  CheckCheck,
  MessageSquare,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
  Check,
  Coins,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Receipt,
  Megaphone,
  MessageCircle,
  Phone,
  Wrench,
} from "lucide-react";
import { SiWhatsapp, SiFacebook } from "react-icons/si";
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
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link as RouterLink } from "wouter";

import { CurrencySelector } from "@/components/currency-selector";
import { formatCurrency, formatWalletBalance } from "@/lib/currency";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import type { SupportedCurrency } from "@shared/schema";
import { COUNTRY_CURRENCIES } from "@shared/schema";

const menuItems = [
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
  { title: "Mes liens", url: "/dashboard/links", icon: Link2 },
  { title: "Transactions", url: "/dashboard/transactions", icon: History },
  { title: "Dépôt", url: "/dashboard/deposit", icon: CreditCard },
  { title: "Retrait", url: "/dashboard/withdraw", icon: Wallet },
  { title: "Envoyer", url: "/dashboard/send", icon: Send },
  { title: "Comptes", url: "/dashboard/wallets", icon: Coins },
];

const settingsItems = [
  { title: "KYC", url: "/dashboard/kyc", icon: Shield },
  { title: "Support", url: "/dashboard/support", icon: Headphones },
  { title: "Clés API", url: "/dashboard/api-keys", icon: Key },
  { title: "Paramètres", url: "/dashboard/settings", icon: Settings },
  { title: "Frais", url: "/dashboard/fee-details", icon: Receipt },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [showKycUpdateDialog, setShowKycUpdateDialog] = useState(false);
  const { rates } = useExchangeRates();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
  });

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
  const sidebarBalance = preferredCurrency === "XAF"
    ? (user?.balance || "0")
    : (wallets.find(w => w.currency === preferredCurrency)?.balance || "0");

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

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const deleteAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/notifications");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Notifications supprimées", description: "Toutes vos notifications ont été effacées." });
    },
  });

  const hasUnreadGlobalMessage = (notificationData?.notifications ?? []).some(
    n => n.type === "global_message" && !n.isRead
  );

  const [showPusdConvert, setShowPusdConvert] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [pusdAmount, setPusdAmount] = useState("");
  const [pusdCountry, setPusdCountry] = useState("CM");
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);

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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "deposit_confirmed":
        return <ArrowDownCircle className="w-4 h-4 text-green-500" />;
      case "withdrawal_confirmed":
        return <ArrowUpCircle className="w-4 h-4 text-orange-500" />;
      case "transfer_received":
        return <Send className="w-4 h-4 text-blue-500" />;
      case "global_message":
        return <Megaphone className="w-4 h-4 text-purple-500" />;
      case "admin_message":
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      removeAuthToken();
      queryClient.clear();
      setLocation("/");
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt!",
      });
    },
  });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isPrivilegedUser = ["admin", "support", "finance"].includes(user.role);
  if (maintenanceData?.active && !isPrivilegedUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <img src="/logo.png" alt="AshTech Pay" className="h-12 w-auto mb-8 opacity-80" />
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
          <Wrench className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Maintenance en cours</h1>
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
      <div className="flex h-dvh w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <Link href="/dashboard">
              <div className="flex items-center gap-2 cursor-pointer">
                <img src="/logo.png" alt="Ashtech-Pay" className="h-9 w-auto" />
                <span className="font-bold text-base text-sidebar-foreground tracking-tight">AshTech Pay</span>
              </div>
            </Link>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <div className="px-4 py-3 mx-2 my-2 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Solde disponible</p>
                <p className="text-lg font-bold text-primary" data-testid="text-sidebar-balance">
                  {formatWalletBalance(sidebarBalance, preferredCurrency)}
                </p>
              </div>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url}>
                        <Link href={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Paramètres & Support</SidebarGroupLabel>
              <SidebarGroupContent>
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
                            className="cursor-pointer"
                          >
                            <item.icon className="w-4 h-4" />
                            <span className="flex-1">{item.title}</span>
                            <Badge className="ml-auto bg-green-500 text-white h-5 px-1.5 text-xs">
                              Vérifié
                            </Badge>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={location === item.url}>
                          <Link href={item.url}>
                            <item.icon className="w-4 h-4" />
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

            {(user.role === "admin" || user.role === "support" || user.role === "finance") && (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/admin")}>
                        <Link href="/admin">
                          <Shield className="w-4 h-4" />
                          <span>Panel Admin</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-background/80 backdrop-blur-md">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3">
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" data-testid="button-user-notifications">
                    <Bell className="w-5 h-5" />
                    {(notificationData?.unreadCount || 0) > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                        {notificationData!.unreadCount > 9 ? "9+" : notificationData!.unreadCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-3 border-b border-border flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Bell className="w-4 h-4 text-primary" />
                      Notifications
                    </h4>
                    {(notificationData?.unreadCount || 0) > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-xs"
                        data-testid="button-mark-all-read"
                      >
                        <CheckCheck className="w-3 h-3 mr-1" />
                        Tout lire
                      </Button>
                    )}
                    {(notificationData?.notifications && notificationData.notifications.length > 0) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAllNotificationsMutation.mutate()}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Tout supprimer"
                        data-testid="button-delete-all-notifications"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="max-h-80">
                    {(!notificationData?.notifications || notificationData.notifications.length === 0) ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Aucune notification
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {notificationData.notifications.slice(0, 20).map((notification) => {
                          const isExpanded = expandedNotifId === notification.id;
                          return (
                          <div
                            key={notification.id}
                            className={`p-3 transition-colors cursor-pointer ${
                              notification.type === "global_message"
                                ? !notification.isRead
                                  ? "bg-purple-500/10 hover:bg-purple-500/15"
                                  : "hover:bg-purple-500/5"
                                : !notification.isRead
                                  ? "bg-primary/5 hover:bg-muted/40"
                                  : "hover:bg-muted/40"
                            }`}
                            data-testid={`notification-item-${notification.id}`}
                            onClick={() => {
                              if (notification.type === "global_message") {
                                setLocation("/dashboard/global-message");
                                return;
                              }
                              setExpandedNotifId(isExpanded ? null : notification.id);
                              if (!notification.isRead) markAsReadMutation.mutate(notification.id);
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 shrink-0">
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <p className="text-sm font-medium truncate">{notification.title}</p>
                                    {notification.type === "global_message" && (
                                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                                        Officiel
                                      </span>
                                    )}
                                  </div>
                                  {notification.type !== "global_message" && (
                                    <span className="text-muted-foreground shrink-0">
                                      {isExpanded
                                        ? <ChevronUp className="w-3 h-3" />
                                        : <ChevronDown className="w-3 h-3" />}
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs text-muted-foreground mt-0.5 ${isExpanded ? "whitespace-pre-wrap break-words" : "line-clamp-2"}`}>
                                  {notification.message?.replace(/\bXAF\b/g, preferredCurrency)}
                                </p>
                                {notification.createdAt && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(notification.createdAt), "dd MMM à HH:mm", { locale: fr })}
                                  </p>
                                )}
                                {isExpanded && notification.transactionId && (
                                  <button
                                    className="text-xs text-primary mt-2 underline"
                                    onClick={(e) => { e.stopPropagation(); setLocation("/dashboard/transactions"); }}
                                    data-testid={`button-notif-goto-tx-${notification.id}`}
                                  >
                                    Voir la transaction →
                                  </button>
                                )}
                                {isExpanded && notification.type === "admin_message" && (
                                  <button
                                    className="text-xs text-primary mt-2 underline"
                                    onClick={(e) => { e.stopPropagation(); setLocation("/dashboard/support"); }}
                                    data-testid={`button-notif-goto-support-${notification.id}`}
                                  >
                                    Voir le message →
                                  </button>
                                )}
                                {isExpanded && notification.type === "global_message" && (
                                  <button
                                    className="text-xs text-purple-500 mt-2 underline font-medium"
                                    onClick={(e) => { e.stopPropagation(); setLocation("/dashboard/global-message"); }}
                                    data-testid={`button-notif-goto-global-${notification.id}`}
                                  >
                                    Lire le message officiel →
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotificationMutation.mutate(notification.id);
                                  }}
                                  data-testid={`button-delete-notification-${notification.id}`}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <div className="relative">
                {hasUnreadGlobalMessage && (
                  <span className="absolute -inset-1.5 rounded-full bg-red-500/40 animate-ping pointer-events-none" />
                )}
                <div
                  className={`relative w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors ${hasUnreadGlobalMessage ? "ring-2 ring-red-500 ring-offset-1 ring-offset-background" : ""}`}
                  onClick={() => setLocation(hasUnreadGlobalMessage ? "/dashboard/global-message" : "/dashboard/settings")}
                  data-testid="button-profile"
                >
                  <UserIcon className="w-5 h-5 text-primary" />
                </div>
                {user.isVerified ? (
                  <div 
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center cursor-pointer"
                    onClick={() => toast({ title: "Compte vérifié", description: "Votre compte est entièrement vérifié. Vous avez accès à toutes les fonctionnalités." })}
                    data-testid="badge-verified"
                  >
                    <BadgeCheck className="w-3 h-3 text-white" />
                  </div>
                ) : (
                  <RouterLink href="/dashboard/kyc">
                    <div 
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center cursor-pointer"
                      data-testid="badge-unverified"
                    >
                      <HelpCircle className="w-3 h-3 text-white" />
                    </div>
                  </RouterLink>
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
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
              <Label>Pays (Source Fiat)</Label>
              <Select value={pusdCountry} onValueChange={setPusdCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CM">Cameroun (XAF)</SelectItem>
                  <SelectItem value="SN">Sénégal (XOF)</SelectItem>
                  <SelectItem value="CI">Côte d'Ivoire (XOF)</SelectItem>
                  <SelectItem value="GH">Ghana (GHS)</SelectItem>
                  <SelectItem value="NG">Nigéria (NGN)</SelectItem>
                  <SelectItem value="KE">Kenya (KES)</SelectItem>
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
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${showContactMenu ? "bg-muted text-muted-foreground rotate-45" : "bg-primary text-primary-foreground"}`}
          data-testid="button-contact-menu"
          title="Nous contacter"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>}
    </SidebarProvider>
  );
}
