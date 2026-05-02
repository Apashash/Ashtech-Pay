import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  MessageSquare, Mail, ExternalLink, ChevronRight, Send, Plus, ArrowLeft,
  CheckCircle, Loader2, Check
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useSSE } from "@/hooks/use-sse";
import { cn } from "@/lib/utils";

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
  readByAdmin: boolean;
  readByUser: boolean;
  createdAt: string | null;
}

interface SupportContact { email: string; phone: string; }

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

// Read receipt ticks component
function MessageTicks({ msg, adminOnline }: { msg: TicketMessage; adminOnline: boolean }) {
  if (msg.isAdmin) return null;
  if (msg.readByAdmin) {
    return (
      <span className="inline-flex gap-0.5 ml-1" title="Lu">
        <Check className="w-3 h-3 text-blue-400" strokeWidth={3} />
        <Check className="w-3 h-3 text-blue-400 -ml-1.5" strokeWidth={3} />
      </span>
    );
  }
  if (adminOnline) {
    return (
      <span className="inline-flex gap-0.5 ml-1" title="Envoyé (admin en ligne)">
        <Check className="w-3 h-3 text-primary" strokeWidth={3} />
        <Check className="w-3 h-3 text-primary -ml-1.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="inline-flex gap-0.5 ml-1" title="Envoyé">
      <Check className="w-3 h-3 text-primary-foreground/40" strokeWidth={3} />
    </span>
  );
}

export default function SupportPage() {
  const { toast } = useToast();
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [adminTyping, setAdminTyping] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef(false);

  const { data: supportContact } = useQuery<SupportContact>({ queryKey: ["/api/public/support-contact"] });
  const { data: ticketStats } = useQuery<{ unreadCount: number; totalCount: number }>({
    queryKey: ["/api/tickets/stats"],
    refetchInterval: 10000,
  });

  const whatsappPhone = (supportContact?.phone || "+237600000000").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=Bonjour%20Ashtech%20Pay%2C%20j%27ai%20besoin%20d%27aide.`;

  const contactOptions = [
    { icon: MessageSquare, title: "Chat en direct", description: "Réponse en quelques minutes", available: true, action: "chat", badge: ticketStats?.unreadCount || 0 },
    { icon: Mail, title: "Email", description: supportContact?.email || "support@ashtechpay.com", available: true, action: "email", badge: 0 },
    { icon: SiWhatsapp, title: "WhatsApp", description: supportContact?.phone || "+237 6XX XXX XXX", available: true, action: "whatsapp", badge: 0 },
  ];

  const { data: tickets, isLoading: ticketsLoading } = useQuery<SupportTicket[]>({ queryKey: ["/api/tickets"] });

  const { data: ticketData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery<{
    ticket: SupportTicket; messages: TicketMessage[]; adminsOnline?: boolean;
  }>({
    queryKey: ["/api/tickets", selectedTicket?.id, "messages"],
    queryFn: async () => {
      const response = await fetch(`/api/tickets/${selectedTicket!.id}/messages`, { credentials: "include", headers: getAuthHeaders() });
      return response.json();
    },
    enabled: !!selectedTicket,
    refetchInterval: selectedTicket ? 8000 : false,
  });

  // SSE for real-time events
  const { isOnline } = useSSE(useCallback((event) => {
    if (event.type === "new_message" && event.data.ticketId === selectedTicket?.id) {
      refetchMessages();
      // Mark as read immediately if we're viewing the ticket
      apiRequest("POST", `/api/tickets/${selectedTicket!.id}/read`).catch(() => {});
    }
    if (event.type === "typing" && event.data.ticketId === selectedTicket?.id && event.data.from === "admin") {
      setAdminTyping(!!event.data.isTyping);
      if (event.data.isTyping) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setAdminTyping(false), 4000);
      }
    }
    if (event.type === "messages_read" && event.data.ticketId === selectedTicket?.id) {
      refetchMessages();
    }
    if (event.type === "online_status") {
      const onlineIds = (event.data.onlineIds as string[]) || [];
      // Check if any user that is not us is online — simplified: show based on admin notification
    }
    if (event.type === "new_message" && !selectedTicket) {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    }
  }, [selectedTicket, refetchMessages]));

  // Track admin online status via SSE onlineIds — admins have role check on server
  // We track if admins are online by checking the adminsOnline field returned by the API
  useEffect(() => {
    if (ticketData?.adminsOnline !== undefined) {
      setAdminOnline(ticketData.adminsOnline);
    }
  }, [ticketData?.adminsOnline]);

  // Mark messages as read when opening chat
  useEffect(() => {
    if (selectedTicket && ticketData?.messages) {
      const hasUnread = ticketData.messages.some(m => m.isAdmin && !m.readByUser);
      if (hasUnread) {
        apiRequest("POST", `/api/tickets/${selectedTicket.id}/read`).catch(() => {});
      }
    }
  }, [selectedTicket, ticketData?.messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [ticketData?.messages, adminTyping]);

  // Open ticket from URL param (from notification click)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketId = params.get("ticket");
    if (ticketId && tickets) {
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket) {
        setSelectedTicket(ticket);
        setShowChat(true);
        window.history.replaceState({}, "", "/dashboard/support");
      }
    }
  }, [tickets]);

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
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer le ticket.", variant: "destructive" }),
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
      stopTyping();
    },
    onError: () => toast({ title: "Erreur", description: "Impossible d'envoyer le message.", variant: "destructive" }),
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
      toast({ title: "Ticket clôturé", description: "La conversation a été clôturée." });
    },
  });

  const sendTypingEvent = useCallback((typing: boolean) => {
    if (!selectedTicket) return;
    apiRequest("POST", `/api/tickets/${selectedTicket.id}/typing`, { isTyping: typing }).catch(() => {});
  }, [selectedTicket]);

  const stopTyping = useCallback(() => {
    if (typingSentRef.current) {
      sendTypingEvent(false);
      typingSentRef.current = false;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [sendTypingEvent]);

  const handleMessageInput = (value: string) => {
    setNewMessage(value);
    if (!selectedTicket) return;
    if (!typingSentRef.current && value.length > 0) {
      typingSentRef.current = true;
      sendTypingEvent(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (typingSentRef.current) {
        typingSentRef.current = false;
        sendTypingEvent(false);
      }
    }, 3000);
    if (value.length === 0) stopTyping();
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

  const handleContactClick = (action: string) => {
    if (action === "chat") {
      setShowChat(true);
      if (!tickets || tickets.length === 0) setShowNewTicket(true);
    } else if (action === "email") {
      window.location.href = `mailto:${supportContact?.email || "support@ashtechpay.com"}`;
    } else if (action === "whatsapp") {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs.", variant: "destructive" });
      return;
    }
    createTicketMutation.mutate({ subject: newTicketSubject, message: newTicketMessage });
  };

  if (showChat) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-8rem)] flex flex-col">
          {/* Chat header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost" size="icon"
                onClick={() => { setShowChat(false); setSelectedTicket(null); stopTyping(); }}
                data-testid="button-back-to-list"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                {/* Admin avatar with online dot */}
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  {adminOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">
                    {selectedTicket ? selectedTicket.subject : "Nouveau message"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {adminOnline
                      ? <span className="text-green-500 font-medium">Support en ligne</span>
                      : "Support hors ligne"}
                  </p>
                </div>
              </div>
              {selectedTicket && (
                <Badge className={statusColors[selectedTicket.status] || statusColors.open}>
                  {statusLabels[selectedTicket.status] || selectedTicket.status}
                </Badge>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {selectedTicket && selectedTicket.status !== "closed" && (
                <Button variant="outline" size="sm" onClick={() => closeTicketMutation.mutate()} disabled={closeTicketMutation.isPending} data-testid="button-close-ticket">
                  {closeTicketMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" />Clôturer</>}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowNewTicket(true)} data-testid="button-new-chat">
                <Plus className="w-4 h-4 mr-1" />Nouveau
              </Button>
            </div>
          </div>

          {/* Ticket list or messages */}
          {!selectedTicket ? (
            <div className="flex-1 p-4 overflow-auto">
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Mes conversations</h3>
                {ticketsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : tickets && tickets.length > 0 ? (
                  <div className="space-y-2">
                    {tickets.map((ticket) => (
                      <Card key={ticket.id} className="cursor-pointer hover-elevate" onClick={() => openTicket(ticket)} data-testid={`ticket-item-${ticket.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{ticket.subject}</p>
                              <p className="text-sm text-muted-foreground">{ticket.createdAt && format(new Date(ticket.createdAt), "dd MMM yyyy à HH:mm", { locale: fr })}</p>
                            </div>
                            <Badge className={statusColors[ticket.status] || statusColors.open}>{statusLabels[ticket.status] || ticket.status}</Badge>
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
                      <Button className="mt-4" onClick={() => setShowNewTicket(true)} data-testid="button-start-new-conversation">Démarrer une conversation</Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : ticketData?.messages && ticketData.messages.length > 0 ? (
                  <div className="space-y-3">
                    {ticketData.messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-start" : "justify-end"}`}>
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3",
                          msg.isAdmin ? "bg-muted rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm"
                        )}>
                          {msg.isAdmin && <p className="text-xs font-medium text-primary mb-1">Support</p>}
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <div className={cn("flex items-center justify-end gap-1 mt-1", msg.isAdmin ? "justify-start" : "justify-end")}>
                            <p className={`text-xs ${msg.isAdmin ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                              {msg.createdAt && format(new Date(msg.createdAt), "HH:mm", { locale: fr })}
                            </p>
                            <MessageTicks msg={msg} adminOnline={adminOnline} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Typing indicator */}
                    {adminTyping && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                          <p className="text-xs text-primary mb-1">Support</p>
                          <div className="flex gap-1 items-center">
                            <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Aucun message</p>
                  </div>
                )}
              </ScrollArea>

              {selectedTicket.status !== "closed" ? (
                <form onSubmit={handleSendMessage} className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => handleMessageInput(e.target.value)}
                      placeholder="Écrivez votre message..."
                      className="flex-1"
                      disabled={sendMessageMutation.isPending}
                      data-testid="input-message"
                    />
                    <Button type="submit" size="icon" disabled={sendMessageMutation.isPending || !newMessage.trim()} data-testid="button-send-message">
                      {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="p-4 border-t bg-muted/50">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Cette conversation est clôturée</span>
                  </div>
                </div>
              )}
            </>
          )}

          <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle conversation</DialogTitle>
                <DialogDescription>Décrivez votre problème et notre équipe vous répondra rapidement.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div className="space-y-2">
                  <Label>Sujet *</Label>
                  <Input value={newTicketSubject} onChange={(e) => setNewTicketSubject(e.target.value)} placeholder="Ex: Problème de dépôt" data-testid="input-ticket-subject" />
                </div>
                <div className="space-y-2">
                  <Label>Message *</Label>
                  <Textarea value={newTicketMessage} onChange={(e) => setNewTicketMessage(e.target.value)} placeholder="Décrivez votre problème en détail..." className="min-h-32" data-testid="input-ticket-message" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowNewTicket(false)}>Annuler</Button>
                  <Button type="submit" disabled={createTicketMutation.isPending}>
                    {createTicketMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi...</> : <><Send className="w-4 h-4 mr-2" />Envoyer</>}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Support</h1>
          <p className="text-muted-foreground">Comment pouvons-nous vous aider?</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {contactOptions.map((option) => (
            <Card key={option.title} className="hover-elevate cursor-pointer overflow-hidden" onClick={() => handleContactClick(option.action)} data-testid={`contact-option-${option.action}`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={cn("w-12 h-12 shrink-0 rounded-xl flex items-center justify-center", option.action === "whatsapp" ? "bg-green-500/10" : "bg-primary/10")}>
                    <option.icon className={cn("w-6 h-6", option.action === "whatsapp" ? "text-green-500" : "text-primary")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{option.title}</p>
                      {option.badge > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold" data-testid="badge-unread-chat">{option.badge}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{option.description}</p>
                    {option.available && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-500 mt-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />Disponible
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
                  <SiWhatsapp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Rejoindre notre chaîne WhatsApp</p>
                  <p className="text-sm text-muted-foreground">Restez informé des dernières actualités et mises à jour d'Ashtech Pay</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white gap-2 shrink-0"
                onClick={() => window.open("https://whatsapp.com/channel/0029VbC5tPPCxoAveJ44Vs2w", "_blank", "noopener,noreferrer")}
                data-testid="button-join-whatsapp-channel"
              >
                <SiWhatsapp className="w-4 h-4" />
                Rejoindre la chaîne
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {tickets && tickets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" />Mes conversations</CardTitle>
              <CardDescription>Consultez vos échanges avec notre équipe support</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tickets.slice(0, 3).map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover-elevate" onClick={() => openTicket(ticket)} data-testid={`recent-ticket-${ticket.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{ticket.subject}</p>
                    <p className="text-sm text-muted-foreground">{ticket.createdAt && format(new Date(ticket.createdAt), "dd MMM yyyy", { locale: fr })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[ticket.status] || statusColors.open}>{statusLabels[ticket.status] || ticket.status}</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {tickets.length > 3 && (
                <Button variant="ghost" className="w-full" onClick={() => setShowChat(true)}>Voir toutes les conversations ({tickets.length})</Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Questions fréquentes</CardTitle>
            <CardDescription>Trouvez rapidement une réponse à vos questions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="space-y-2">
                <p className="font-medium text-foreground">{faq.question}</p>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
                {i < faqs.length - 1 && <div className="border-b" />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
