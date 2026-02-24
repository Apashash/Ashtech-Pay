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
  DollarSign
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

  const { data: userWallets } = useQuery<any[]>({
    queryKey: [`/api/admin/users/${viewUser?.id}/wallets`],
    enabled: !!viewUser,
  });

  useEffect(() => {
    if (urlSearch) {
      setSearch(urlSearch);
    }
  }, [urlSearch]);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

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
      return apiRequest("PATCH", `/api/admin/users/${id}/balance`, { amount: balance, currency, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${balanceModal?.id}/wallets`] });
      toast({ title: "Solde mis à jour" });
      setBalanceModal(null);
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour du solde", variant: "destructive" });
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

  const filteredUsers = users?.filter(user => 
    user.fullName.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    user.username.toLowerCase().includes(search.toLowerCase())
  ) || [];

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

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestion des Utilisateurs</h1>
            <p className="text-muted-foreground">{users?.length || 0} utilisateurs</p>
          </div>
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Solde</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{user.email}</p>
                          <p className="text-muted-foreground">{user.phone || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>{user.country || "-"}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(parseFloat(user.balance), user.preferredCurrency as any)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.isBanned ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="w-3 h-3" /> Banni
                            </Badge>
                          ) : user.kycStatus === "verified" ? (
                            <Badge className="bg-green-500 gap-1">
                              <CheckCircle className="w-3 h-3" /> Vérifié
                            </Badge>
                          ) : user.kycStatus === "rejected" ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="w-3 h-3" /> Rejeté
                            </Badge>
                          ) : user.kycStatus === "pending" ? (
                            <Badge variant="secondary" className="gap-1">
                              <Shield className="w-3 h-3" /> En attente
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <XCircle className="w-3 h-3" /> Pas encore vérifié
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        {user.createdAt ? format(new Date(user.createdAt), "d MMM yyyy", { locale: fr }) : "-"}
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
                              setNewBalance(user.balance);
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
                  <div>
                    <p className="text-muted-foreground">Solde</p>
                    <div className="space-y-1">
                      <p className="font-bold">{formatCurrency(parseFloat(viewUser.balance), "XAF")}</p>
                      {userWallets?.map((wallet: any) => (
                        <p key={wallet.id} className="text-xs font-medium">
                          {formatCurrency(parseFloat(wallet.balance), wallet.currency as any)}
                        </p>
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
          <DialogContent className="max-w-lg">
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

        <Dialog open={!!balanceModal} onOpenChange={() => setBalanceModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le solde de {balanceModal?.fullName}</DialogTitle>
              <DialogDescription>
                Créditez ou définissez le solde de l'utilisateur pour n'importe quelle devise.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Devise</Label>
                <Select value={balanceCurrency} onValueChange={setBalanceCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["XAF", "XOF", "GHS", "NGN", "KES", "RWF", "TZS", "UGX", "CDF", "GNF", "USD"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type de modification</Label>
                <Select value={updateType} onValueChange={(v: any) => setUpdateType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="set">Définir le montant exact</SelectItem>
                    <SelectItem value="add">Ajouter au solde actuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Montant</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBalanceModal(null)}>
                Annuler
              </Button>
              <Button 
                onClick={() => balanceModal && updateBalanceMutation.mutate({ 
                  id: balanceModal.id, 
                  balance: newBalance,
                  currency: balanceCurrency,
                  type: updateType
                })}
                disabled={updateBalanceMutation.isPending}
              >
                {updateBalanceMutation.isPending ? "Mise à jour..." : "Mettre à jour le solde"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
