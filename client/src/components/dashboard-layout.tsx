import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link as RouterLink } from "wouter";
import logoImage from "@assets/logo.png";
import { CurrencySelector } from "@/components/currency-selector";
import { formatCurrency } from "@/lib/currency";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import type { SupportedCurrency } from "@shared/schema";

const menuItems = [
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
  { title: "Mes liens", url: "/dashboard/links", icon: Link2 },
  { title: "Transactions", url: "/dashboard/transactions", icon: History },
  { title: "Dépôt", url: "/dashboard/deposit", icon: CreditCard },
  { title: "Retrait", url: "/dashboard/withdraw", icon: Wallet },
  { title: "Envoyer", url: "/dashboard/send", icon: Send },
];

const settingsItems = [
  { title: "KYC", url: "/dashboard/kyc", icon: Shield },
  { title: "Support", url: "/dashboard/support", icon: Headphones },
  { title: "Clés API", url: "/dashboard/api-keys", icon: Key },
  { title: "Paramètres", url: "/dashboard/settings", icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [showKycUpdateDialog, setShowKycUpdateDialog] = useState(false);
  const { rates } = useExchangeRates();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
  });

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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "deposit_confirmed":
        return <ArrowDownCircle className="w-4 h-4 text-green-500" />;
      case "withdrawal_confirmed":
        return <ArrowUpCircle className="w-4 h-4 text-orange-500" />;
      case "transfer_received":
        return <Send className="w-4 h-4 text-blue-500" />;
      case "global_message":
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

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <Link href="/dashboard">
              <div className="flex items-center cursor-pointer">
                <img src={logoImage} alt="Ashtech-Pay" className="h-10 w-auto" />
              </div>
            </Link>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <div className="px-4 py-3 mx-2 my-2 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Solde disponible</p>
                <p className="text-lg font-bold text-primary" data-testid="text-sidebar-balance">
                  {formatCurrency(user.balance, user.preferredCurrency as SupportedCurrency, rates)}
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
                  </div>
                  <ScrollArea className="max-h-80">
                    {(!notificationData?.notifications || notificationData.notifications.length === 0) ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Aucune notification
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {notificationData.notifications.slice(0, 20).map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-3 ${!notification.isRead ? "bg-primary/5" : ""}`}
                            data-testid={`notification-item-${notification.id}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div 
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => {
                                  if (notification.transactionId) {
                                    setLocation("/dashboard/transactions");
                                  }
                                }}
                              >
                                <p className="text-sm font-medium truncate">{notification.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                                {notification.createdAt && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(notification.createdAt), "dd MMM à HH:mm", { locale: fr })}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {!notification.isRead && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsReadMutation.mutate(notification.id);
                                    }}
                                    data-testid={`button-mark-read-${notification.id}`}
                                  >
                                    <Check className="w-3 h-3" />
                                  </Button>
                                )}
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
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <CurrencySelector />
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
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
    </SidebarProvider>
  );
}
