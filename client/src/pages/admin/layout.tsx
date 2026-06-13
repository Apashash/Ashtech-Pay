import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, setAdminOtpToken, getAuthHeaders } from "@/lib/queryClient";
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
  KeyRound,
  Loader2,
  MailCheck,
  ShieldBan,
  Smartphone,
  ScanLine,
  ShieldCheck,
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
  { icon: Shield, label: "Audit Sécurité", href: "/admin/audit" },
  { icon: Smartphone, label: "Diagnostic Sessions", href: "/admin/session-debug" },
  { icon: Settings, label: "Paramètres", href: "/admin/settings" },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
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
  const [otpNoChannel, setOtpNoChannel] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSessionExpired, setOtpSessionExpired] = useState(false);
  const otpVerifiedAtRef = useRef<number>(0);
  const otpRef0 = useRef<HTMLInputElement>(null);
  const otpRef1 = useRef<HTMLInputElement>(null);
  const otpRef2 = useRef<HTMLInputElement>(null);
  const otpRef3 = useRef<HTMLInputElement>(null);
  const otpRef4 = useRef<HTMLInputElement>(null);
  const otpRef5 = useRef<HTMLInputElement>(null);
  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3, otpRef4, otpRef5];

  const { data: otpStatus, isLoading: otpLoading, refetch: refetchOtp } = useQuery<{ verified: boolean; totpEnabled?: boolean; bypass?: boolean }>({
    queryKey: ["/api/admin/otp-status"],
    enabled: !!user && ["admin", "support", "finance"].includes((user as any).role),
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
    gcTime: 10 * 60 * 1000,
  });

  // ─── TOTP verification (Google Authenticator) ────────────────────────────────
  const [totpCode, setTotpCode] = useState(["", "", "", "", "", ""]);
  const [totpError, setTotpError] = useState("");
  const totpRef0 = useRef<HTMLInputElement>(null);
  const totpRef1 = useRef<HTMLInputElement>(null);
  const totpRef2 = useRef<HTMLInputElement>(null);
  const totpRef3 = useRef<HTMLInputElement>(null);
  const totpRef4 = useRef<HTMLInputElement>(null);
  const totpRef5 = useRef<HTMLInputElement>(null);
  const totpRefs = [totpRef0, totpRef1, totpRef2, totpRef3, totpRef4, totpRef5];

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

  const verifyTotpMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/admin/totp/verify", { code });
      return await res.json() as { success: boolean; adminOtpToken?: string };
    },
    onSuccess: (data) => {
      if (data.adminOtpToken) setAdminOtpToken(data.adminOtpToken);
      setTotpError("");
      setTotpCode(["", "", "", "", "", ""]);
      otpVerifiedAtRef.current = Date.now();
      queryClient.setQueryData(["/api/admin/otp-status"], (old: any) => ({ ...(old || {}), verified: true }));
    },
    onError: (error: Error) => {
      setTotpError(error.message || "Code incorrect");
      setTotpCode(["", "", "", "", "", ""]);
      setTimeout(() => totpRefs[0].current?.focus(), 100);
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/otp-status"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/otp-status"] });
      toast({ title: "TOTP désactivé", description: "L'authentificator a été retiré." });
    },
    onError: (err: Error) => {
      setTotpDisableError(err.message || "Code incorrect");
    },
  });

  function handleTotpInput(idx: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const newCode = [...totpCode];
    newCode[idx] = digit;
    setTotpCode(newCode);
    setTotpError("");
    if (digit && idx < 5) totpRefs[idx + 1].current?.focus();
    if (newCode.every(d => d !== "") && newCode.length === 6) {
      verifyTotpMutation.mutate(newCode.join(""));
    }
  }
  function handleTotpKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !totpCode[idx] && idx > 0) totpRefs[idx - 1].current?.focus();
  }
  function handleTotpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newCode = ["", "", "", "", "", ""];
    pasted.split("").forEach((d, i) => { newCode[i] = d; });
    setTotpCode(newCode);
    setTotpError("");
    const nextEmpty = pasted.length < 6 ? pasted.length : 5;
    totpRefs[nextEmpty].current?.focus();
    if (pasted.length === 6) verifyTotpMutation.mutate(pasted);
  }
  // ────────────────────────────────────────────────────────────────────────────

  const requestOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/request-otp", {});
      return await res.json() as { sent: boolean; email: string; noChannel?: boolean };
    },
    onSuccess: (data) => {
      setOtpSent(true);
      setOtpEmail(data.email || "");
      setOtpNoChannel(!!data.noChannel);
      setOtpError("");
      setOtpCode(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    },
    onError: (error: Error) => {
      setOtpError(error.message || "Erreur lors de l'envoi du code");
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/admin/verify-otp", { code });
      return await res.json() as { success: boolean; adminOtpToken?: string };
    },
    onSuccess: (data) => {
      if (data.adminOtpToken) setAdminOtpToken(data.adminOtpToken);
      setOtpError("");
      setOtpSessionExpired(false);
      otpVerifiedAtRef.current = Date.now();
      queryClient.setQueryData(["/api/admin/otp-status"], (old: any) => ({ ...(old || {}), verified: true }));
    },
    onError: (error: Error) => {
      setOtpError(error.message || "Code incorrect");
      setOtpCode(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    },
  });

  // Auto-request OTP when admin user is confirmed, not yet verified, and TOTP not enabled
  useEffect(() => {
    if (user && ["admin", "support", "finance"].includes((user as any).role) && otpStatus && !otpStatus.verified && !otpSent && !requestOtpMutation.isPending && !otpStatus.totpEnabled) {
      requestOtpMutation.mutate();
    }
  }, [user, otpStatus]);

  // Listen for 403 requireOtp events from any admin API call (multi-process session issue)
  // Only show "session expired" banner if OTP was previously verified in this browser session.
  // If otpVerifiedAtRef.current === 0, the user has never verified yet — let the OTP gate handle it.
  useEffect(() => {
    const handleOtpRequired = () => {
      // Never verified OTP in this session yet — don't show expired banner, let OTP gate show instead
      if (otpVerifiedAtRef.current === 0) return;
      const timeSinceVerified = Date.now() - otpVerifiedAtRef.current;
      const GRACE_MS = 2 * 60 * 1000; // 2 minutes grace after OTP verification
      if (timeSinceVerified < GRACE_MS) return; // ignore — background refetch race condition
      // Show soft banner instead of immediately resetting the full OTP gate
      setOtpSessionExpired(true);
    };
    window.addEventListener("admin-otp-required", handleOtpRequired);
    return () => window.removeEventListener("admin-otp-required", handleOtpRequired);
  }, [queryClient]);

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
    enabled: !!otpStatus?.verified,
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

    const interval = setInterval(check, 3000);
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

  // ─── OTP / TOTP Gate ────────────────────────────────────────────────────────
  if (otpLoading || (!otpStatus?.verified)) {
    const usesTotp = !!(otpStatus?.totpEnabled);
    const isBusy = otpLoading || requestOtpMutation.isPending || verifyOtpMutation.isPending || verifyTotpMutation.isPending;

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
          <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

          <div className="p-8 space-y-7">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                {usesTotp ? <Smartphone className="w-8 h-8 text-primary" /> : <KeyRound className="w-8 h-8 text-primary" />}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Vérification en 2 étapes</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {otpLoading
                    ? "Chargement…"
                    : usesTotp
                    ? "Entrez le code de votre application Authenticator"
                    : requestOtpMutation.isPending
                    ? "Envoi du code de sécurité…"
                    : otpSent
                    ? otpNoChannel
                      ? <span className="text-amber-400 font-medium">Aucun canal configuré — consultez les logs serveur</span>
                      : <span>Code envoyé à <strong className="text-foreground">{otpEmail}</strong></span>
                    : "Préparation de la session sécurisée…"}
                </p>
              </div>
            </div>

            {/* ── TOTP mode ── */}
            {usesTotp && !otpLoading && (
              <div className="space-y-6">
                <div className="flex justify-center gap-2.5">
                  {totpRefs.map((ref, i) => (
                    <input
                      key={i}
                      ref={ref}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={totpCode[i]}
                      onChange={e => handleTotpInput(i, e.target.value)}
                      onKeyDown={e => handleTotpKeyDown(i, e)}
                      onPaste={i === 0 ? handleTotpPaste : undefined}
                      disabled={verifyTotpMutation.isPending}
                      autoFocus={i === 0}
                      data-testid={`input-totp-${i}`}
                      className={[
                        "w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-background transition-all duration-150",
                        "focus:outline-none focus:scale-105 focus:shadow-md",
                        totpCode[i] ? "border-primary text-primary shadow-sm" : "border-border text-foreground",
                        verifyTotpMutation.isPending ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50",
                      ].join(" ")}
                    />
                  ))}
                </div>
                <div className="flex justify-center -mt-3">
                  <div className="flex gap-1 items-center">
                    {[0,1,2].map(i => <div key={i} className={`w-2 h-2 rounded-full transition-all duration-200 ${totpCode[i] ? "bg-primary" : "bg-border"}`} />)}
                    <div className="w-4 h-px bg-border mx-1" />
                    {[3,4,5].map(i => <div key={i} className={`w-2 h-2 rounded-full transition-all duration-200 ${totpCode[i] ? "bg-primary" : "bg-border"}`} />)}
                  </div>
                </div>
                {verifyTotpMutation.isPending && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Vérification…</span>
                  </div>
                )}
                {totpError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                    <ShieldBan className="w-4 h-4 shrink-0" />
                    <span>{totpError}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-xl px-4 py-3">
                  <ScanLine className="w-3.5 h-3.5 shrink-0 text-primary" />
                  <span>Ouvrez <strong>Google Authenticator</strong> ou <strong>Authy</strong> et entrez le code à 6 chiffres affiché.</span>
                </div>
              </div>
            )}

            {/* ── Email OTP mode ── */}
            {!usesTotp && (
              <>
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
                            otpCode[i] ? "border-primary text-primary shadow-sm" : "border-border text-foreground",
                            isBusy ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50",
                          ].join(" ")}
                        />
                      ))}
                    </div>
                    <div className="flex justify-center -mt-3">
                      <div className="flex gap-1 items-center">
                        {[0,1,2].map(i => <div key={i} className={`w-2 h-2 rounded-full transition-all duration-200 ${otpCode[i] ? "bg-primary" : "bg-border"}`} />)}
                        <div className="w-4 h-px bg-border mx-1" />
                        {[3,4,5].map(i => <div key={i} className={`w-2 h-2 rounded-full transition-all duration-200 ${otpCode[i] ? "bg-primary" : "bg-border"}`} />)}
                      </div>
                    </div>
                    {verifyOtpMutation.isPending && (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Vérification…</span>
                      </div>
                    )}
                    {otpNoChannel && (
                      <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/25 rounded-xl px-4 py-3">
                        <ShieldBan className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Aucun canal e-mail ou Telegram configuré. Le code s'affiche dans les <strong>logs du serveur</strong> (console Replit).</span>
                      </div>
                    )}
                    {otpError && (
                      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                        <ShieldBan className="w-4 h-4 shrink-0" />
                        <span>{otpError}</span>
                      </div>
                    )}
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
                    <Button onClick={() => requestOtpMutation.mutate()} className="w-full">Réessayer</Button>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-xl px-4 py-3">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
                  <span>Le code à <strong>6 chiffres</strong> expire dans <strong>5 minutes</strong>. Vous pouvez coller directement depuis Telegram.</span>
                </div>
              </>
            )}
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

        <div className="p-3 border-t border-border space-y-2">
          {/* TOTP Security Button */}
          <Button
            variant="ghost"
            className={cn("w-full justify-start gap-3 px-3 text-sm", otpStatus?.totpEnabled ? "text-green-500 hover:text-green-400" : "text-amber-500 hover:text-amber-400")}
            onClick={() => {
              if (otpStatus?.totpEnabled) {
                setShowTotpDisable(true);
              } else {
                setShowTotpSetup(true);
                setTotpSetupStep("qr");
                setTotpSetupUri("");
                setTotpSetupSecret("");
                setTotpSetupError("");
                setupTotpMutation.mutate();
              }
            }}
            data-testid="button-totp-setup"
          >
            {otpStatus?.totpEnabled
              ? <><ShieldCheck className="w-4 h-4" /> Authenticator actif</>
              : <><Smartphone className="w-4 h-4" /> Activer l'Authenticator</>
            }
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
          {otpSessionExpired && (
            <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <ShieldBan className="w-4 h-4 shrink-0" />
                <span>Votre session admin a expiré. Re-vérifiez votre identité pour continuer.</span>
              </div>
              <button
                onClick={() => {
                  setOtpSessionExpired(false);
                  queryClient.setQueryData(["/api/admin/otp-status"], { verified: false });
                  setOtpSent(false);
                  setOtpCode(["", "", "", "", "", ""]);
                  setOtpError("");
                }}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Re-vérifier
              </button>
            </div>
          )}
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
