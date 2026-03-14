import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, 
  Ban, 
  CheckCircle, 
  XCircle, 
  Shield,
  Eye,
  MoreHorizontal,
  Edit,
  Trash2,
  DollarSign,
  RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  isVerified: boolean;
  kycStatus: string;
  isBanned: boolean;
  banReason: string | null;
  role: string;
  createdAt: string;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const searchParams = useSearch();
  const urlSearch = new URLSearchParams(searchParams).get("search") || "";
  const [search, setSearch] = useState(urlSearch);
  const [banModal, setBanModal] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", email: "", phone: "", role: "" });
  const [deleteModal, setDeleteModal] = useState<User | null>(null);
  const [balanceModal, setBalanceModal] = useState<User | null>(null);
  const [newBalance, setNewBalance] = useState("");
  const [balanceCurrency, setBalanceCurrency] = useState("XAF");
  const [updateType, setUpdateType] = useState<"set" | "add">("set");
  const [balanceTab, setBalanceTab] = useState<"modifier" | "convertir">("modifier");
  const [convFrom, setConvFrom] = useState("");
  const [convTo, setConvTo] = useState("");
  const [convAmount, setConvAmount] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: userWallets, refetch: refetchUserWallets } = useQuery<any[]>({
    queryKey: [`/api/admin/users/${balanceModal?.id}/wallets`],
    enabled: !!balanceModal,
  });

  const { data: fxRates = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/public/exchange-rates"],
    enabled: !!balanceModal,
  });

  const { data: conversionFeeSetting } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/conversion_fee_percent"],
    enabled: !!balanceModal,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/conversion_fee_percent");
      return res.json();
    },
  });

  const { data: viewUserWallets } = useQuery<any[]>({
    queryKey: [`/api/admin/users/${viewUser?.id}/wallets`],
    enabled: !!viewUser,
  });

  const CURRENCY_FLAGS: Record<string, string> = {
    XAF: "🇨🇲", XAFC: "🇨🇬", XAFG: "🇬🇦",
    XOF: "🇸🇳", XOFC: "🇨🇮", XOFF: "🇧🇫", XOFN: "🇳🇪", XOFB: "🇧🇯", XOFT: "🇹🇬", XOFS: "🇸🇳", XOFM: "🇲🇱",
    GHS: "🇬🇭", NGN: "🇳🇬", KES: "🇰🇪", RWF: "🇷🇼", TZS: "🇹🇿",
    UGX: "🇺🇬", CDF: "🇨🇩", GNF: "🇬🇳", GMD: "🇬🇲",
    USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", CHF: "🇨🇭",
    MAD: "🇲🇦", EGP: "🇪🇬", ZAR: "🇿🇦",
  };
  const COUNTRY_FLAGS: Record<string, string> = {
    "Cameroun": "🇨🇲", "Cameroon": "🇨🇲",
    "Togo": "🇹🇬",
    "Sénégal": "🇸🇳", "Senegal": "🇸🇳",
    "Côte d'Ivoire": "🇨🇮", "Ivory Coast": "🇨🇮",
    "Mali": "🇲🇱",
    "Bénin": "🇧🇯", "Benin": "🇧🇯",
    "Burkina Faso": "🇧🇫",
    "Niger": "🇳🇪",
    "Guinée": "🇬🇳", "Guinée Conakry": "🇬🇳",
    "Ghana": "🇬🇭",
    "Nigeria": "🇳🇬", "Nigéria": "🇳🇬",
    "Kenya": "🇰🇪",
    "Rwanda": "🇷🇼",
    "Tanzanie": "🇹🇿", "Tanzania": "🇹🇿",
    "Ouganda": "🇺🇬", "Uganda": "🇺🇬",
    "Congo RDC": "🇨🇩", "RD Congo": "🇨🇩",
    "Congo": "🇨🇬", "Congo Brazzaville": "🇨🇬",
    "Gabon": "🇬🇦",
    "Guinée-Bissau": "🇬🇼",
    "Guinée Équatoriale": "🇬🇶",
    "Centrafrique": "🇨🇫",
    "Tchad": "🇹🇩",
  };
  const getCountryFlag = (country: string | null, currency: string): string => {
    if (country && COUNTRY_FLAGS[country]) return COUNTRY_FLAGS[country];
    return CURRENCY_FLAGS[currency] || "🏳️";
  };

  const getWalletBalance = (currency: string): string => {
    if (!balanceModal) return "0.00";
    if (currency === balanceModal.preferredCurrency) return balanceModal.balance;
    return userWallets?.find((w: any) => w.currency === currency)?.balance || "0.00";
  };

  const userWalletList = balanceModal ? [
    { currency: balanceModal.preferredCurrency, balance: balanceModal.balance, isPrimary: true },
    ...(userWallets || [])
      .filter((w: any) => w.currency !== balanceModal.preferredCurrency)
      .map((w: any) => ({ currency: w.currency, balance: w.balance, isPrimary: false })),
  ] : [];

  const convFeePercent = conversionFeeSetting?.value ? parseFloat(conversionFeeSetting.value) : 6;
  const xafRate = (fxRates as Record<string, number>)["XAF"] || 585;

  const convPreview = (() => {
    if (!convFrom || !convTo || !convAmount || convFrom === convTo) return null;
    const amount = parseFloat(convAmount);
    if (isNaN(amount) || amount <= 0) return null;
    const fee = (amount * convFeePercent) / 100;
    const afterFee = amount - fee;
    const fromRate = (fxRates as Record<string, number>)[convFrom] || xafRate;
    const toRate = (fxRates as Record<string, number>)[convTo] || xafRate;
    const inXAF = afterFee * (xafRate / fromRate);
    const received = inXAF * (toRate / xafRate);
    const srcBalance = parseFloat(userWalletList.find(w => w.currency === convFrom)?.balance || "0");
    return { fee, received, srcBalance, sufficient: srcBalance >= amount };
  })();

  useEffect(() => {
    if (urlSearch) {
      setSearch(urlSearch);
    }
  }, [urlSearch]);

  const { data: usersData, isLoading } = useQuery<{ data: User[]; total: number; pages: number }>({
    queryKey: ["/api/admin/users", page, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/admin/users?${params}`, { credentials: "include", headers: { ...(localStorage.getItem("ashtech_auth_token") ? { Authorization: `Bearer ${localStorage.getItem("ashtech_auth_token")}` } : {}) } });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
  });
  const users = usersData?.data;

  const banMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", `/api/admin/users/${id}/ban`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Utilisateur banni" });
      setBanModal(null);
      setBanReason("");
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/users/${id}/unban`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Utilisateur débanni" });
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const kycMutation = useMutation({
    mutationFn: async ({ id, kycStatus }: { id: string; kycStatus: string }) => {
      const isVerified = kycStatus === "verified";
      return apiRequest("PATCH", `/api/admin/users/${id}`, { kycStatus, isVerified });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Statut KYC mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const setRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Rôle mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { fullName?: string; email?: string; phone?: string; role?: string } }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Utilisateur mis à jour" });
      setEditUser(null);
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Utilisateur supprimé" });
      setDeleteModal(null);
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async ({ id, balance, currency, type }: { id: string; balance: string; currency: string; type: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/balance`, { amount: balance, currency, type });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${balanceModal?.id}/wallets`] });
      refetchUserWallets();
      toast({ title: "Solde mis à jour avec succès" });
      setNewBalance("");
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const adminConvertMutation = useMutation({
    mutationFn: async ({ id, fromCurrency, toCurrency, amount }: { id: string; fromCurrency: string; toCurrency: string; amount: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/convert`, { fromCurrency, toCurrency, amount });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur");
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${balanceModal?.id}/wallets`] });
      refetchUserWallets();
      toast({
        title: "Conversion effectuée",
        description: `${data.fromAmount.toFixed(2)} ${data.fromCurrency} → ${data.toAmount.toFixed(2)} ${data.toCurrency} (Frais: ${data.feeAmount.toFixed(2)} ${data.fromCurrency})`,
      });
      setConvAmount("");
    },
    onError: (err: Error) => {
      toast({ title: "Erreur de conversion", description: err.message, variant: "destructive" });
    },
  });

  const openEditModal = (user: User) => {
    setEditForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
    });
    setEditUser(user);
  };

  const handleEditSubmit = () => {
    if (editUser) {
      updateUserMutation.mutate({
        id: editUser.id,
        data: editForm,
      });
    }
  };

  const getDisplayCurrency = (user: User) => {
    const COUNTRY_CURRENCIES: Record<string, string> = {
      "Cameroun": "XAF",
      "Sénégal": "XOF",
      "Côte d'Ivoire": "XOF",
      "Togo": "XOF",
      "Bénin": "XOF",
      "Burkina Faso": "XOF",
      "Mali": "XOF",
      "Niger": "XOF",
      "Gabon": "XAF",
      "Congo Brazzaville": "XAF",
      "Congo": "XAF",
      "Tchad": "XAF",
      "République Centrafricaine": "XAF",
      "Guinée Équatoriale": "XAF",
      "Nigeria": "NGN",
      "Ghana": "GHS",
      "Kenya": "KES",
      "Ouganda": "UGX",
      "Rwanda": "RWF",
      "Tanzanie": "TZS",
      "RDC": "CDF",
      "RD Congo": "CDF"
    };

    // Special cases for specific labels seen in database/UI
    const country = user.country?.trim();
    if (country === "Togo") return "XOF";
    if (country === "RD Congo" || country === "RDC" || country === "Congo Kinshasa") return "CDF";
    if (country === "Sénégal") return "XOF";
    if (country === "Benin" || country === "Bénin") return "XOF";
    if (country === "Ivory Coast" || country === "Côte d'Ivoire") return "XOF";
    if (country === "Burkina Faso" || country === "Burkina") return "XOF";

    if (user.preferredCurrency && user.preferredCurrency !== "XAF") {
      return user.preferredCurrency;
    }
    if (country && COUNTRY_CURRENCIES[country]) {
      return COUNTRY_CURRENCIES[country];
    }
    return "XAF";
  };

  const filteredUsers = users || [];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500">Admin</Badge>;
      case "support":
        return <Badge className="bg-blue-500">Support</Badge>;
      case "finance":
        return <Badge className="bg-green-500">Finance</Badge>;
      default:
        return <Badge variant="secondary">User</Badge>;
    }
  };

  const fixCurrenciesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/fix-currencies", {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur");
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Mise à jour réussie", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Gestion des Utilisateurs</h1>
            <p className="text-muted-foreground">{usersData?.total || 0} utilisateurs</p>
          </div>
          <Button 
            onClick={() => {
              if (window.confirm("Voulez-vous synchroniser la devise de tous les utilisateurs avec celle de leur pays ?")) {
                fixCurrenciesMutation.mutate();
              }
            }} 
            disabled={fixCurrenciesMutation.isPending}
            variant="outline"
            className="gap-2 shrink-0"
            title="Actualiser les devises locales"
          >
            <RefreshCw className={fixCurrenciesMutation.isPending ? "animate-spin w-4 h-4" : "w-4 h-4"} />
            <span className="hidden sm:inline">Sync devises</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Utilisateur</TableHead>
                  <TableHead className="min-w-[160px]">Contact</TableHead>
                  <TableHead className="min-w-[70px]">Pays</TableHead>
                  <TableHead className="min-w-[100px]">Solde</TableHead>
                  <TableHead className="min-w-[110px]">Statut</TableHead>
                  <TableHead className="min-w-[80px]">Rôle</TableHead>
                  <TableHead className="min-w-[100px]">Inscrit le</TableHead>
                  <TableHead className="text-right min-w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucun utilisateur trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell className="max-w-[160px]">
                        <div className="space-y-0.5">
                          <p className="font-medium text-sm truncate">{user.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="text-sm space-y-0.5">
                          <p className="truncate">{user.email}</p>
                          <p className="text-muted-foreground text-xs truncate">{user.phone || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{user.country || "-"}</TableCell>
                      <TableCell className="font-medium text-sm whitespace-nowrap">
                        {formatCurrency(parseFloat(user.balance), getDisplayCurrency(user) as any)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {user.isBanned ? (
                            <Badge variant="destructive" className="gap-1 text-xs whitespace-nowrap">
                              <Ban className="w-3 h-3" /> Banni
                            </Badge>
                          ) : user.kycStatus === "verified" ? (
                            <Badge className="bg-green-500 gap-1 text-xs whitespace-nowrap">
                              <CheckCircle className="w-3 h-3" /> Vérifié
                            </Badge>
                          ) : user.kycStatus === "rejected" ? (
                            <Badge variant="destructive" className="gap-1 text-xs whitespace-nowrap">
                              <XCircle className="w-3 h-3" /> Rejeté
                            </Badge>
                          ) : user.kycStatus === "pending" ? (
                            <Badge variant="secondary" className="gap-1 text-xs whitespace-nowrap">
                              <Shield className="w-3 h-3" /> En attente
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-xs whitespace-nowrap">
                              <XCircle className="w-3 h-3" /> Non vérifié
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {user.createdAt ? format(new Date(user.createdAt), "dd/MM/yy", { locale: fr }) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${user.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewUser(user)}>
                              <Eye className="w-4 h-4 mr-2" /> Voir détails
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditModal(user)}>
                              <Edit className="w-4 h-4 mr-2" /> Modifier
                            </DropdownMenuItem>
                            {user.kycStatus !== "verified" && (
                              <DropdownMenuItem onClick={() => kycMutation.mutate({ id: user.id, kycStatus: "verified" })}>
                                <CheckCircle className="w-4 h-4 mr-2" /> Approuver KYC
                              </DropdownMenuItem>
                            )}
                            {user.kycStatus !== "pending" && user.kycStatus !== "not_submitted" && (
                              <DropdownMenuItem onClick={() => kycMutation.mutate({ id: user.id, kycStatus: "pending" })}>
                                <Shield className="w-4 h-4 mr-2" /> Mettre en attente
                              </DropdownMenuItem>
                            )}
                            {user.kycStatus !== "rejected" && (
                              <DropdownMenuItem onClick={() => kycMutation.mutate({ id: user.id, kycStatus: "rejected" })}>
                                <XCircle className="w-4 h-4 mr-2" /> Rejeter KYC
                              </DropdownMenuItem>
                            )}
                            {user.kycStatus !== "not_submitted" && (
                              <DropdownMenuItem onClick={() => kycMutation.mutate({ id: user.id, kycStatus: "not_submitted" })}>
                                <XCircle className="w-4 h-4 mr-2" /> Réinitialiser KYC
                              </DropdownMenuItem>
                            )}
                            {user.isBanned ? (
                              <DropdownMenuItem onClick={() => unbanMutation.mutate(user.id)}>
                                <CheckCircle className="w-4 h-4 mr-2" /> Débannir
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setBanModal(user)} className="text-red-500">
                                <Ban className="w-4 h-4 mr-2" /> Bannir
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setRoleMutation.mutate({ id: user.id, role: "admin" })}>
                              <Shield className="w-4 h-4 mr-2" /> Rendre Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setRoleMutation.mutate({ id: user.id, role: "support" })}>
                              <Shield className="w-4 h-4 mr-2" /> Rendre Support
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setRoleMutation.mutate({ id: user.id, role: "user" })}>
                              <Shield className="w-4 h-4 mr-2" /> Remettre User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setBalanceCurrency(user.preferredCurrency || "XAF");
                              setNewBalance(user.balance);
                              setUpdateType("set");
                              setBalanceModal(user);
                            }}>
                              <DollarSign className="w-4 h-4 mr-2" /> Modifier le solde
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteModal(user)} className="text-red-500">
                              <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
            {(usersData?.pages || 1) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Page {page} / {usersData?.pages || 1} — {usersData?.total || 0} utilisateurs
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    Précédent
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= (usersData?.pages || 1)} onClick={() => setPage(p => p + 1)}>
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!banModal} onOpenChange={() => setBanModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bannir {banModal?.fullName}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Raison du bannissement..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                data-testid="input-ban-reason"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBanModal(null)}>
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => banModal && banMutation.mutate({ id: banModal.id, reason: banReason })}
                data-testid="button-confirm-ban"
              >
                Bannir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Détails de {viewUser?.fullName}</DialogTitle>
            </DialogHeader>
            {viewUser && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">ID</p>
                    <p className="font-mono text-xs">{viewUser.id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Username</p>
                    <p>@{viewUser.username}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p>{viewUser.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Téléphone</p>
                    <p>{viewUser.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pays</p>
                    <p>{viewUser.country || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Devise</p>
                    <p>{viewUser.preferredCurrency}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground mb-2">Soldes</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center p-2 rounded border bg-primary/10 text-center border-primary/30">
                        <span className="text-base">{getCountryFlag(viewUser.country, viewUser.preferredCurrency || "XAF")}</span>
                        <span className="text-xs font-bold text-primary">{viewUser.preferredCurrency || "XAF"} ★</span>
                        <span className={`text-xs font-semibold ${parseFloat(viewUser.balance) > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                          {parseFloat(viewUser.balance).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      {viewUserWallets?.map((wallet: any) => (
                        <div key={wallet.id} className="flex flex-col items-center p-2 rounded border bg-muted/40 text-center">
                          <span className="text-base">{CURRENCY_FLAGS[wallet.currency] || "🏳️"}</span>
                          <span className="text-xs font-bold">{wallet.currency}</span>
                          <span className={`text-xs font-semibold ${parseFloat(wallet.balance) > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                            {parseFloat(wallet.balance).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rôle</p>
                    {getRoleBadge(viewUser.role)}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Statut KYC</p>
                    {viewUser.kycStatus === "verified" ? (
                      <Badge className="bg-green-500 gap-1">
                        <CheckCircle className="w-3 h-3" /> Vérifié
                      </Badge>
                    ) : viewUser.kycStatus === "rejected" ? (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="w-3 h-3" /> Rejeté
                      </Badge>
                    ) : viewUser.kycStatus === "pending" ? (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="w-3 h-3" /> En attente
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <XCircle className="w-3 h-3" /> Pas encore vérifié
                      </Badge>
                    )}
                  </div>
                  {viewUser.banReason && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Raison du ban</p>
                      <p className="text-red-500">{viewUser.banReason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier {editUser?.fullName}</DialogTitle>
              <DialogDescription>Modifiez les informations de l'utilisateur</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  data-testid="input-edit-fullname"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  data-testid="input-edit-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  data-testid="input-edit-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
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
              <Button variant="outline" onClick={() => setEditUser(null)}>
                Annuler
              </Button>
              <Button 
                onClick={handleEditSubmit}
                disabled={updateUserMutation.isPending}
                data-testid="button-save-user"
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteModal} onOpenChange={() => setDeleteModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-500">Supprimer l'utilisateur</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir supprimer définitivement {deleteModal?.fullName} (@{deleteModal?.username}) ? 
                Cette action est irréversible et supprimera toutes les données associées.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteModal(null)}>
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteModal && deleteUserMutation.mutate(deleteModal.id)}
                disabled={deleteUserMutation.isPending}
                data-testid="button-confirm-delete"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer définitivement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!balanceModal} onOpenChange={(open) => { if (!open) { setBalanceModal(null); setNewBalance(""); setConvAmount(""); setBalanceTab("modifier"); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Soldes de {balanceModal?.fullName}</DialogTitle>
              <DialogDescription>
                Modifiez directement les soldes ou convertissez entre devises avec les frais configurés ({convFeePercent}%).
              </DialogDescription>
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
                    {userWalletList.map(w => {
                      const bal = parseFloat(w.balance);
                      const isSelected = balanceCurrency === w.currency;
                      return (
                        <button
                          key={w.currency}
                          onClick={() => { setBalanceCurrency(w.currency); setNewBalance(w.balance); setUpdateType("set"); }}
                          className={`relative flex flex-col items-center gap-1 p-3 rounded-lg border text-sm font-medium transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border hover:border-primary/50 hover:bg-muted/60"
                          }`}
                        >
                          {w.isPrimary && (
                            <span className="absolute top-1 right-1 text-[9px] bg-primary/20 text-primary rounded px-1">Principal</span>
                          )}
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
                  <p className="text-xs text-muted-foreground mb-2">Autre devise (ajouter ou corriger)</p>
                  <Select
                    value={userWalletList.some(w => w.currency === balanceCurrency) ? "" : balanceCurrency}
                    onValueChange={(v) => { setBalanceCurrency(v); setNewBalance(getWalletBalance(v)); setUpdateType("set"); }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choisir une devise…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {ALL_FX_CURRENCIES
                        .filter(c => !userWalletList.some(w => w.currency === c.code))
                        .map(c => (
                          <SelectItem key={c.code} value={c.code}>
                            {CURRENCY_FLAGS[c.code] || "🌍"} {c.code} — {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                    <span>{CURRENCY_FLAGS[balanceCurrency] || "🌍"}</span>
                    Modifier <span className="text-primary">{balanceCurrency}</span>
                    <span className="text-muted-foreground font-normal text-xs">
                      (actuel : {parseFloat(getWalletBalance(balanceCurrency)).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {balanceCurrency})
                    </span>
                  </p>
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
                      <Input
                        type="number" step="0.01" value={newBalance}
                        onChange={(e) => setNewBalance(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  {updateType === "add" && newBalance && parseFloat(newBalance) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nouveau solde estimé :{" "}
                      <span className="font-semibold text-green-600">
                        {(parseFloat(getWalletBalance(balanceCurrency)) + parseFloat(newBalance)).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {balanceCurrency}
                      </span>
                    </p>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => balanceModal && updateBalanceMutation.mutate({ id: balanceModal.id, balance: newBalance, currency: balanceCurrency, type: updateType })}
                    disabled={updateBalanceMutation.isPending || !newBalance}
                  >
                    {updateBalanceMutation.isPending ? "Mise à jour..." : `Mettre à jour ${balanceCurrency}`}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="convertir" className="space-y-4 mt-4">
                <div className="rounded-lg border bg-primary/5 p-3 text-sm text-muted-foreground">
                  Frais de conversion appliqués : <span className="font-semibold text-primary">{convFeePercent}%</span>
                  <span className="text-xs ml-1">(configurés dans les paramètres admin)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Devise source</Label>
                    <Select value={convFrom} onValueChange={(v) => { setConvFrom(v); if (v === convTo) setConvTo(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="De…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {userWalletList.map(w => (
                          <SelectItem key={w.currency} value={w.currency}>
                            {CURRENCY_FLAGS[w.currency] || "🌍"} {w.currency}
                            <span className="text-muted-foreground ml-1 text-xs">
                              ({parseFloat(w.balance).toLocaleString("fr-FR", { maximumFractionDigits: 2 })})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Devise cible</Label>
                    <Select value={convTo} onValueChange={setConvTo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vers…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {ALL_FX_CURRENCIES
                          .filter(c => c.code !== convFrom)
                          .map(c => (
                            <SelectItem key={c.code} value={c.code}>
                              {CURRENCY_FLAGS[c.code] || "🌍"} {c.code} — {c.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Montant à convertir {convFrom ? `(${convFrom})` : ""}</Label>
                  <Input
                    type="number" step="0.01" value={convAmount}
                    onChange={(e) => setConvAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  {convFrom && (
                    <p className="text-xs text-muted-foreground">
                      Disponible : <span className="font-medium">{parseFloat(userWalletList.find(w => w.currency === convFrom)?.balance || "0").toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {convFrom}</span>
                    </p>
                  )}
                </div>

                {convPreview && (
                  <div className={`rounded-lg border p-3 space-y-2 text-sm ${convPreview.sufficient ? "bg-muted/30" : "bg-red-500/10 border-red-500/30"}`}>
                    {!convPreview.sufficient && (
                      <p className="text-red-500 font-medium text-xs">Solde insuffisant en {convFrom}</p>
                    )}
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
                  onClick={() => balanceModal && adminConvertMutation.mutate({
                    id: balanceModal.id,
                    fromCurrency: convFrom,
                    toCurrency: convTo,
                    amount: convAmount,
                  })}
                  disabled={adminConvertMutation.isPending || !convFrom || !convTo || !convAmount || convFrom === convTo || (convPreview ? !convPreview.sufficient : false)}
                >
                  {adminConvertMutation.isPending
                    ? "Conversion en cours..."
                    : convFrom && convTo
                      ? `Convertir ${convFrom} → ${convTo}`
                      : "Sélectionner les devises"}
                </Button>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setBalanceModal(null); setNewBalance(""); setConvAmount(""); setBalanceTab("modifier"); }}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
