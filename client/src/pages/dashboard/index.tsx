import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transferSchema, depositSchema, withdrawSchema, createPaymentLinkSchema, type SupportedCurrency, COUNTRY_CURRENCIES } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Transaction, PaymentLink, Wallet as WalletEntry } from "@shared/schema";
import { formatCurrency } from "@/lib/currency";
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
} from "lucide-react";
import { useLocation } from "wouter";
import { z } from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import dashboardIllustration from "@assets/IMG_7793_1771906562197.png";

const periodOptions = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois-ci" },
  { value: "last_month", label: "Mois dernier" },
  { value: "year", label: "Cette année" },
  { value: "all", label: "Tout" },
];

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
  const [selectedWallet, setSelectedWallet] = useState<string>("XAF");
  const [destination, setDestination] = useState<string>(INTERNAL_TRANSFER_KEY);
  const [recipientIdentifier, setRecipientIdentifier] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const isInternal = destination === INTERNAL_TRANSFER_KEY;

  const reset = () => {
    setRecipientIdentifier("");
    setAmount("");
    setSelectedWallet("XAF");
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
      const expectedCurrency = COUNTRY_CURRENCIES[destination];
      if (selectedWallet !== expectedCurrency) {
        throw new Error(`Impossible d'effectuer cette opération! Le compte ${selectedWallet} ne correspond pas au pays ${destination} (devise attendue: ${expectedCurrency}).`);
      }
      if (!recipientIdentifier.trim()) throw new Error("Veuillez entrer l'identifiant du destinataire");
      if (!amount || parseFloat(amount) <= 0) throw new Error("Veuillez entrer un montant valide");
      const res = await apiRequest("POST", "/api/transfers", {
        recipientUsername: recipientIdentifier.trim(),
        amount,
        sourceCurrency: selectedWallet,
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
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer de l'argent</DialogTitle>
          <DialogDescription>Transfert instantané vers un compte Ashtech Pay ou international</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Solde à débiter</label>
            <Select value={selectedWallet} onValueChange={setSelectedWallet}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un compte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="XAF">Compte Principal (XAF)</SelectItem>
                {wallets.filter(w => w.currency !== "XAF").map(w => (
                  <SelectItem key={w.id} value={w.currency}>Compte {w.currency} — {w.balance} {w.currency}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Destination</label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger>
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
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <span className="text-green-600 text-sm font-medium">Frais: 0 — Transfert gratuit et instantané</span>
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
      </DialogContent>
    </Dialog>
  );
}

function DepositDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recharger mon compte</DialogTitle>
          <DialogDescription>Ajoutez de l'argent à votre portefeuille</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => depositMutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Montant (XAF)</FormLabel>
                <FormControl><Input type="number" placeholder="10000" {...field} data-testid="input-deposit-amount" /></FormControl>
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
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirer de l'argent</DialogTitle>
          <DialogDescription>Retirez de l'argent vers votre compte</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => withdrawMutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Montant (XAF)</FormLabel>
                <FormControl><Input type="number" placeholder="10000" {...field} data-testid="input-withdraw-amount" /></FormControl>
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
      </DialogContent>
    </Dialog>
  );
}

function VerificationRequiredDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Compte non vérifié
          </DialogTitle>
          <DialogDescription>
            Votre compte n'est pas encore vérifié. Pour utiliser cette fonctionnalité, vous devez d'abord passer la vérification KYC.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}

function CreateLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un lien de paiement</DialogTitle>
          <DialogDescription>Créez un lien pour recevoir des paiements</DialogDescription>
        </DialogHeader>
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
                <FormLabel>Montant (XAF)</FormLabel>
                <FormControl><Input type="number" placeholder="10000" {...field} data-testid="input-link-amount" /></FormControl>
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
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardHome() {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedLink, setSelectedLink] = useState("all");
  const { rates } = useExchangeRates();
  
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: wallets = [] } = useQuery<WalletEntry[]>({ queryKey: ["/api/wallets"] });

  const localCurrency = user?.preferredCurrency || "XAF";
  const balance = localCurrency === "XAF" 
    ? parseFloat(user?.balance || "0")
    : parseFloat(wallets.find(w => w.currency === localCurrency)?.balance || "0");

  const { data: limits } = useQuery<{ minTransfer: number; maxTransfer: number; minWithdrawal: number; maxWithdrawal: number }>({

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">Bienvenue, {user?.fullName}</p>
        </div>

        <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-muted-foreground text-sm mb-1">Solde disponible ({localCurrency})</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-balance">
                  {formatCurrency(localBalance, localCurrency as SupportedCurrency, rates)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Ashtech Pay</p>
              </div>
              <div className="flex flex-col items-end gap-3 flex-shrink-0">
                <button
                  onClick={() => setLocation("/dashboard/wallets")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-sm font-semibold transition-all border border-primary/30"
                  data-testid="button-wallets"
                >
                  <Wallet className="w-4 h-4" />
                  Comptes
                </button>
                <img
                  src={dashboardIllustration}
                  alt="Tableau de bord Ashtech Pay"
                  className="h-16 w-auto object-contain hidden sm:block"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Actions rapides</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QuickActionCard icon={Send} label="Envoyer" color="bg-blue-500/10 text-blue-500" onClick={() => setLocation("/dashboard/send")} testId="button-action-send" />
            <QuickActionCard icon={CreditCard} label="Dépôt" color="bg-green-500/10 text-green-500" onClick={() => setLocation("/dashboard/deposit")} testId="button-action-deposit" />
            <QuickActionCard icon={ArrowDownUp} label="Retirer" color="bg-orange-500/10 text-orange-500" onClick={() => setLocation("/dashboard/withdraw")} testId="button-action-withdraw" />
            <QuickActionCard icon={Link2} label="Lien paiement" color="bg-purple-500/10 text-purple-500" onClick={() => setLocation("/dashboard/links")} testId="button-action-link" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedLink} onValueChange={setSelectedLink}>
              <SelectTrigger className="w-48" data-testid="select-link-filter">
                <SelectValue placeholder="Tous les liens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les liens</SelectItem>
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Clics sur les liens" 
            value={(userStats?.totalClicks || 0).toLocaleString('fr-FR')} 
            icon={MousePointer} 
            color="bg-blue-500/10 text-blue-500"
          />
          <StatCard 
            title="Transactions" 
            value={userStats?.totalTransactions || 0} 
            icon={ArrowDownUp} 
            color="bg-green-500/10 text-green-500"
          />
          <StatCard 
            title="Total collecté" 
            value={formatCurrency(parseFloat(userStats?.totalCollected || "0"), (user?.preferredCurrency || "XAF") as SupportedCurrency, rates)} 
            icon={Wallet} 
            color="bg-primary/10 text-primary"
          />
          <StatCard 
            title="Liens actifs" 
            value={userStats?.activeLinks || 0}
            icon={Link2} 
            color="bg-purple-500/10 text-purple-500"
            href="/dashboard/links"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Montants collectés par période
              </CardTitle>
              <CardDescription>
                {selectedPeriod === "week" ? "Cette semaine" : "Ces 6 derniers mois"}
              </CardDescription>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Résumé
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Total reçu</span>
                <span className="font-bold text-green-500">
                  {formatCurrency(parseFloat(userStats?.totalReceived || "0"), (user?.preferredCurrency || "XAF") as SupportedCurrency, rates)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Total envoyé</span>
                <span className="font-bold text-red-500">
                  {formatCurrency(parseFloat(userStats?.totalSent || "0"), (user?.preferredCurrency || "XAF") as SupportedCurrency, rates)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Ce mois-ci</span>
                <span className="font-bold">{userStats?.monthlyTransactions || 0} transactions</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">En attente</span>
                <span className="font-bold text-orange-500">{userStats?.pendingTransactions || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Transactions récentes</CardTitle>
            <Link href="/dashboard/transactions">
              <Button variant="ghost" size="sm" data-testid="button-view-all-transactions">
                <Eye className="w-4 h-4 mr-2" />
                Tout voir
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucune transaction</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => {
                  const isIncoming = ["deposit", "transfer_in", "payment_link"].includes(tx.type);
                  const typeLabels: Record<string, string> = {
                    deposit: "Dépôt", withdrawal: "Retrait", transfer_in: "Reçu", transfer_out: "Envoyé", payment_link: "Lien de paiement"
                  };
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncoming ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          {isIncoming ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{typeLabels[tx.type] || tx.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.createdAt ? format(new Date(tx.createdAt), "d MMM, HH:mm", { locale: fr }) : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${isIncoming ? 'text-green-500' : 'text-red-500'}`}>
                          {isIncoming ? '+' : '-'}{formatCurrency(tx.amount, (user?.preferredCurrency || "XAF") as SupportedCurrency, rates)}
                        </span>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
