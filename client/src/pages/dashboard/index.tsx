import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BottomSheet, BottomSheetContent, BottomSheetDescription, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transferSchema, depositSchema, withdrawSchema, createPaymentLinkSchema, type SupportedCurrency, COUNTRY_CURRENCIES } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Transaction, PaymentLink, Wallet as WalletEntry } from "@shared/schema";
import { formatCurrency, formatWalletBalance } from "@/lib/currency";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import {
  Wallet,
  Send,
  ArrowDownUp,
  CreditCard,
  Link2,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Loader2,
  Eye,
  MousePointer,
  Globe,
  BarChart3,
  Calendar,
  Filter,
  AlertTriangle,
  Shield,
  Smartphone,
  ChevronRight,
  History,
} from "lucide-react";
import { useLocation } from "wouter";
import { z } from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/lib/language";

interface UserStats {
  totalReceived: string;
  totalSent: string;
  totalTransactions: number;
  monthlyTransactions: number;
  pendingTransactions: number;
  totalClicks: number;
  linkPayments: number;
  totalCollected: string;
  activeLinks: number;
}

function QuickActionCard({ icon: Icon, label, color, onClick, testId }: { 
  icon: React.ElementType; 
  label: string; 
  color: string; 
  onClick: () => void;
  testId: string;
}) {
  return (
    <Card 
      className="cursor-pointer hover-elevate transition-all"
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-4 flex flex-col items-center gap-2">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

function StatCard({ title, value, icon: Icon, trend, color, href }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color: string;
  href?: string;
}) {
  const content = (
    <Card className={href ? "cursor-pointer hover-elevate transition-all" : ""}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm mb-1">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {trend && <p className="text-xs text-green-500 mt-1">{trend}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

const INTERNAL_TRANSFER_KEY = "__ashtech_interne__";

function SendMoneyDialog({ open, onClose, wallets = [] }: { open: boolean; onClose: () => void, wallets?: WalletEntry[] }) {
  const { toast } = useToast();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const primaryCurrency = user?.preferredCurrency || "XAF";
  const [selectedWallet, setSelectedWallet] = useState<string>(primaryCurrency);
  const [destination, setDestination] = useState<string>(INTERNAL_TRANSFER_KEY);
  const [recipientIdentifier, setRecipientIdentifier] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const isInternal = destination === INTERNAL_TRANSFER_KEY;

  const reset = () => {
    setRecipientIdentifier("");
    setAmount("");
    setSelectedWallet(primaryCurrency);
    setDestination(INTERNAL_TRANSFER_KEY);
  };

  const internalTransferMutation = useMutation({
    mutationFn: async () => {
      if (!recipientIdentifier.trim()) throw new Error("Veuillez entrer l'identifiant du destinataire");
      if (!amount || parseFloat(amount) <= 0) throw new Error("Veuillez entrer un montant valide");
      const res = await apiRequest("POST", "/api/transfers/internal", {
        recipientIdentifier: recipientIdentifier.trim(),
        amount,
        sourceCurrency: selectedWallet,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur lors du transfert");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Transfert effectué ✓", description: `Compte de ${data.recipientName} crédité instantanément — Frais: 0` });
      reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const internationalTransferMutation = useMutation({
    mutationFn: async () => {
      if (!recipientIdentifier.trim()) throw new Error("Veuillez entrer l'identifiant du destinataire");
      if (!amount || parseFloat(amount) <= 0) throw new Error("Veuillez entrer un montant valide");
      const res = await apiRequest("POST", "/api/transfers", {
        recipientUsername: recipientIdentifier.trim(),
        amount,
        sourceCurrency: selectedWallet,
        destinationCountry: destination,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur lors du transfert");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Transfert effectué", description: "L'argent a été envoyé avec succès" });
      reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const isPending = internalTransferMutation.isPending || internationalTransferMutation.isPending;

  const handleSend = () => {
    if (isInternal) {
      internalTransferMutation.mutate();
    } else {
      internationalTransferMutation.mutate();
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={() => { reset(); onClose(); }}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>Envoyer de l'argent</BottomSheetTitle>
          <BottomSheetDescription>Transfert instantané vers un compte Ashtech Pay ou international</BottomSheetDescription>
        </BottomSheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Solde à débiter</label>
            <Select value={selectedWallet} onValueChange={setSelectedWallet}>
              <SelectTrigger className="border-[#F0B90B]/30">
                <SelectValue placeholder="Choisir un compte" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((w, idx) => (
                  <SelectItem key={w.currency || idx} value={w.currency}>
                    {idx === 0 ? "Compte Principal" : `Compte ${w.currency}`} — {parseFloat(w.balance || "0").toLocaleString()} {w.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Destination</label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger className="border-[#F0B90B]/50 ring-offset-background focus:ring-2 focus:ring-[#F0B90B]">
                <SelectValue placeholder="Choisir la destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={INTERNAL_TRANSFER_KEY}>🏦 Transfert Interne Ashtech Pay</SelectItem>
                {Object.keys(COUNTRY_CURRENCIES)
                  .filter((c, i, arr) => arr.findIndex(x => COUNTRY_CURRENCIES[x] === COUNTRY_CURRENCIES[c]) === i)
                  .map(country => (
                    <SelectItem key={country} value={country}>🌍 {country}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {isInternal && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 dark:bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-500 text-sm font-medium">Frais: 0 — Transfert gratuit et instantané</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isInternal ? "Email, téléphone ou nom d'utilisateur" : "Nom d'utilisateur du destinataire"}
            </label>
            <Input
              placeholder={isInternal ? "exemple@email.com / +237600000000 / username" : "username"}
              value={recipientIdentifier}
              onChange={e => setRecipientIdentifier(e.target.value)}
              data-testid="input-recipient-identifier"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Montant ({selectedWallet})</label>
            <Input
              type="number"
              placeholder="10000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              data-testid="input-amount"
            />
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={handleSend}
            disabled={isPending}
            data-testid="button-send-confirm"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Envoyer
          </Button>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function DepositDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: "", paymentMethod: "mobile_money" },
  });

  const depositMutation = useMutation({
    mutationFn: async (data: z.infer<typeof depositSchema>) => {
      const res = await apiRequest("POST", "/api/deposits", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Dépôt effectué", description: "Votre compte a été crédité" });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  return (
    <BottomSheet open={open} onOpenChange={onClose}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>Recharger mon compte</BottomSheetTitle>
          <BottomSheetDescription>Ajoutez de l'argent à votre portefeuille</BottomSheetDescription>
        </BottomSheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => depositMutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Montant ({user?.preferredCurrency || "XAF"})</FormLabel>
                <FormControl><Input type="text" inputMode="decimal" placeholder="10000" {...field} data-testid="input-deposit-amount" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="paymentMethod" render={({ field }) => (
              <FormItem>
                <FormLabel>Mode de paiement</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-payment-method"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={depositMutation.isPending} data-testid="button-deposit-confirm">
              {depositMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Recharger
            </Button>
          </form>
        </Form>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function WithdrawDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: "", paymentMethod: "mobile_money", accountDetails: "" },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: z.infer<typeof withdrawSchema>) => {
      const res = await apiRequest("POST", "/api/withdrawals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Retrait demandé", description: "Votre demande de retrait a été enregistrée" });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  return (
    <BottomSheet open={open} onOpenChange={onClose}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>Retirer de l'argent</BottomSheetTitle>
          <BottomSheetDescription>Retirez de l'argent vers votre compte</BottomSheetDescription>
        </BottomSheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => withdrawMutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Montant ({user?.preferredCurrency || "XAF"})</FormLabel>
                <FormControl><Input type="text" inputMode="decimal" placeholder="10000" {...field} data-testid="input-withdraw-amount" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="paymentMethod" render={({ field }) => (
              <FormItem>
                <FormLabel>Mode de retrait</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-withdraw-method"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Virement bancaire</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="accountDetails" render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro de compte / téléphone</FormLabel>
                <FormControl><Input placeholder="+237..." {...field} data-testid="input-account-details" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={withdrawMutation.isPending} data-testid="button-withdraw-confirm">
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Retirer
            </Button>
          </form>
        </Form>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function VerificationRequiredDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();
  
  return (
    <BottomSheet open={open} onOpenChange={onClose}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Compte non vérifié
          </BottomSheetTitle>
          <BottomSheetDescription>
            Votre compte n'est pas encore vérifié. Pour utiliser cette fonctionnalité, vous devez d'abord passer la vérification KYC.
          </BottomSheetDescription>
        </BottomSheetHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button 
            onClick={() => { onClose(); setLocation("/dashboard/kyc"); }}
            data-testid="button-go-to-kyc"
          >
            <Shield className="w-4 h-4 mr-2" />
            Passer la vérification
          </Button>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function CreateLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const form = useForm<z.infer<typeof createPaymentLinkSchema>>({
    resolver: zodResolver(createPaymentLinkSchema),
    defaultValues: { title: "", description: "", amount: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createPaymentLinkSchema>) => {
      const res = await apiRequest("POST", "/api/payment-links", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({ title: "Lien créé", description: "Votre lien de paiement a été créé" });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  return (
    <BottomSheet open={open} onOpenChange={onClose}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>Créer un lien de paiement</BottomSheetTitle>
          <BottomSheetDescription>Créez un lien pour recevoir des paiements</BottomSheetDescription>
        </BottomSheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Titre</FormLabel>
                <FormControl><Input placeholder="Paiement pour..." {...field} data-testid="input-link-title" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Montant ({user?.preferredCurrency || "XAF"})</FormLabel>
                <FormControl><Input type="text" inputMode="decimal" placeholder="10000" {...field} data-testid="input-link-amount" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description (optionnel)</FormLabel>
                <FormControl><Input placeholder="Description..." {...field} data-testid="input-link-description" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-create-link-confirm">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Créer le lien
            </Button>
          </form>
        </Form>
      </BottomSheetContent>
    </BottomSheet>
  );
}

export default function DashboardHome() {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedLink, setSelectedLink] = useState("all");
  const { rates } = useExchangeRates();
  const { t } = useLanguage();

  const periodOptions = [
    { value: "today", label: t.dashboard.periodToday },
    { value: "week", label: t.dashboard.periodWeek },
    { value: "month", label: t.dashboard.periodMonth },
    { value: "last_month", label: t.dashboard.periodLastMonth },
    { value: "year", label: t.dashboard.periodYear },
    { value: "all", label: t.dashboard.periodAll },
  ];

  const { data: depositConfig } = useQuery<any>({ queryKey: ["/api/public/deposit-config"] });

  const operatorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const country of depositConfig?.countries || []) {
      for (const op of country.operators || []) {
        map[op.id] = op.name;
      }
    }
    return map;
  }, [depositConfig]);

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery<{
    user: User;
    transactions: Transaction[];
    paymentLinks: PaymentLink[];
    wallets: WalletEntry[];
    stats: UserStats;
  }>({ queryKey: ["/api/dashboard"] });

  useEffect(() => {
    if (dashboardData) {
      queryClient.setQueryData(["/api/user"], dashboardData.user);
      queryClient.setQueryData(["/api/transactions"], dashboardData.transactions);
      queryClient.setQueryData(["/api/payment-links"], dashboardData.paymentLinks);
      queryClient.setQueryData(["/api/wallets"], dashboardData.wallets);
      queryClient.setQueryData(["/api/user/stats"], dashboardData.stats);
      if ((dashboardData as any).globalMessages) queryClient.setQueryData(["/api/global-messages/active"], (dashboardData as any).globalMessages);
      if ((dashboardData as any).ticketStats) queryClient.setQueryData(["/api/tickets/stats"], (dashboardData as any).ticketStats);
    }
  }, [dashboardData]);

  const user = dashboardData?.user;
  const transactions = dashboardData?.transactions ?? [];
  const paymentLinks = dashboardData?.paymentLinks ?? [];
  const userStats = dashboardData?.stats;
  const wallets = dashboardData?.wallets ?? [];

  const [, setLocation] = useLocation();

  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [logoFlash, setLogoFlash] = useState(false);
  const [logoClickDisplay, setLogoClickDisplay] = useState(0);
  const isAdminRole = ["admin", "support", "finance"].includes(user?.role ?? "");

  const handleLogoClick = useCallback(() => {
    if (!isAdminRole) return;
    logoClickCount.current += 1;
    const count = logoClickCount.current;
    setLogoFlash(true);
    setLogoClickDisplay(count);
    setTimeout(() => setLogoFlash(false), 150);
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    if (count >= 5) {
      logoClickCount.current = 0;
      setLogoClickDisplay(0);
      setLocation("/admin-panel-verify");
      return;
    }
    logoClickTimer.current = setTimeout(() => {
      logoClickCount.current = 0;
      setLogoClickDisplay(0);
    }, 2000);
  }, [isAdminRole, setLocation]);

  const localCurrency = user?.preferredCurrency || "XAF";

  const totalBalanceInLocalCurrency = useMemo(() => {
    if (wallets.length === 0) return user?.balance || "0.00";
    const localRate = rates[localCurrency] || 1;
    let total = 0;
    for (const wallet of wallets) {
      const walletRate = rates[wallet.currency] || 1;
      total += parseFloat(wallet.balance || "0") * (localRate / walletRate);
    }
    return total.toFixed(2);
  }, [wallets, rates, localCurrency, user?.balance]);

  const recentTransactions = transactions.slice(0, 5);
  const isVerified = user?.isVerified ?? false;

  const handleAction = (action: string) => {
    if (action === "deposit") {
      setLocation("/dashboard/deposit");
    } else if (!isVerified) {
      setShowVerificationDialog(true);
    } else {
      setActiveDialog(action);
    }
  };

  const chartData = useMemo(() => {
    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const now = new Date();
    const weekData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      const dayTransactions = transactions.filter(t => {
        if (!t.createdAt) return false;
        const tDate = new Date(t.createdAt);
        return tDate.toDateString() === date.toDateString() && t.status === "completed";
      });
      return {
        period: days[date.getDay()],
        amount: dayTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0),
      };
    });
    return weekData;
  }, [transactions]);

  if (isDashboardLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div>
            <div className="h-8 w-48 bg-muted rounded mb-2" />
            <div className="h-4 w-36 bg-muted rounded" />
          </div>
          <div className="h-36 bg-muted rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl" />)}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-80 bg-muted rounded-xl" />
            <div className="h-80 bg-muted rounded-xl" />
          </div>
          <div className="h-72 bg-muted rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.dashboard.title}</h1>
          <p className="text-muted-foreground">{t.dashboard.welcome}, {user?.fullName}</p>
        </div>

        <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground text-sm mb-1">{t.dashboard.mainBalance} ({user?.preferredCurrency || "XAF"})</p>
                  {(() => {
                    const cur = user?.preferredCurrency || "XAF";
                    const num = parseFloat(user?.balance || "0.00");
                    const balanceText = (cur === "USD" || cur === "EUR")
                      ? num.toFixed(2)
                      : new Intl.NumberFormat("fr-FR").format(Math.round(num));
                    const len = balanceText.length;
                    const sizeClass = len > 14 ? "text-2xl" : len > 11 ? "text-3xl" : "text-4xl";
                    return (
                      <p className={`${sizeClass} font-bold text-foreground whitespace-nowrap`} data-testid="text-balance">
                        {balanceText}
                      </p>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground mt-2">Ashtech Pay</p>
                </div>
                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                  <button
                    onClick={() => setLocation("/dashboard/wallets")}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-sm font-semibold transition-all border border-primary/30"
                    data-testid="button-wallets"
                  >
                    <Wallet className="w-4 h-4" />
                    Conversion
                  </button>
                  {/* Zone de clic invisible — gesture admin uniquement */}
                  <div className="relative">
                    <div
                      onClick={isAdminRole ? handleLogoClick : undefined}
                      className={`h-16 sm:h-28 w-12 ${isAdminRole ? "cursor-pointer select-none" : "pointer-events-none"}`}
                    />
                    {isAdminRole && logoClickDisplay > 0 && (
                      <div className="absolute -bottom-4 sm:-bottom-5 left-0 right-0 flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((dot) => (
                          <span
                            key={dot}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${dot <= logoClickDisplay ? "bg-primary scale-125" : "bg-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {wallets.length > 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-primary/10">
                  {wallets
                    .filter(w => w.currency !== (user?.preferredCurrency || "XAF"))
                    .sort((a, b) => parseFloat(b.balance || "0") - parseFloat(a.balance || "0"))
                    .slice(0, 2)
                    .map((wallet) => (
                      <div key={wallet.currency} className="bg-background/40 p-3 rounded-lg border border-primary/5">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{wallet.currency}</p>
                        <p className="text-sm font-bold text-foreground">
                          {formatWalletBalance(wallet.balance, wallet.currency)}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.dashboard.quickActions}</p>
          <div className="grid grid-cols-2 gap-3">
            <QuickActionCard icon={CreditCard} label={t.dashboard.deposit} color="bg-green-500/10 text-green-500" onClick={() => setLocation("/dashboard/deposit")} testId="button-action-deposit" />
            <QuickActionCard icon={Send} label={t.dashboard.send} color="bg-blue-500/10 text-blue-500" onClick={() => setLocation("/dashboard/send")} testId="button-action-send" />
            <QuickActionCard icon={ArrowDownUp} label={t.dashboard.withdraw} color="bg-orange-500/10 text-orange-500" onClick={() => setLocation("/dashboard/withdraw")} testId="button-action-withdraw" />
            <QuickActionCard icon={Link2} label={t.dashboard.paymentLink} color="bg-purple-500/10 text-purple-500" onClick={() => setLocation("/dashboard/links")} testId="button-action-link" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedLink} onValueChange={setSelectedLink}>
              <SelectTrigger className="w-48" data-testid="select-link-filter">
                <SelectValue placeholder={t.dashboard.allLinks} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.dashboard.allLinks}</SelectItem>
                {paymentLinks.map((link) => (
                  <SelectItem key={link.id} value={link.id}>{link.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48" data-testid="select-period-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.dashboard.overview}</p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title={t.dashboard.linkClicks} 
            value={(userStats?.totalClicks || 0).toLocaleString('fr-FR')} 
            icon={MousePointer} 
            color="bg-blue-500/10 text-blue-500"
          />
          <StatCard 
            title={t.dashboard.totalTransactions} 
            value={userStats?.totalTransactions || 0} 
            icon={ArrowDownUp} 
            color="bg-green-500/10 text-green-500"
          />
          <StatCard 
            title={t.dashboard.totalCollected} 
            value={formatCurrency(parseFloat(userStats?.totalCollected || "0"), (user?.preferredCurrency || "XAF") as SupportedCurrency, rates)} 
            icon={Wallet} 
            color="bg-primary/10 text-primary"
          />
          <StatCard 
            title={t.dashboard.activeLinks} 
            value={userStats?.activeLinks || 0}
            icon={Link2} 
            color="bg-purple-500/10 text-purple-500"
            href="/dashboard/links"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.dashboard.activity}</p>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                {t.dashboard.collectedAmounts}
              </CardTitle>
              <CardDescription>{t.dashboard.last7days}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value, (user?.preferredCurrency || "XAF") as SupportedCurrency, rates), "Montant"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="amount" fill="#F0B90B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.dashboard.financialSummary}</p>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                {t.dashboard.statistics}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between px-6 py-3.5">
                  <span className="text-sm text-muted-foreground">{t.dashboard.totalReceived}</span>
                  <span className="text-sm font-semibold text-green-500">
                    {formatCurrency(parseFloat(userStats?.totalReceived || "0"), (user?.preferredCurrency || "XAF") as SupportedCurrency, rates)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-6 py-3.5">
                  <span className="text-sm text-muted-foreground">{t.dashboard.totalSent}</span>
                  <span className="text-sm font-semibold text-red-500">
                    {formatCurrency(parseFloat(userStats?.totalSent || "0"), (user?.preferredCurrency || "XAF") as SupportedCurrency, rates)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-6 py-3.5">
                  <span className="text-sm text-muted-foreground">{t.dashboard.thisMonth}</span>
                  <span className="text-sm font-semibold">{userStats?.monthlyTransactions || 0} transactions</span>
                </div>
                <div className="flex items-center justify-between px-6 py-3.5">
                  <span className="text-sm text-muted-foreground">{t.dashboard.pending}</span>
                  <span className="text-sm font-semibold text-orange-500">{userStats?.pendingTransactions || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.dashboard.recentActivity}</p>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{t.dashboard.recentTransactions}</span>
              </div>
              <Link href="/dashboard/transactions">
                <button type="button" className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline" data-testid="button-view-all-transactions">
                  <Eye className="w-3 h-3" />
                  {t.dashboard.viewAll}
                </button>
              </Link>
            </div>
            {recentTransactions.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">{t.dashboard.noTransactions}</p>
            ) : (
              recentTransactions.map((tx) => {
                const isIncoming = ["deposit", "transfer_in", "payment_link"].includes(tx.type);
                const txTypeLabels: Record<string, string> = {
                  deposit: t.dashboard.typeDeposit, withdrawal: t.dashboard.typeWithdrawal, transfer_in: t.dashboard.typeTransferIn, transfer_out: t.dashboard.typeTransferOut, payment_link: t.dashboard.typePaymentLink, conversion: t.dashboard.typeConversion
                };
                const operatorName = tx.operatorId ? operatorMap[tx.operatorId] : null;
                const statusColors: Record<string, string> = { completed: "text-green-500", pending: "text-orange-500", failed: "text-red-500" };
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center ${isIncoming ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      {isIncoming ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{txTypeLabels[tx.type] || tx.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {operatorName && <span className="mr-1">{operatorName} ·</span>}
                        {tx.createdAt ? format(new Date(tx.createdAt), "d MMM, HH:mm", { locale: fr }) : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {tx.paymentMethod === "crypto" && (tx as any).metadata ? (() => {
                        const meta = (tx as any).metadata;
                        const credited = Number(meta.creditedAmountUsdt ?? meta.grossAmountUsdt ?? tx.amount);
                        const assetCode = meta.assetCode || "";
                        return (
                          <>
                            <span className={`text-sm font-semibold ${isIncoming ? 'text-green-500' : 'text-red-500'}`}>
                              {isIncoming ? '+' : '-'}{credited.toFixed(4)} USDT
                            </span>
                            {assetCode && <span className="text-[9px] font-mono text-amber-500 uppercase">{assetCode}</span>}
                          </>
                        );
                      })() : (
                        <span className={`text-sm font-semibold ${isIncoming ? 'text-green-500' : 'text-red-500'}`}>
                          {isIncoming ? '+' : '-'}{formatWalletBalance(tx.amount, tx.currency || user?.preferredCurrency || "XAF")}
                        </span>
                      )}
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${statusColors[tx.status] || 'text-muted-foreground'}`}>
                        {tx.status === "completed" ? t.dashboard.statusCompleted : tx.status === "pending" ? t.dashboard.statusPending : t.dashboard.statusFailed}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

        <SendMoneyDialog 
          open={activeDialog === "send"} 
          onClose={() => setActiveDialog(null)} 
          wallets={wallets}
        />
      <DepositDialog open={activeDialog === "deposit"} onClose={() => setActiveDialog(null)} />
      <WithdrawDialog open={activeDialog === "withdraw"} onClose={() => setActiveDialog(null)} />
      <CreateLinkDialog open={activeDialog === "link"} onClose={() => setActiveDialog(null)} />
      <VerificationRequiredDialog open={showVerificationDialog} onClose={() => setShowVerificationDialog(false)} />
    </DashboardLayout>
  );
}
