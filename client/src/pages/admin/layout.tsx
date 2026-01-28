import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  UserCheck
} from "lucide-react";
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

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Users, label: "Utilisateurs", href: "/admin/users" },
  { icon: UserCheck, label: "Vérifications KYC", href: "/admin/kyc" },
  { 
    icon: CreditCard, 
    label: "Transactions",
    subItems: [
      { icon: ArrowDownCircle, label: "Dépôts", href: "/admin/transactions/deposits" },
      { icon: ArrowUpCircle, label: "Retraits", href: "/admin/transactions/withdrawals" },
      { icon: Send, label: "Envois", href: "/admin/transactions/transfers" },
    ]
  },
  { icon: Phone, label: "Numéros de retrait", href: "/admin/withdrawal-numbers" },
  { 
    icon: DollarSign, 
    label: "Frais",
    subItems: [
      { icon: ArrowDownCircle, label: "Frais Dépôt", href: "/admin/fees/deposits" },
      { icon: ArrowUpCircle, label: "Frais Retrait", href: "/admin/fees/withdrawals" },
      { icon: Send, label: "Frais Envoi", href: "/admin/fees/transfers" },
    ]
  },
  { icon: Globe, label: "Pays & Opérateurs", href: "/admin/countries" },
  { icon: Link2, label: "Liens de paiement", href: "/admin/links" },
  { icon: MessageSquare, label: "Message Global", href: "/admin/global-messages" },
  { icon: MessageSquare, label: "Support", href: "/admin/support" },
  { icon: Shield, label: "Logs & Sécurité", href: "/admin/logs" },
  { icon: Settings, label: "Paramètres", href: "/admin/settings" },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/admin/notifications"],
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery<{
    pendingDeposits: number;
    pendingWithdrawals: number;
    pendingTransfers: number;
  }>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000,
  });

  const { data: kycStats } = useQuery<{ pending: number; approved: number; rejected: number }>({
    queryKey: ["/api/admin/kyc/stats"],
    refetchInterval: 30000,
  });

  const { data: ticketStats } = useQuery<{ openCount: number; totalCount: number }>({
    queryKey: ["/api/admin/tickets/stats"],
    refetchInterval: 30000,
  });

  const pendingCounts: Record<string, number> = {
    "/admin/transactions/deposits": stats?.pendingDeposits || 0,
    "/admin/transactions/withdrawals": stats?.pendingWithdrawals || 0,
    "/admin/transactions/transfers": stats?.pendingTransfers || 0,
    "/admin/kyc": kycStats?.pending || 0,
    "/admin/support": ticketStats?.openCount || 0,
  };

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
    <div className="flex h-screen bg-background">
      <aside className={cn(
        "border-r border-border bg-card flex flex-col transition-all duration-300",
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
                  ? (stats?.pendingDeposits || 0) + (stats?.pendingWithdrawals || 0) + (stats?.pendingTransfers || 0)
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
                (item.href !== "/admin" && item.href && location.startsWith(item.href));
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
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <Link href="/dashboard">
            <Button variant="outline" className="w-full gap-2" data-testid="button-back-to-app">
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
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                      {notifications.length > 9 ? "9+" : notifications.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b border-border">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Transactions en attente
                  </h4>
                </div>
                <ScrollArea className="max-h-80">
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
                            ? "/admin/transactions/deposits" 
                            : notif.type === "withdrawal" 
                              ? "/admin/transactions/withdrawals" 
                              : "/admin/transactions/transfers"}
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
    </div>
  );
}
