import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BottomSheet, BottomSheetContent, BottomSheetDescription, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
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
import type { SSEEvent } from "@/hooks/use-sse";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language";
import directChatIcon from "@assets/a60625748a61e88e4ae17d53bc286910_1789046907975.jpg";
import whatsappIcon from "@assets/7415d00f6b719e40a4b1f9a75fc7eea5_1789046907994.jpg";
import gmailIcon from "@assets/26c7089c48f9bb763e9cca3db502bd57_1789046908005.jpg";

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
  const { t } = useLanguage();
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

  const faqs = [
    { question: t.support.faq1Q, answer: t.support.faq1A },
    { question: t.support.faq2Q, answer: t.support.faq2A },
    { question: t.support.faq3Q, answer: t.support.faq3A },
    { question: t.support.faq4Q, answer: t.support.faq4A },
  ];

  const statusColors: Record<string, string> = {
    open: "bg-blue-500/10 text-blue-500",
    in_progress: "bg-yellow-500/10 text-yellow-500",
    resolved: "bg-green-500/10 text-green-500",
    closed: "bg-gray-500/10 text-gray-500",
  };

  const statusLabels: Record<string, string> = {
    open: t.support.statusOpen,
    in_progress: t.support.statusInProgress,
    resolved: t.support.statusResolved,
    closed: t.support.statusClosed,
  };

  const { data: supportContact } = useQuery<SupportContact>({ queryKey: ["/api/public/support-contact"] });
  const { data: ticketStats } = useQuery<{ unreadCount: number; totalCount: number }>({
    queryKey: ["/api/tickets/stats"],
    refetchInterval: 10000,
  });

  const whatsappPhone = (supportContact?.phone || "+237600000000").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=Bonjour%20Ashtech%20Pay%2C%20j%27ai%20besoin%20d%27aide.`;

  const contactOptions = [
    { icon: MessageSquare, imageSrc: directChatIcon, title: t.support.chatTitle, description: t.support.chatDesc, available: true, action: "chat", badge: ticketStats?.unreadCount || 0 },
    { icon: Mail, imageSrc: gmailIcon, title: "Email", description: supportContact?.email || "support@ashtechpay.com", available: true, action: "email", badge: 0 },
    { icon: SiWhatsapp, imageSrc: whatsappIcon, title: "WhatsApp", description: supportContact?.phone || "+237 6XX XXX XXX", available: true, action: "whatsapp", badge: 0 },
  ];

  const [ticketPage, setTicketPage] = useState(0);
  const TICKETS_PER_PAGE = 15;

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

  const { isOnline } = useSSE(useCallback((event: SSEEvent) => {
    if (event.type === "new_message") {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/stats"] });
    }
    if (event.type === "new_message" && event.data.ticketId === selectedTicket?.id) {
      refetchMessages();
      apiRequest("POST", `/api/tickets/${selectedTicket!.id}/read`)
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/tickets/stats"] }))
        .catch(() => {});
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
    if (event.type === "new_message" && !selectedTicket) {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    }
  }, [selectedTicket, refetchMessages]));

  useEffect(() => {
    if (ticketData?.adminsOnline !== undefined) {
      setAdminOnline(ticketData.adminsOnline);
    }
  }, [ticketData?.adminsOnline]);

  useEffect(() => {
    if (selectedTicket && ticketData?.messages) {
      const hasUnread = ticketData.messages.some(m => m.isAdmin && !m.readByUser);
      if (hasUnread) {
        apiRequest("POST", `/api/tickets/${selectedTicket.id}/read`)
          .then(() => queryClient.invalidateQueries({ queryKey: ["/api/tickets/stats"] }))
          .catch(() => {});
      }
    }
  }, [selectedTicket, ticketData?.messages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [ticketData?.messages, adminTyping]);

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
    onError: () => toast({ title: t.support.statusClosed, description: t.support.errorCreate, variant: "destructive" }),
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
    onError: () => toast({ title: t.support.statusClosed, description: t.support.errorSend, variant: "destructive" }),
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
      toast({ title: t.support.ticketClosed, description: t.support.ticketClosedDesc });
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
      toast({ title: t.support.requiredFields, description: t.support.requiredFieldsDesc, variant: "destructive" });
      return;
    }
    createTicketMutation.mutate({ subject: newTicketSubject, message: newTicketMessage });
  };

  if (showChat) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-8rem)] flex flex-col">
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
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center overflow-hidden border border-primary/20">
                    <img src={directChatIcon} alt="" aria-hidden="true" className="w-9 h-9 object-cover" />
                  </div>
                  {adminOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">
                    {selectedTicket ? selectedTicket.subject : t.support.newConversationTitle}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {adminOnline
                      ? <span className="text-green-500 font-medium">{t.support.supportOnline}</span>
                      : t.support.supportOffline}
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
                  {closeTicketMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" />{t.support.close}</>}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowNewTicket(true)} data-testid="button-new-chat">
                <Plus className="w-4 h-4 mr-1" />{t.support.newChat}
              </Button>
            </div>
          </div>

          {!selectedTicket ? (
            <div className="flex-1 p-4 overflow-auto">
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">{t.support.myConversations}</h3>
                {ticketsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : tickets && tickets.length > 0 ? (
                  <div className="space-y-2">
                    {tickets.slice(ticketPage * TICKETS_PER_PAGE, (ticketPage + 1) * TICKETS_PER_PAGE).map((ticket) => (
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
                    {tickets.length > TICKETS_PER_PAGE && (
                      <div className="flex items-center justify-between pt-2">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setTicketPage(p => Math.max(0, p - 1))}
                          disabled={ticketPage === 0}
                          data-testid="button-tickets-prev"
                        >
                          ← Précédent
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {ticketPage + 1} / {Math.ceil(tickets.length / TICKETS_PER_PAGE)}
                        </span>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setTicketPage(p => Math.min(Math.ceil(tickets.length / TICKETS_PER_PAGE) - 1, p + 1))}
                          disabled={(ticketPage + 1) * TICKETS_PER_PAGE >= tickets.length}
                          data-testid="button-tickets-next"
                        >
                          Suivant →
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/15">
                        <img src={directChatIcon} alt="" aria-hidden="true" className="w-12 h-12 object-cover" />
                      </div>
                      <p className="text-muted-foreground">{t.support.noConversations}</p>
                      <Button className="mt-4" onClick={() => setShowNewTicket(true)} data-testid="button-start-new-conversation">{t.support.startConversation}</Button>
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
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/15">
                      <img src={directChatIcon} alt="" aria-hidden="true" className="w-12 h-12 object-cover" />
                    </div>
                    <p className="text-muted-foreground">{t.support.noMessages}</p>
                  </div>
                )}
              </ScrollArea>

              {selectedTicket.status !== "closed" ? (
                <form onSubmit={handleSendMessage} className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => handleMessageInput(e.target.value)}
                      placeholder={t.support.messagePlaceholder}
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
                    <span className="text-sm">{t.support.closedConversation}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <BottomSheet open={showNewTicket} onOpenChange={setShowNewTicket}>
            <BottomSheetContent className="rounded-t-[28px] border-0 bg-background px-0 shadow-2xl">
              <BottomSheetHeader className="px-5 pb-5 pt-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 shrink-0 rounded-2xl bg-primary/15 flex items-center justify-center overflow-hidden border border-primary/20">
                    <img src={directChatIcon} alt="" aria-hidden="true" className="w-10 h-10 object-cover" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <BottomSheetTitle className="text-xl font-semibold tracking-tight text-foreground">
                      {t.support.newConversationTitle}
                    </BottomSheetTitle>
                    <BottomSheetDescription className="mt-1 text-sm leading-5 text-muted-foreground">
                      {t.support.newConversationDesc}
                    </BottomSheetDescription>
                  </div>
                </div>
              </BottomSheetHeader>
              <form onSubmit={handleCreateTicket} className="space-y-5 px-5 pb-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">{t.support.subjectLabel}</Label>
                  <Input
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                    placeholder={t.support.subjectPlaceholder}
                    className="h-12 rounded-xl border-input bg-background px-4 text-[15px] placeholder:text-muted-foreground/70 focus-visible:ring-primary"
                    data-testid="input-ticket-subject"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">{t.support.messageLabel}</Label>
                  <Textarea
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    placeholder={t.support.messagePlaceholder2}
                    className="min-h-32 resize-none rounded-xl border-input bg-background px-4 py-3 text-[15px] leading-6 placeholder:text-muted-foreground/70 focus-visible:ring-primary"
                    data-testid="input-ticket-message"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-border px-5 font-semibold"
                    onClick={() => setShowNewTicket(false)}
                  >
                    {t.support.cancel}
                  </Button>
                  <Button
                    type="submit"
                    className="h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                    disabled={createTicketMutation.isPending}
                  >
                    {createTicketMutation.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.support.sending}</>
                      : <><Send className="w-4 h-4 mr-2" />{t.support.send}</>}
                  </Button>
                </div>
              </form>
            </BottomSheetContent>
          </BottomSheet>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.support.title}</h1>
          <p className="text-muted-foreground">{t.support.subtitle}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.support.contactSection}</p>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {contactOptions.map((option) => (
              <button
                key={option.title}
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
                onClick={() => handleContactClick(option.action)}
                data-testid={`contact-option-${option.action}`}
              >
                <div className={cn("w-9 h-9 shrink-0 rounded-xl flex items-center justify-center overflow-hidden", option.action === "whatsapp" ? "bg-green-500/10" : "bg-primary/10")}>
                  <img src={option.imageSrc} alt="" aria-hidden="true" className="w-8 h-8 object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{option.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                </div>
                {option.badge > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold" data-testid="badge-unread-chat">{option.badge}</span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src={whatsappIcon} alt="" aria-hidden="true" className="w-9 h-9 object-cover" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{t.support.whatsappChannelTitle}</p>
                  <p className="text-sm text-muted-foreground">{t.support.whatsappChannelDesc}</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white gap-2 shrink-0"
                onClick={() => window.open("https://whatsapp.com/channel/0029VbC5tPPCxoAveJ44Vs2w", "_blank", "noopener,noreferrer")}
                data-testid="button-join-whatsapp-channel"
              >
                <img src={whatsappIcon} alt="" aria-hidden="true" className="w-4 h-4 object-cover" />
                {t.support.joinChannel}
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {tickets && tickets.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.support.myConversationsSection}</p>
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {tickets.slice(0, 3).map((ticket) => (
                <div key={ticket.id} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => openTicket(ticket)} data-testid={`recent-ticket-${ticket.id}`}>
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <img src={directChatIcon} alt="" aria-hidden="true" className="w-8 h-8 object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">{ticket.createdAt && format(new Date(ticket.createdAt), "dd MMM yyyy", { locale: fr })}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={statusColors[ticket.status] || statusColors.open}>{statusLabels[ticket.status] || ticket.status}</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {tickets.length > 3 && (
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:bg-muted/40 transition-colors" onClick={() => setShowChat(true)}>
                  {t.support.seeAll} ({tickets.length})
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.support.faqSection}</p>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {faqs.map((faq, i) => (
              <div key={i} className="px-4 py-3.5">
                <p className="text-sm font-semibold text-foreground">{faq.question}</p>
                <p className="text-xs text-muted-foreground mt-1">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
