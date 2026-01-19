import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  Clock, 
  ChevronRight, 
  HelpCircle, 
  Send, 
  Plus, 
  X, 
  ArrowLeft,
  CheckCircle,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  message: string;
  isAdmin: boolean;
  createdAt: string | null;
}

const faqs = [
  { question: "Comment recharger mon compte?", answer: "Allez dans Dépôt et choisissez votre mode de paiement préféré (Mobile Money ou Crypto)." },
  { question: "Combien de temps prend un retrait?", answer: "Les retraits sont traités en 24h ouvrées. Mobile Money est généralement plus rapide (quelques minutes)." },
  { question: "Comment créer un lien de paiement?", answer: "Allez dans 'Mes liens', cliquez sur 'Nouveau lien' et remplissez le formulaire." },
  { question: "Quels sont les frais de transaction?", answer: "Les transferts entre utilisateurs Ashtech Pay sont gratuits. Des frais s'appliquent pour les retraits externes." },
];

const statusColors: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-500",
  in_progress: "bg-yellow-500/10 text-yellow-500",
  resolved: "bg-green-500/10 text-green-500",
  closed: "bg-gray-500/10 text-gray-500",
};

const statusLabels: Record<string, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Clôturé",
};

interface SupportContact {
  email: string;
  phone: string;
}

export default function SupportPage() {
  const { toast } = useToast();
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: supportContact } = useQuery<SupportContact>({
    queryKey: ["/api/public/support-contact"],
  });

  const contactOptions = [
    { icon: MessageSquare, title: "Chat en direct", description: "Réponse en quelques minutes", available: true, action: "chat" },
    { icon: Mail, title: "Email", description: supportContact?.email || "support@ashtechpay.com", available: true, action: "email" },
    { icon: Phone, title: "Téléphone", description: supportContact?.phone || "+237 6XX XXX XXX", available: true, action: "phone" },
  ];

  const { data: tickets, isLoading: ticketsLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: ticketData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery<{ ticket: SupportTicket; messages: TicketMessage[] }>({
    queryKey: ["/api/tickets", selectedTicket?.id, "messages"],
    queryFn: async () => {
      const response = await fetch(`/api/tickets/${selectedTicket!.id}/messages`);
      return response.json();
    },
    enabled: !!selectedTicket,
    refetchInterval: selectedTicket ? 5000 : false,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string }) => {
      const response = await apiRequest("POST", "/api/tickets", data);
      return response.json();
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setNewTicketSubject("");
      setNewTicketMessage("");
      setShowNewTicket(false);
      setSelectedTicket(ticket);
      setShowChat(true);
      toast({
        title: "Ticket créé",
        description: "Votre demande a été envoyée avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le ticket.",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedTicket) throw new Error("No ticket selected");
      const response = await apiRequest("POST", `/api/tickets/${selectedTicket.id}/messages`, { message });
      return response.json();
    },
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message.",
        variant: "destructive",
      });
    },
  });

  const closeTicketMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicket) throw new Error("No ticket selected");
      const response = await apiRequest("POST", `/api/tickets/${selectedTicket.id}/close`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      refetchMessages();
      toast({
        title: "Ticket clôturé",
        description: "La conversation a été clôturée.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de clôturer le ticket.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [ticketData?.messages]);

  const handleContactClick = (action: string) => {
    if (action === "chat") {
      setShowChat(true);
      if (!tickets || tickets.length === 0) {
        setShowNewTicket(true);
      }
    } else if (action === "email") {
      window.location.href = "mailto:support@ashtechpay.com";
    } else if (action === "phone") {
      window.location.href = "tel:+237600000000";
    }
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive",
      });
      return;
    }
    createTicketMutation.mutate({
      subject: newTicketSubject,
      message: newTicketMessage,
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;
    sendMessageMutation.mutate(newMessage);
  };

  const openTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowChat(true);
  };

  if (showChat) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-8rem)] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setShowChat(false);
                  setSelectedTicket(null);
                }}
                data-testid="button-back-to-list"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="font-semibold text-foreground">
                  {selectedTicket ? selectedTicket.subject : "Nouveau message"}
                </h2>
                {selectedTicket && (
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[selectedTicket.status] || statusColors.open}>
                      {statusLabels[selectedTicket.status] || selectedTicket.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      #{selectedTicket.id.slice(0, 8)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedTicket && selectedTicket.status !== "closed" && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => closeTicketMutation.mutate()}
                  disabled={closeTicketMutation.isPending}
                  data-testid="button-close-ticket"
                >
                  {closeTicketMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Clôturer
                    </>
                  )}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowNewTicket(true)}
                data-testid="button-new-ticket"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nouveau
              </Button>
            </div>
          </div>

          {!selectedTicket ? (
            <div className="flex-1 p-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Mes conversations</h3>
                {ticketsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : tickets && tickets.length > 0 ? (
                  <div className="space-y-2">
                    {tickets.map((ticket) => (
                      <Card 
                        key={ticket.id} 
                        className="cursor-pointer hover-elevate"
                        onClick={() => openTicket(ticket)}
                        data-testid={`ticket-item-${ticket.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{ticket.subject}</p>
                              <p className="text-sm text-muted-foreground">
                                {ticket.createdAt && format(new Date(ticket.createdAt), "dd MMM yyyy à HH:mm", { locale: fr })}
                              </p>
                            </div>
                            <Badge className={statusColors[ticket.status] || statusColors.open}>
                              {statusLabels[ticket.status] || ticket.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Aucune conversation</p>
                      <Button 
                        className="mt-4"
                        onClick={() => setShowNewTicket(true)}
                        data-testid="button-start-new-conversation"
                      >
                        Démarrer une conversation
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : ticketData?.messages && ticketData.messages.length > 0 ? (
                  <div className="space-y-4">
                    {ticketData.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.isAdmin ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            msg.isAdmin
                              ? "bg-muted rounded-tl-sm"
                              : "bg-primary text-primary-foreground rounded-tr-sm"
                          }`}
                        >
                          {msg.isAdmin && (
                            <p className="text-xs font-medium text-primary mb-1">Support</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <p className={`text-xs mt-1 ${msg.isAdmin ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                            {msg.createdAt && format(new Date(msg.createdAt), "HH:mm", { locale: fr })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Aucun message</p>
                  </div>
                )}
              </ScrollArea>

              {selectedTicket.status !== "closed" && (
                <form onSubmit={handleSendMessage} className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Écrivez votre message..."
                      className="flex-1"
                      disabled={sendMessageMutation.isPending}
                      data-testid="input-message"
                    />
                    <Button 
                      type="submit" 
                      size="icon"
                      disabled={sendMessageMutation.isPending || !newMessage.trim()}
                      data-testid="button-send-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {selectedTicket.status === "closed" && (
                <div className="p-4 border-t bg-muted/50">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Cette conversation est clôturée</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle conversation</DialogTitle>
              <DialogDescription>
                Décrivez votre problème et notre équipe vous répondra rapidement.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="space-y-2">
                <Label>Sujet *</Label>
                <Input
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="Ex: Problème de dépôt"
                  data-testid="input-ticket-subject"
                />
              </div>
              <div className="space-y-2">
                <Label>Message *</Label>
                <Textarea
                  value={newTicketMessage}
                  onChange={(e) => setNewTicketMessage(e.target.value)}
                  placeholder="Décrivez votre problème en détail..."
                  className="min-h-32"
                  data-testid="input-ticket-message"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowNewTicket(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createTicketMutation.isPending}>
                  {createTicketMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support</h1>
          <p className="text-muted-foreground">Comment pouvons-nous vous aider?</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {contactOptions.map((option) => (
            <Card 
              key={option.title} 
              className="hover-elevate cursor-pointer overflow-hidden"
              onClick={() => handleContactClick(option.action)}
              data-testid={`contact-option-${option.action}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                    <option.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{option.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{option.description}</p>
                    {option.available && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-500 mt-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Disponible
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {tickets && tickets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Mes conversations
              </CardTitle>
              <CardDescription>Consultez vos échanges avec notre équipe support</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tickets.slice(0, 3).map((ticket) => (
                <div 
                  key={ticket.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover-elevate"
                  onClick={() => openTicket(ticket)}
                  data-testid={`recent-ticket-${ticket.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{ticket.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {ticket.createdAt && format(new Date(ticket.createdAt), "dd MMM yyyy", { locale: fr })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[ticket.status] || statusColors.open}>
                      {statusLabels[ticket.status] || ticket.status}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {tickets.length > 3 && (
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setShowChat(true)}
                >
                  Voir toutes les conversations ({tickets.length})
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Questions fréquentes
            </CardTitle>
            <CardDescription>Trouvez rapidement des réponses à vos questions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {faqs.map((faq, index) => (
              <details key={index} className="group">
                <summary className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer list-none">
                  <span className="font-medium text-foreground">{faq.question}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-2 px-3 text-sm text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Clock className="w-8 h-8 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Heures de support</p>
                <p className="text-sm text-muted-foreground">Lundi - Vendredi: 8h - 20h | Samedi: 9h - 17h | Dimanche: Fermé</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle conversation</DialogTitle>
              <DialogDescription>
                Décrivez votre problème et notre équipe vous répondra rapidement.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="space-y-2">
                <Label>Sujet *</Label>
                <Input
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="Ex: Problème de dépôt"
                  data-testid="input-new-ticket-subject"
                />
              </div>
              <div className="space-y-2">
                <Label>Message *</Label>
                <Textarea
                  value={newTicketMessage}
                  onChange={(e) => setNewTicketMessage(e.target.value)}
                  placeholder="Décrivez votre problème en détail..."
                  className="min-h-32"
                  data-testid="input-new-ticket-message"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowNewTicket(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createTicketMutation.isPending}>
                  {createTicketMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
