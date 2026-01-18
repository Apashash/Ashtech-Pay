import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Trash2,
  User,
  Mail,
  Phone,
  Loader2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SupportTicket, TicketMessage } from "@shared/schema";

interface TicketUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
}

interface TicketWithMessages {
  ticket: SupportTicket;
  messages: TicketMessage[];
  user: TicketUser | null;
}

export default function AdminSupport() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/admin/tickets"],
  });

  const { data: ticketDetail, refetch: refetchDetail } = useQuery<TicketWithMessages>({
    queryKey: ["/api/admin/tickets", selectedTicket],
    queryFn: async () => {
      const response = await fetch(`/api/admin/tickets/${selectedTicket}`);
      return response.json();
    },
    enabled: !!selectedTicket,
    refetchInterval: selectedTicket ? 5000 : false,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/tickets/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      refetchDetail();
      toast({ title: "Statut mis à jour" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      return apiRequest("POST", `/api/admin/tickets/${id}/messages`, { message });
    },
    onSuccess: () => {
      refetchDetail();
      setNewMessage("");
      toast({ title: "Message envoyé" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/tickets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      setSelectedTicket(null);
      setDeleteConfirm(null);
      toast({ title: "Ticket supprimé" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/admin/tickets`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      setSelectedTicket(null);
      setDeleteAllConfirm(false);
      toast({ title: "Tous les tickets ont été supprimés" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [ticketDetail?.messages]);

  const filteredTickets = tickets?.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-blue-500/10 text-blue-500 gap-1"><AlertCircle className="w-3 h-3" /> Ouvert</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-500/10 text-yellow-500 gap-1"><Clock className="w-3 h-3" /> En cours</Badge>;
      case "resolved":
        return <Badge className="bg-green-500/10 text-green-500 gap-1"><CheckCircle className="w-3 h-3" /> Résolu</Badge>;
      case "closed":
        return <Badge className="bg-gray-500/10 text-gray-500 gap-1"><XCircle className="w-3 h-3" /> Clôturé</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-500/10 text-orange-500">Haute</Badge>;
      case "medium":
        return <Badge variant="secondary">Moyenne</Badge>;
      case "low":
        return <Badge variant="outline">Basse</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTicket && newMessage.trim()) {
      sendMessageMutation.mutate({ id: selectedTicket, message: newMessage });
    }
  };

  const openCount = tickets?.filter(t => t.status === "open").length || 0;
  const inProgressCount = tickets?.filter(t => t.status === "in_progress").length || 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Support & Tickets</h1>
            <p className="text-muted-foreground">
              {tickets?.length || 0} tickets total · {openCount} ouverts · {inProgressCount} en cours
            </p>
          </div>
          {tickets && tickets.length > 0 && (
            <Button 
              variant="destructive"
              onClick={() => setDeleteAllConfirm(true)}
              data-testid="button-delete-all-tickets"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer tous les tickets
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par sujet..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-tickets"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="open">Ouverts</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="resolved">Résolus</SelectItem>
                  <SelectItem value="closed">Clôturés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : !filteredTickets.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun ticket trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id} data-testid={`ticket-row-${ticket.id}`}>
                      <TableCell className="font-medium max-w-[200px] truncate">{ticket.subject}</TableCell>
                      <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell>
                        {ticket.createdAt ? format(new Date(ticket.createdAt), "d MMM yyyy", { locale: fr }) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedTicket(ticket.id)}
                            data-testid={`button-view-ticket-${ticket.id}`}
                          >
                            <MessageSquare className="w-4 h-4 mr-1" /> Voir
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(ticket.id)}
                            data-testid={`button-delete-ticket-${ticket.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
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

        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-4 flex-wrap">
                <span className="truncate flex-1">{ticketDetail?.ticket.subject}</span>
                <div className="flex items-center gap-2">
                  {ticketDetail?.ticket && (
                    <Select
                      value={ticketDetail.ticket.status}
                      onValueChange={(status) => {
                        if (selectedTicket) {
                          updateStatusMutation.mutate({ id: selectedTicket, status });
                        }
                      }}
                    >
                      <SelectTrigger className="w-36" data-testid="select-ticket-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Ouvert</SelectItem>
                        <SelectItem value="in_progress">En cours</SelectItem>
                        <SelectItem value="resolved">Résolu</SelectItem>
                        <SelectItem value="closed">Clôturé</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => selectedTicket && setDeleteConfirm(selectedTicket)}
                    data-testid="button-delete-current-ticket"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            {ticketDetail?.user && (
              <div className="bg-muted/50 rounded-lg p-4 mb-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{ticketDetail.user.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{ticketDetail.user.email}</span>
                  </div>
                  {ticketDetail.user.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{ticketDetail.user.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 py-4">
                {ticketDetail?.messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.isAdmin ? "justify-end" : "justify-start"}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.isAdmin 
                          ? "bg-primary text-primary-foreground rounded-tr-sm" 
                          : "bg-muted rounded-tl-sm"
                      }`}
                    >
                      {!msg.isAdmin && (
                        <p className="text-xs font-medium text-primary mb-1">Client</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.isAdmin ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {msg.createdAt ? format(new Date(msg.createdAt), "HH:mm", { locale: fr }) : ""}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {ticketDetail?.ticket.status !== "closed" && (
              <form onSubmit={handleSendMessage} className="flex gap-2 pt-4 border-t">
                <Input
                  placeholder="Votre réponse..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-ticket-message"
                />
                <Button 
                  type="submit"
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            )}

            {ticketDetail?.ticket.status === "closed" && (
              <div className="p-4 border-t bg-muted/50 rounded-b-lg">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Cette conversation est clôturée</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce ticket ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Tous les messages associés seront également supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer tous les tickets ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Tous les tickets et leurs messages seront définitivement supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteAllMutation.mutate()}
                disabled={deleteAllMutation.isPending}
              >
                {deleteAllMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Supprimer tout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
