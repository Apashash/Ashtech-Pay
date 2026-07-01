import { getAdminPath } from "@/lib/adminPath";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "./layout";
const A = getAdminPath();
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Power,
  User
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PaymentLink } from "@shared/schema";

interface PaymentLinkWithUser extends PaymentLink {
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  } | null;
}

export default function AdminLinks() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: links, isLoading } = useQuery<PaymentLinkWithUser[]>({
    queryKey: ["/api/admin/payment-links"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/admin/payment-links/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-links"] });
      toast({ title: "Lien mis à jour" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const filteredLinks = links?.filter(link => {
    const matchesSearch = link.title.toLowerCase().includes(search.toLowerCase()) ||
      link.slug.toLowerCase().includes(search.toLowerCase()) ||
      link.user?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      link.user?.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && link.isActive) ||
      (statusFilter === "inactive" && !link.isActive);
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Liens de Paiement</h1>
            <p className="text-muted-foreground">{links?.length || 0} liens</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par titre, slug ou utilisateur..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-links"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Créateur</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Clics</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">Chargement...</TableCell>
                  </TableRow>
                ) : !filteredLinks.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucun lien trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLinks.map((link) => (
                    <TableRow key={link.id} data-testid={`link-row-${link.id}`}>
                      <TableCell>
                        {link.user ? (
                          <Link href={`${A}/users?search=${encodeURIComponent(link.user.email)}`}>
                            <div className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <User className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{link.user.fullName}</p>
                                <p className="text-xs text-muted-foreground">{link.user.email}</p>
                              </div>
                            </div>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{link.title}</p>
                          {link.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{link.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{link.slug}</TableCell>
                      <TableCell>
                        {link.isFixedAmount 
                          ? formatCurrency(parseFloat(link.amount), link.currency as any)
                          : <Badge variant="outline">Flexible</Badge>
                        }
                      </TableCell>
                      <TableCell>{link.clickCount}</TableCell>
                      <TableCell>
                        {link.isActive ? (
                          <Badge className="bg-green-500 gap-1">
                            <CheckCircle className="w-3 h-3" /> Actif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="w-3 h-3" /> Inactif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {link.createdAt ? format(new Date(link.createdAt), "d MMM yyyy", { locale: fr }) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            asChild
                          >
                            <a href={`/pay/${link.slug}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => toggleMutation.mutate({ id: link.id, isActive: !link.isActive })}
                            className={link.isActive ? "text-orange-500" : "text-green-500"}
                            data-testid={`button-toggle-${link.id}`}
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
