import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transferSchema, depositSchema, withdrawSchema, createPaymentLinkSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Transaction, PaymentLink } from "@shared/schema";
import {
  Wallet,
  Send,
  ArrowDownUp,
  CreditCard,
  Link2,
  History,
  LogOut,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  Loader2,
  Plus,
  ExternalLink,
  User as UserIcon,
  Menu
} from "lucide-react";
import logoImage from "@assets/photo_2026-01-10_21-16-00_1768076188815.jpg";
import { z } from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function formatCurrency(amount: string | number) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-FR").format(num) + " XAF";
}

function DashboardHeader({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/dashboard">
            <div className="flex items-center cursor-pointer">
              <img src={logoImage} alt="Ashtech-Pay Afrique" className="h-12 w-auto" />
            </div>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg border border-border">
              <UserIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{user.fullName}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onLogout} data-testid="button-logout">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function WalletCard({ balance }: { balance: string }) {
  return (
    <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm mb-1">Solde disponible</p>
            <p className="text-3xl sm:text-4xl font-bold text-foreground" data-testid="text-balance">
              {formatCurrency(balance)}
            </p>
          </div>
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions({ onAction }: { onAction: (action: string) => void }) {
  const actions = [
    { id: "send", icon: Send, label: "Envoyer", color: "bg-blue-500/10 text-blue-500" },
    { id: "deposit", icon: CreditCard, label: "Recharger", color: "bg-green-500/10 text-green-500" },
    { id: "withdraw", icon: ArrowDownUp, label: "Retirer", color: "bg-orange-500/10 text-orange-500" },
    { id: "link", icon: Link2, label: "Lien paiement", color: "bg-purple-500/10 text-purple-500" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {actions.map((action) => (
        <Card 
          key={action.id}
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => onAction(action.id)}
          data-testid={`button-action-${action.id}`}
        >
          <CardContent className="p-4 flex flex-col items-center gap-2">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${action.color}`}>
              <action.icon className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-foreground">{action.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const isIncoming = transaction.type === "deposit" || transaction.type === "transfer_in" || transaction.type === "payment_link";
  const statusIcons = {
    pending: <Clock className="w-4 h-4 text-yellow-500" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
    cancelled: <XCircle className="w-4 h-4 text-muted-foreground" />,
  };

  const typeLabels: Record<string, string> = {
    deposit: "Recharge",
    withdrawal: "Retrait",
    transfer_in: "Reçu",
    transfer_out: "Envoyé",
    payment_link: "Lien de paiement",
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncoming ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          {isIncoming ? (
            <TrendingUp className="w-5 h-5 text-green-500" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-500" />
          )}
        </div>
        <div>
          <p className="font-medium text-foreground">{typeLabels[transaction.type] || transaction.type}</p>
          <p className="text-xs text-muted-foreground">
            {transaction.createdAt ? format(new Date(transaction.createdAt), "d MMM yyyy, HH:mm", { locale: fr }) : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${isIncoming ? 'text-green-500' : 'text-red-500'}`}>
          {isIncoming ? '+' : '-'}{formatCurrency(transaction.amount)}
        </span>
        {statusIcons[transaction.status as keyof typeof statusIcons]}
      </div>
    </div>
  );
}

function TransactionsList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Aucune transaction pour le moment</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {transactions.map((tx) => (
        <TransactionItem key={tx.id} transaction={tx} />
      ))}
    </div>
  );
}

function PaymentLinkItem({ paymentLink }: { paymentLink: PaymentLink }) {
  const { toast } = useToast();
  const linkUrl = `${window.location.origin}/pay/${paymentLink.slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(linkUrl);
    toast({
      title: "Lien copié",
      description: "Le lien de paiement a été copié dans le presse-papier.",
    });
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{paymentLink.title}</p>
        <p className="text-sm text-muted-foreground">{formatCurrency(paymentLink.amount)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={copyLink} data-testid={`button-copy-link-${paymentLink.id}`}>
          <Copy className="w-4 h-4" />
        </Button>
        <a href={linkUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="icon" data-testid={`button-open-link-${paymentLink.id}`}>
            <ExternalLink className="w-4 h-4" />
          </Button>
        </a>
      </div>
    </div>
  );
}

function SendMoneyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      recipientUsername: "",
      amount: "",
      description: "",
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: z.infer<typeof transferSchema>) => {
      const res = await apiRequest("POST", "/api/transfers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Transfert réussi",
        description: "L'argent a été envoyé avec succès.",
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Le transfert a échoué",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer de l'argent</DialogTitle>
          <DialogDescription>
            Transférez de l'argent à un autre utilisateur Ashtech Pay
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => transferMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="recipientUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom d'utilisateur du destinataire</FormLabel>
                  <FormControl>
                    <Input placeholder="@utilisateur" data-testid="input-recipient" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant (XAF)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="10000" data-testid="input-amount" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="Pour le dîner..." data-testid="input-description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={transferMutation.isPending} data-testid="button-send-money">
              {transferMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                "Envoyer"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DepositDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: "",
      paymentMethod: "mobile_money",
    },
  });

  const depositMutation = useMutation({
    mutationFn: async (data: z.infer<typeof depositSchema>) => {
      const res = await apiRequest("POST", "/api/deposits", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Recharge réussie",
        description: "Votre compte a été rechargé avec succès.",
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "La recharge a échoué",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recharger le compte</DialogTitle>
          <DialogDescription>
            Ajoutez des fonds à votre compte Ashtech Pay
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => depositMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant (XAF)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="50000" data-testid="input-deposit-amount" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Méthode de paiement</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payment-method">
                        <SelectValue placeholder="Choisir une méthode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mobile_money">Mobile Money (MTN/Orange)</SelectItem>
                      <SelectItem value="crypto">Crypto (USDT)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={depositMutation.isPending} data-testid="button-deposit">
              {depositMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                "Recharger"
              )}
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
    defaultValues: {
      amount: "",
      paymentMethod: "mobile_money",
      accountDetails: "",
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: z.infer<typeof withdrawSchema>) => {
      const res = await apiRequest("POST", "/api/withdrawals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Retrait initié",
        description: "Votre demande de retrait est en cours de traitement.",
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Le retrait a échoué",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retirer de l'argent</DialogTitle>
          <DialogDescription>
            Retirez des fonds vers votre compte externe
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => withdrawMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant (XAF)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="25000" data-testid="input-withdraw-amount" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Méthode de retrait</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-withdraw-method">
                        <SelectValue placeholder="Choisir une méthode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">Virement bancaire</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro de compte / téléphone</FormLabel>
                  <FormControl>
                    <Input placeholder="+237 6XX XXX XXX" data-testid="input-account-details" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={withdrawMutation.isPending} data-testid="button-withdraw">
              {withdrawMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                "Retirer"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CreatePaymentLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof createPaymentLinkSchema>>({
    resolver: zodResolver(createPaymentLinkSchema),
    defaultValues: {
      title: "",
      description: "",
      amount: "",
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createPaymentLinkSchema>) => {
      const res = await apiRequest("POST", "/api/payment-links", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      const linkUrl = `${window.location.origin}/pay/${data.slug}`;
      navigator.clipboard.writeText(linkUrl);
      toast({
        title: "Lien créé",
        description: "Le lien de paiement a été créé et copié dans le presse-papier.",
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "La création du lien a échoué",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un lien de paiement</DialogTitle>
          <DialogDescription>
            Créez un lien à partager pour recevoir des paiements
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createLinkMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl>
                    <Input placeholder="Paiement pour..." data-testid="input-link-title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant (XAF)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="15000" data-testid="input-link-amount" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="Description du paiement..." data-testid="input-link-description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={createLinkMutation.isPending} data-testid="button-create-link">
              {createLinkMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer le lien"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: paymentLinks = [], isLoading: linksLoading } = useQuery<PaymentLink[]>({
    queryKey: ["/api/payment-links"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/");
    },
  });

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} onLogout={() => logoutMutation.mutate()} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <WalletCard balance={user.balance} />
        
        <QuickActions onAction={setActiveDialog} />
        
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transactions" data-testid="tab-transactions">
              <History className="w-4 h-4 mr-2" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="links" data-testid="tab-links">
              <Link2 className="w-4 h-4 mr-2" />
              Liens de paiement
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Historique des transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {txLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <TransactionsList transactions={transactions} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="links">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="text-lg">Mes liens de paiement</CardTitle>
                <Button size="sm" onClick={() => setActiveDialog("link")} data-testid="button-new-link">
                  <Plus className="w-4 h-4 mr-1" />
                  Nouveau
                </Button>
              </CardHeader>
              <CardContent>
                {linksLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : paymentLinks.length === 0 ? (
                  <div className="text-center py-12">
                    <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucun lien de paiement créé</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {paymentLinks.map((link) => (
                      <PaymentLinkItem key={link.id} paymentLink={link} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <SendMoneyDialog open={activeDialog === "send"} onClose={() => setActiveDialog(null)} />
      <DepositDialog open={activeDialog === "deposit"} onClose={() => setActiveDialog(null)} />
      <WithdrawDialog open={activeDialog === "withdraw"} onClose={() => setActiveDialog(null)} />
      <CreatePaymentLinkDialog open={activeDialog === "link"} onClose={() => setActiveDialog(null)} />
    </div>
  );
}
