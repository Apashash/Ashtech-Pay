import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Ban,
  CheckCircle,
  XCircle,
  Shield,
  Edit,
  Trash2,
  DollarSign,
  ArrowLeft,
  FileSearch,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  LogIn,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ALL_FX_CURRENCIES } from "@shared/schema";

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone: string | null;
  country: string | null;
  preferredCurrency: string;
  balance: string;
  totalBalanceXAF?: number;
  isVerified: boolean;
  kycStatus: string;
  isBanned: boolean;
  banReason: string | null;
  withdrawalBlocked: boolean;
  withdrawalBlockReason: string | null;
  role: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
  fee: string | null;
}

const CURRENCY_FLAGS: Record<string, string> = {
  XAF: "🇨🇲", XAFC: "🇨🇬", XAFG: "🇬🇦",
  XOF: "🇸🇳", XOFC: "🇨🇮", XOFF: "🇧🇫", XOFN: "🇳🇪", XOFB: "🇧🇯", XOFT: "🇹🇬", XOFS: "🇸🇳", XOFM: "🇲🇱",
  GHS: "🇬🇭", NGN: "🇳🇬", KES: "🇰🇪", RWF: "🇷🇼", TZS: "🇹🇿",
  UGX: "🇺🇬", CDF: "🇨🇩", GNF: "🇬🇳", GMD: "🇬🇲",
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", CHF: "🇨🇭",
  MAD: "🇲🇦", EGP: "🇪🇬", ZAR: "🇿🇦",
};

const COUNTRY_FLAGS: Record<string, string> = {
  "Cameroun": "🇨🇲", "Cameroon": "🇨🇲", "Togo": "🇹🇬",
  "Sénégal": "🇸🇳", "Senegal": "🇸🇳", "Côte d'Ivoire": "🇨🇮", "Ivory Coast": "🇨🇮",
  "Mali": "🇲🇱", "Bénin": "🇧🇯", "Benin": "🇧🇯", "Burkina Faso": "🇧🇫",
  "Niger": "🇳🇪", "Guinée": "🇬🇳", "Guinée Conakry": "🇬🇳", "Ghana": "🇬🇭",
  "Nigeria": "🇳🇬", "Nigéria": "🇳🇬", "Kenya": "🇰🇪", "Rwanda": "🇷🇼",
  "Tanzanie": "🇹🇿", "Tanzania": "🇹🇿", "Ouganda": "🇺🇬", "Uganda": "🇺🇬",
  "Congo RDC": "🇨🇩", "RD Congo": "🇨🇩", "Congo": "🇨🇬", "Congo Brazzaville": "🇨🇬",
  "Gabon": "🇬🇦", "Guinée-Bissau": "🇬🇼", "Guinée Équatoriale": "🇬🇶",
  "Centrafrique": "🇨🇫", "Tchad": "🇹🇩",
};

function getCountryFlag(country: string | null, currency: string): string {
  if (country && COUNTRY_FLAGS[country]) return COUNTRY_FLAGS[country];
  return CURRENCY_FLAGS[currency] || "🏳️";
}

function getRoleBadge(role: string) {
  switch (role) {
    case "admin": return <Badge className="bg-red-500">Admin</Badge>;
    case "support": return <Badge className="bg-blue-500">Support</Badge>;
    case "finance": return <Badge className="bg-green-500">Finance</Badge>;
    default: return <Badge variant="secondary">User</Badge>;
  }
}

function getTxIcon(type: string) {
  if (type === "deposit" || type === "payment_link") return <ArrowDownLeft className="w-4 h-4 text-green-500 shrink-0" />;
  if (type === "withdrawal") return <ArrowUpRight className="w-4 h-4 text-red-500 shrink-0" />;
  return <ArrowLeftRight className="w-4 h-4 text-blue-500 shrink-0" />;
}

function getTxLabel(type: string) {
  const labels: Record<string, string> = {
    deposit: "Dépôt",
    withdrawal: "Retrait",
    transfer_in: "Reçu",
    transfer_out: "Envoi",
    payment_link: "Lien paiement",
    conversion: "Conversion",
  };
  return labels[type] || type;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed": return <Badge className="bg-green-500 text-xs px-1.5 py-0">Complété</Badge>;
    case "pending": return <Badge variant="secondary" className="text-xs px-1.5 py-0">En attente</Badge>;
    case "failed": return <Badge variant="destructive" className="text-xs px-1.5 py-0">Échoué</Badge>;
    case "cancelled": return <Badge variant="outline" className="text-xs px-1.5 py-0">Annulé</Badge>;
    default: return <Badge variant="outline" className="text-xs px-1.5 py-0">{status}</Badge>;
  }
}

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState("profil");
  const [txPage, setTxPage] = useState(1);

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: "", email: "", phone: "", role: "" });
  const [banModal, setBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [deleteModal, setDeleteModal] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [balanceModal, setBalanceModal] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [balanceCurrency, setBalanceCurrency] = useState("XAF");
  const [updateType, setUpdateType] = useState<"set" | "add">("set");
  const [balanceTab, setBalanceTab] = useState<"modifier" | "convertir">("modifier");
  const [convFrom, setConvFrom] = useState("");
  const [convTo, setConvTo] = useState("");
  const [convAmount, setConvAmount] = useState("");

  const authHeaders = localStorage.getItem("ashtech_auth_token")
    ? { Authorization: `Bearer ${localStorage.getItem("ashtech_auth_token")}` }
    : {};

  const { data: user, isLoading, refetch } = useQuery<User>({
    queryKey: [`/api/admin/users/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${id}`, { credentials: "include", headers: authHeaders });
      if (!res.ok) throw new Error("Utilisateur introuvable");
      return res.json();
    },
  });

  const { data: wallets, refetch: refetchWallets } = useQuery<any[]>({
    queryKey: [`/api/admin/users/${id}/wallets`],
    enabled: !!id,
  });

  const { data: fxRates = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/public/exchange-rates"],
  });

  const { data: conversionFeeSetting } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/conversion_fee_percent"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/conversion_fee_percent");
      return res.json();
    },
  });

  const { data: txData, isLoading: txLoading } = useQuery<{ data: Transaction[]; total: number; pages: number }>({
    queryKey: [`/api/admin/transactions`, id, txPage],
    queryFn: async () => {
      const params = new URLSearchParams({ userId: id!, page: String(txPage), limit: "20" });
      const res = await fetch(`/api/admin/transactions?${params}`, { credentials: "include", headers: authHeaders });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    enabled: !!id,
  });

  const walletList = user ? [
    { currency: user.preferredCurrency, balance: user.balance, isPrimary: true },
    ...(wallets || []).filter((w: any) => w.currency !== user.preferredCurrency).map((w: any) => ({ currency: w.currency, balance: w.balance, isPrimary: false })),
  ] : [];

  const convFeePercent = conversionFeeSetting?.value ? parseFloat(conversionFeeSetting.value) : 6;

  const getWalletBalance = (currency: string) => {
    if (!user) return "0.00";
    if (currency === user.preferredCurrency) return user.balance;
    return wallets?.find((w: any) => w.currency === currency)?.balance || "0.00";
  };

  const convPreview = (() => {
    if (!convFrom || !convTo || !convAmount || convFrom === convTo) return null;
    const amount = parseFloat(convAmount);
    if (isNaN(amount) || amount <= 0) return null;
    const fee = (amount * convFeePercent) / 100;
    const afterFee = amount - fee;
    const fromRate = (fxRates as Record<string, number>)[convFrom] || 1;
    const toRate = (fxRates as Record<string, number>)[convTo] || 1;
    const received = (afterFee * fromRate) / toRate;
    const srcBalance = parseFloat(walletList.find(w => w.currency === convFrom)?.balance || "0");
    return { fee, received, srcBalance, sufficient: srcBalance >= amount };
  })();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${id}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${id}/wallets`] });
    refetch();
    refetchWallets();
  };

  const kycMutation = useMutation({
    mutationFn: async ({ kycStatus }: { kycStatus: string }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, { kycStatus, isVerified: kycStatus === "verified" }),
    onSuccess: () => { invalidate(); toast({ title: "Statut KYC mis à jour" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: object) => apiRequest("PATCH", `/api/admin/users/${id}`, data),
    onSuccess: () => { invalidate(); toast({ title: "Utilisateur mis à jour" }); setEditModal(false); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const banMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/users/${id}/ban`, { reason: banReason }),
    onSuccess: () => { invalidate(); toast({ title: "Utilisateur banni" }); setBanModal(false); setBanReason(""); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const unbanMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/users/${id}/unban`),
    onSuccess: () => { invalidate(); toast({ title: "Utilisateur débanni" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const blockMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/users/${id}/block-withdrawal`, { reason: blockReason }),
    onSuccess: () => { invalidate(); toast({ title: "Retraits bloqués" }); setBlockModal(false); setBlockReason(""); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const unblockMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/users/${id}/unblock-withdrawal`),
    onSuccess: () => { invalidate(); toast({ title: "Retraits débloqués" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => { toast({ title: "Utilisateur supprimé" }); navigate("/admin/users"); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const impersonateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${id}/impersonate`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur");
      return json;
    },
    onSuccess: (data) => {
      queryClient.clear();
      toast({ title: `Connecté en tant que @${data.username}` });
      navigate("/dashboard");
    },
    onError: (err: Error) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/balance`, { amount: newBalance, currency: balanceCurrency, type: updateType });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur");
      return json;
    },
    onSuccess: () => { invalidate(); toast({ title: "Solde mis à jour" }); setNewBalance(""); },
    onError: (err: Error) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/convert`, { fromCurrency: convFrom, toCurrency: convTo, amount: convAmount });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur");
      return json;
    },
    onSuccess: (data) => {
      invalidate();
      toast({ title: "Conversion effectuée", description: `${data.fromAmount.toFixed(2)} ${data.fromCurrency} → ${data.toAmount.toFixed(2)} ${data.toCurrency}` });
      setConvAmount("");
    },
    onError: (err: Error) => toast({ title: "Erreur de conversion", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-4">
          <Button variant="ghost" onClick={() => navigate("/admin/users")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Retour aux utilisateurs
          </Button>
          <p className="text-muted-foreground">Utilisateur introuvable.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">{getCountryFlag(user.country, user.preferredCurrency || "XAF")}</span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{user.fullName}</h1>
              <p className="text-sm text-muted-foreground">@{user.username} · {user.country || "Pays inconnu"}</p>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="profil" className="flex-1">Profil</TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1">
              Transactions {txData?.total != null ? `(${txData.total})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* ─── ONGLET PROFIL ─────────────────────────────── */}
          <TabsContent value="profil" className="space-y-4 mt-4">
            {/* Soldes */}
            <Card>
              <CardContent className="pt-5 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Soldes</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center p-3 rounded-lg border bg-primary/10 text-center border-primary/30">
                    <span className="text-lg">{getCountryFlag(user.country, user.preferredCurrency || "XAF")}</span>
                    <span className="text-xs font-bold text-primary mt-1">{user.preferredCurrency || "XAF"} ★</span>
                    <span className={`text-sm font-bold mt-0.5 ${parseFloat(user.balance) > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                      {parseFloat(user.balance).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  {wallets?.filter((w: any) => w.currency !== user.preferredCurrency).map((wallet: any) => (
                    <div key={wallet.id} className="flex flex-col items-center p-3 rounded-lg border bg-muted/40 text-center">
                      <span className="text-lg">{CURRENCY_FLAGS[wallet.currency] || "🏳️"}</span>
                      <span className="text-xs font-bold mt-1">{wallet.currency}</span>
                      <span className={`text-sm font-bold mt-0.5 ${parseFloat(wallet.balance) > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                        {parseFloat(wallet.balance).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
                {(user.totalBalanceXAF ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground text-right">
                    Total : <span className="font-semibold text-foreground">{formatCurrency(user.totalBalanceXAF ?? 0, "XAF")}</span>
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Informations */}
            <Card>
              <CardContent className="pt-5 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informations</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium truncate">{user.email}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{user.phone || "—"}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Rôle</p>
                    <div className="mt-0.5">{getRoleBadge(user.role)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">KYC</p>
                    <div className="mt-0.5">
                      {user.kycStatus === "verified" ? (
                        <Badge className="bg-green-500 gap-1 text-xs"><CheckCircle className="w-3 h-3" /> Vérifié</Badge>
                      ) : user.kycStatus === "rejected" ? (
                        <Badge variant="destructive" className="gap-1 text-xs"><XCircle className="w-3 h-3" /> Rejeté</Badge>
                      ) : user.kycStatus === "pending" ? (
                        <Badge variant="secondary" className="gap-1 text-xs"><Shield className="w-3 h-3" /> En attente</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs"><XCircle className="w-3 h-3" /> Non vérifié</Badge>
                      )}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Inscrit le</p>
                    <p className="font-medium">{user.createdAt ? format(new Date(user.createdAt), "dd/MM/yyyy", { locale: fr }) : "—"}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Statut</p>
                    <div className="mt-0.5 flex flex-col gap-1">
                      {user.isBanned
                        ? <Badge variant="destructive" className="gap-1 text-xs w-fit"><Ban className="w-3 h-3" /> Banni</Badge>
                        : <Badge className="bg-green-500 gap-1 text-xs w-fit"><CheckCircle className="w-3 h-3" /> Actif</Badge>
                      }
                      {user.withdrawalBlocked && (
                        <Badge variant="outline" className="gap-1 text-xs text-orange-500 border-orange-500/50 w-fit"><Ban className="w-3 h-3" /> Retraits bloqués</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {user.banReason && (
                  <p className="text-xs text-red-500 mt-2 p-2 bg-red-500/10 rounded-lg">Raison du ban : {user.banReason}</p>
                )}
                {user.withdrawalBlocked && user.withdrawalBlockReason && (
                  <p className="text-xs text-orange-500 mt-2 p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    🔒 Retraits bloqués : {user.withdrawalBlockReason}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-5 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline" size="sm" className="gap-2 justify-start"
                    onClick={() => { setEditForm({ fullName: user.fullName, email: user.email, phone: user.phone || "", role: user.role }); setEditModal(true); }}
                  >
                    <Edit className="w-4 h-4" /> Modifier
                  </Button>
                  <Button
                    variant="outline" size="sm" className="gap-2 justify-start"
                    onClick={() => { setBalanceCurrency(user.preferredCurrency || "XAF"); setNewBalance(user.balance); setUpdateType("set"); setBalanceModal(true); }}
                  >
                    <DollarSign className="w-4 h-4" /> Modifier le solde
                  </Button>
                  <Button
                    variant="outline" size="sm" className="gap-2 justify-start col-span-2"
                    onClick={() => navigate(`/admin/kyc?search=${encodeURIComponent(user.username)}`)}
                  >
                    <FileSearch className="w-4 h-4" /> Voir le KYC
                  </Button>
                  {user.kycStatus !== "verified" && (
                    <Button
                      variant="outline" size="sm" className="gap-2 justify-start text-green-600"
                      onClick={() => kycMutation.mutate({ kycStatus: "verified" })}
                      disabled={kycMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4" /> Approuver KYC
                    </Button>
                  )}
                  {user.kycStatus !== "rejected" && (
                    <Button
                      variant="outline" size="sm" className="gap-2 justify-start text-orange-500"
                      onClick={() => kycMutation.mutate({ kycStatus: "rejected" })}
                      disabled={kycMutation.isPending}
                    >
                      <XCircle className="w-4 h-4" /> Rejeter KYC
                    </Button>
                  )}
                  {user.isBanned ? (
                    <Button
                      variant="outline" size="sm" className="gap-2 justify-start text-green-600"
                      onClick={() => unbanMutation.mutate()}
                      disabled={unbanMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4" /> Débannir
                    </Button>
                  ) : (
                    <Button
                      variant="outline" size="sm" className="gap-2 justify-start text-red-500"
                      onClick={() => { setBanReason(""); setBanModal(true); }}
                    >
                      <Ban className="w-4 h-4" /> Bannir
                    </Button>
                  )}
                  {user.withdrawalBlocked ? (
                    <Button
                      variant="outline" size="sm" className="gap-2 justify-start text-green-600"
                      onClick={() => unblockMutation.mutate()}
                      disabled={unblockMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4" /> Débloquer retraits
                    </Button>
                  ) : (
                    <Button
                      variant="outline" size="sm" className="gap-2 justify-start text-orange-500"
                      onClick={() => { setBlockReason(""); setBlockModal(true); }}
                    >
                      <Ban className="w-4 h-4" /> Bloquer retraits/envois
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm" className="gap-2 justify-start text-red-500"
                    onClick={() => setDeleteModal(true)}
                  >
                    <Trash2 className="w-4 h-4" /> Supprimer
                  </Button>
                  <Button
                    variant="default" size="sm" className="gap-2 justify-start col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => impersonateMutation.mutate()}
                    disabled={impersonateMutation.isPending}
                  >
                    <LogIn className="w-4 h-4" />
                    {impersonateMutation.isPending ? "Connexion..." : `Se connecter en tant que @${user.username}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── ONGLET TRANSACTIONS ───────────────────────── */}
          <TabsContent value="transactions" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {txLoading ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">Chargement...</div>
                ) : !txData?.data?.length ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">Aucune transaction trouvée</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[36px]"></TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Montant</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="hidden sm:table-cell">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {txData.data.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="pr-0">{getTxIcon(tx.type)}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="text-sm font-medium">{getTxLabel(tx.type)}</p>
                                  {tx.description && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">{tx.description}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <span className={`font-semibold text-sm ${
                                  tx.type === "deposit" || tx.type === "payment_link" || tx.type === "transfer_in"
                                    ? "text-green-600"
                                    : "text-red-500"
                                }`}>
                                  {tx.type === "deposit" || tx.type === "payment_link" || tx.type === "transfer_in" ? "+" : "-"}
                                  {parseFloat(tx.amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {tx.currency}
                                </span>
                                {tx.fee && parseFloat(tx.fee) > 0 && (
                                  <p className="text-xs text-muted-foreground">Frais : {parseFloat(tx.fee).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</p>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(tx.status)}</TableCell>
                              <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                                {tx.createdAt ? format(new Date(tx.createdAt), "dd/MM/yy HH:mm", { locale: fr }) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {(txData.pages || 1) > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <span className="text-xs text-muted-foreground">
                          Page {txPage} / {txData.pages} — {txData.total} transactions
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={txPage <= 1} onClick={() => setTxPage(p => Math.max(1, p - 1))}>
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" disabled={txPage >= txData.pages} onClick={() => setTxPage(p => p + 1)}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── MODALS ──────────────────────────────────────────── */}

      {/* Modifier */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier {user.fullName}</DialogTitle>
            <DialogDescription>Modifiez les informations de l'utilisateur</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(false)}>Annuler</Button>
            <Button onClick={() => updateUserMutation.mutate(editForm)} disabled={updateUserMutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bannir */}
      <Dialog open={banModal} onOpenChange={setBanModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bannir {user.fullName}</DialogTitle></DialogHeader>
          <div className="py-4">
            <Textarea placeholder="Raison du bannissement..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanModal(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => banMutation.mutate()} disabled={banMutation.isPending}>Bannir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bloquer retraits */}
      <Dialog open={blockModal} onOpenChange={setBlockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-orange-500">Bloquer retraits et envois</DialogTitle>
            <DialogDescription>L'utilisateur ne pourra plus effectuer de retraits ni d'envois.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm text-muted-foreground">Raison (visible par l'utilisateur)</label>
            <Textarea placeholder="Ex : Activité suspecte détectée..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockModal(false)}>Annuler</Button>
            <Button variant="destructive" className="bg-orange-600 hover:bg-orange-700" onClick={() => blockMutation.mutate()} disabled={blockMutation.isPending}>
              {blockMutation.isPending ? "En cours..." : "Bloquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supprimer */}
      <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">Supprimer l'utilisateur</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Toutes les données de <strong>{user.fullName}</strong> seront supprimées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModal(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modifier le solde */}
      <Dialog open={balanceModal} onOpenChange={(open) => { if (!open) { setBalanceModal(false); setNewBalance(""); setConvAmount(""); setBalanceTab("modifier"); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Soldes de {user.fullName}</DialogTitle>
            <DialogDescription>Modifiez directement les soldes ou convertissez entre devises ({convFeePercent}% de frais).</DialogDescription>
          </DialogHeader>
          <Tabs value={balanceTab} onValueChange={(v) => setBalanceTab(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="modifier" className="flex-1">Modifier solde</TabsTrigger>
              <TabsTrigger value="convertir" className="flex-1">Convertir</TabsTrigger>
            </TabsList>
            <TabsContent value="modifier" className="space-y-4 mt-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Comptes existants — cliquez pour sélectionner</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {walletList.map(w => {
                    const bal = parseFloat(w.balance);
                    const isSelected = balanceCurrency === w.currency;
                    return (
                      <button
                        key={w.currency}
                        onClick={() => { setBalanceCurrency(w.currency); setNewBalance(w.balance); setUpdateType("set"); }}
                        className={`relative flex flex-col items-center gap-1 p-3 rounded-lg border text-sm font-medium transition-all ${isSelected ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border hover:border-primary/50 hover:bg-muted/60"}`}
                      >
                        {w.isPrimary && <span className="absolute top-1 right-1 text-[9px] bg-primary/20 text-primary rounded px-1">Principal</span>}
                        <span className="text-lg">{CURRENCY_FLAGS[w.currency] || "🌍"}</span>
                        <span className="font-bold">{w.currency}</span>
                        <span className={`text-xs ${bal > 0 ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>
                          {bal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="border rounded-lg p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">Autre devise</p>
                <Select
                  value={walletList.some(w => w.currency === balanceCurrency) ? "" : balanceCurrency}
                  onValueChange={(v) => { setBalanceCurrency(v); setNewBalance(getWalletBalance(v)); setUpdateType("set"); }}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir une devise…" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ALL_FX_CURRENCIES.filter(c => !walletList.some(w => w.currency === c.code)).map(c => (
                      <SelectItem key={c.code} value={c.code}>{CURRENCY_FLAGS[c.code] || "🌍"} {c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={updateType} onValueChange={(v: any) => setUpdateType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="set">Définir le montant exact</SelectItem>
                        <SelectItem value="add">Ajouter au solde actuel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Montant ({balanceCurrency})</Label>
                    <Input type="text" inputMode="decimal" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <Button className="w-full" onClick={() => updateBalanceMutation.mutate()} disabled={updateBalanceMutation.isPending || !newBalance}>
                  {updateBalanceMutation.isPending ? "Mise à jour..." : `Mettre à jour ${balanceCurrency}`}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="convertir" className="space-y-4 mt-4">
              <div className="rounded-lg border bg-primary/5 p-3 text-sm text-muted-foreground">
                Frais de conversion : <span className="font-semibold text-primary">{convFeePercent}%</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Devise source</Label>
                  <Select value={convFrom} onValueChange={(v) => { setConvFrom(v); if (v === convTo) setConvTo(""); }}>
                    <SelectTrigger><SelectValue placeholder="De…" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {walletList.map(w => (
                        <SelectItem key={w.currency} value={w.currency}>
                          {CURRENCY_FLAGS[w.currency] || "🌍"} {w.currency}
                          <span className="text-muted-foreground ml-1 text-xs">({parseFloat(w.balance).toLocaleString("fr-FR", { maximumFractionDigits: 2 })})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Devise cible</Label>
                  <Select value={convTo} onValueChange={setConvTo}>
                    <SelectTrigger><SelectValue placeholder="Vers…" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {ALL_FX_CURRENCIES.filter(c => c.code !== convFrom).map(c => (
                        <SelectItem key={c.code} value={c.code}>{CURRENCY_FLAGS[c.code] || "🌍"} {c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Montant à convertir {convFrom ? `(${convFrom})` : ""}</Label>
                <Input type="text" inputMode="decimal" value={convAmount} onChange={(e) => setConvAmount(e.target.value)} placeholder="0.00" />
              </div>
              {convPreview && (
                <div className={`rounded-lg border p-3 space-y-2 text-sm ${convPreview.sufficient ? "bg-muted/30" : "bg-red-500/10 border-red-500/30"}`}>
                  {!convPreview.sufficient && <p className="text-red-500 font-medium text-xs">Solde insuffisant en {convFrom}</p>}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frais ({convFeePercent}%)</span>
                    <span className="font-medium text-orange-500">- {convPreview.fee.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} {convFrom}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Montant reçu (estimation)</span>
                    <span className="font-bold text-green-600">{convPreview.received.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} {convTo}</span>
                  </div>
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending || !convFrom || !convTo || !convAmount || convFrom === convTo || (convPreview ? !convPreview.sufficient : false)}
              >
                {convertMutation.isPending ? "Conversion en cours..." : convFrom && convTo ? `Convertir ${convFrom} → ${convTo}` : "Sélectionner les devises"}
              </Button>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBalanceModal(false); setNewBalance(""); setConvAmount(""); setBalanceTab("modifier"); }}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
