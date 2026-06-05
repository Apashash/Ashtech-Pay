import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  KeyRound,
  Loader2,
  MailCheck,
  ShieldBan,
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
  { icon: Clock, label: "Paiements en attente", href: "/admin/pending-payouts" },
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
  { icon: ArrowLeftRight, label: "Conversions", href: "/admin/conversions" },
  { icon: Globe, label: "Pays & Opérateurs", href: "/admin/countries" },
  { icon: Zap, label: "AfribaPay", href: "/admin/afribapay" },
  { icon: Zap, label: "PixPay", href: "/admin/pixpay" },
  { icon: Mail, label: "Campagnes Email", href: "/admin/email-campaigns" },
  { icon: Code2, label: "Gestion des API", href: "/admin/api-management" },
  { icon: Link2, label: "Liens de paiement", href: "/admin/links" },
  { icon: MessageSquare, label: "Message Global", href: "/admin/global-messages" },
  { icon: MessageSquare, label: "Support", href: "/admin/support" },
  { icon: ShieldBan, label: "IPs Bloquées", href: "/admin/blocked-ips" },
  { icon: Shield, label: "Logs & Sécurité", href: "/admin/logs" },
  { icon: Settings, label: "Paramètres", href: "/admin/settings" },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
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

  // ─── Admin OTP Gate ─────────────────────────────────────────────────────────
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpError, setOtpError] = useState("");
  const otpRef0 = useRef<HTMLInputElement>(null);
  const otpRef1 = useRef<HTMLInputElement>(null);
  const otpRef2 = useRef<HTMLInputElement>(null);
  const otpRef3 = useRef<HTMLInputElement>(null);
  const otpRef4 = useRef<HTMLInputElement>(null);
  const otpRef5 = useRef<HTMLInputElement>(null);
  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3, otpRef4, otpRef5];

  const { data: otpStatus, isLoading: otpLoading, refetch: refetchOtp } = useQuery<{ verified: boolean }>({
    queryKey: ["/api/admin/otp-status"],
    enabled: !!user && ["admin", "support", "finance"].includes((user as any).role),
    retry: false,
  });

  const requestOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/request-otp", {});
      return res as { sent: boolean; email: string };
    },
    onSuccess: (data) => {
      setOtpSent(true);
      setOtpEmail(data.email);
      setOtpError("");
      setOtpCode(["", "", "", ""]);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    },
    onError: (error: Error) => {
      setOtpError(error.message || "Erreur lors de l'envoi du code");
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest("POST", "/api/admin/verify-otp", { code });
    },
    onSuccess: () => {
      refetchOtp();
      setOtpError("");
    },
    onError: (error: Error) => {
      setOtpError(error.message || "Code incorrect");
      setOtpCode(["", "", "", ""]);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    },
  });

  // Auto-request OTP when admin user is confirmed and not yet verified
  useEffect(() => {
    if (user && ["admin", "support", "finance"].includes((user as any).role) && otpStatus && !otpStatus.verified && !otpSent && !requestOtpMutation.isPending) {
      requestOtpMutation.mutate();
    }
  }, [user, otpStatus]);

  function handleOtpInput(idx: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const newCode = [...otpCode];
    newCode[idx] = digit;
    setOtpCode(newCode);
    setOtpError("");
    if (digit && idx < 5) {
      otpRefs[idx + 1].current?.focus();
    }
    if (newCode.every(d => d !== "") && newCode.length === 6) {
      verifyOtpMutation.mutate(newCode.join(""));
    }
  }

  function handleOtpKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpCode[idx] && idx > 0) {
      otpRefs[idx - 1].current?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newCode = ["", "", "", "", "", ""];
    pasted.split("").forEach((d, i) => { newCode[i] = d; });
    setOtpCode(newCode);
    setOtpError("");
    const nextEmpty = pasted.length < 6 ? pasted.length : 5;
    otpRefs[nextEmpty].current?.focus();
    if (pasted.length === 6) {
      verifyOtpMutation.mutate(pasted);
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

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
  });

  const notifications = layoutStats?.notifications || [];

  const hasNewConversion = !!(
    layoutStats?.conversionCount &&
    layoutStats?.latestConversionAt &&
    layoutStats.latestConversionAt > conversionSeenAt
  );

  const pendingCounts: Record<string, number> = {
    "/admin/transactions/deposits": layoutStats?.pendingDeposits || 0,
    "/admin/transactions/withdrawals": layoutStats?.pendingWithdrawals || 0,
    "/admin/transactions/transfers": layoutStats?.pendingTransfers || 0,
    "/admin/pending-payouts": layoutStats?.pendingManualPayouts || 0,
    "/admin/kyc": layoutStats?.kycPending || 0,
    "/admin/support": layoutStats?.ticketUnread || 0,
    "/admin/conversions": hasNewConversion ? (layoutStats?.conversionCount || 0) : 0,
    "/admin/withdrawal-numbers": layoutStats?.withdrawalNumberCount || 0,
  };

  useEffect(() => {
    if (location === "/admin/conversions") {
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

  // ─── OTP Gate ──────────────────────────────────────────────────────────────
  if (otpLoading || (!otpStatus?.verified)) {
    const isBusy = otpLoading || requestOtpMutation.isPending || verifyOtpMutation.isPending;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        {/* Logo / brand bar */}
        <div className="mb-8 flex items-center gap-2 select-none">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">AshTech Pay</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-1">Admin</span>
        </div>

        {/* Card */}
        <div className="w-full max-w-md bg-card border border-border/60 rounded-3xl shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

          <div className="p-8 space-y-7">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Vérification en 2 étapes</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {otpLoading || requestOtpMutation.isPending
                    ? "Envoi du code de sécurité…"
                    : otpSent
                    ? <span>Code envoyé à <strong className="text-foreground">{otpEmail}</strong></span>
                    : "Préparation de la session sécurisée…"}
                </p>
              </div>
            </div>

            {/* Loading state */}
            {(otpLoading || requestOtpMutation.isPending) && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <p className="text-xs text-muted-foreground">Envoi en cours…</p>
              </div>
            )}

            {/* OTP input */}
            {otpSent && !requestOtpMutation.isPending && (
              <div className="space-y-6">
                {/* Digits */}
                <div className="flex justify-center gap-2.5">
                  {otpRefs.map((ref, i) => (
                    <input
                      key={i}
                      ref={ref}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otpCode[i]}
                      onChange={e => handleOtpInput(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      disabled={isBusy}
                      data-testid={`input-otp-${i}`}
                      className={[
                        "w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-background transition-all duration-150",
                        "focus:outline-none focus:scale-105 focus:shadow-md",
                        otpCode[i]
                          ? "border-primary text-primary shadow-sm"
                          : "border-border text-foreground",
                        isBusy ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50",
                      ].join(" ")}
                    />
                  ))}
                </div>

                {/* Separator between 3+3 */}
                <div className="flex justify-center -mt-3">
                  <div className="flex gap-1 items-center">
                    {[0,1,2].map(i => (
                      <div key={i} className={`w-2 h-2 rounded-full transition-all duration-200 ${otpCode[i] ? "bg-primary" : "bg-border"}`} />
                    ))}
                    <div className="w-4 h-px bg-border mx-1" />
                    {[3,4,5].map(i => (
                      <div key={i} className={`w-2 h-2 rounded-full transition-all duration-200 ${otpCode[i] ? "bg-primary" : "bg-border"}`} />
                    ))}
                  </div>
                </div>

                {/* Verifying spinner */}
                {verifyOtpMutation.isPending && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Vérification…</span>
                  </div>
                )}

                {/* Error */}
                {otpError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                    <ShieldBan className="w-4 h-4 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                {/* Resend */}
                <div className="text-center">
                  <button
                    onClick={() => { setOtpCode(["", "", "", "", "", ""]); setOtpError(""); requestOtpMutation.mutate(); }}
                    disabled={isBusy}
                    className="text-sm text-primary hover:text-primary/80 hover:underline underline-offset-2 disabled:opacity-40 transition-colors"
                  >
                    Renvoyer un nouveau code
                  </button>
                </div>
              </div>
            )}

            {/* Error sending */}
            {!otpSent && !requestOtpMutation.isPending && otpError && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                  <ShieldBan className="w-4 h-4 shrink-0" />
                  <span>{otpError}</span>
                </div>
                <Button onClick={() => requestOtpMutation.mutate()} className="w-full">
                  Réessayer
                </Button>
              </div>
            )}

            {/* Footer hint */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-xl px-4 py-3">
              <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span>Le code à <strong>6 chiffres</strong> expire dans <strong>5 minutes</strong>. Vous pouvez coller directement depuis Telegram.</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} AshTech Pay — Session sécurisée
        </p>
      </div>
    );
  }
  // ───────────────────────────────────────────────────────────────────────────

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

        <div className="p-4 border-t border-border">
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
                    <Link href="/admin/support" onClick={() => { setNotificationsOpen(false); setSidebarOpen(false); }}>
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
