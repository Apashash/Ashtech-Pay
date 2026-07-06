import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  Bell, ChevronLeft, ChevronRight, CheckCheck, Trash2, ArrowDownCircle,
  ArrowUpCircle, Send, Megaphone, MessageSquare, ChevronDown, ChevronUp, X, Loader2,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language";
import type { User } from "@shared/schema";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  transactionId: string | null;
  isRead: boolean;
  createdAt: string | null;
}

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const preferredCurrency = user?.preferredCurrency || "XAF";

  const { data: notificationData, isLoading } = useQuery<{
    notifications: Notification[];
    unreadCount: number;
  }>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const notifications = notificationData?.notifications ?? [];
  const unreadCount = notificationData?.unreadCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = notifications.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/notifications"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: t.notifications.deletedAll, description: t.notifications.deletedAllDesc });
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function getTitle(type: string, stored: string): string {
    const map: Record<string, string> = {
      deposit_confirmed: t.notifications.typeDepositConfirmedTitle,
      deposit_failed: t.notifications.typeDepositFailedTitle,
      payment_link_received: t.notifications.typePaymentLinkReceivedTitle,
      payment_link_failed: t.notifications.typePaymentLinkFailedTitle,
      withdrawal_confirmed: t.notifications.typeWithdrawalConfirmedTitle,
      withdrawal_failed: t.notifications.typeWithdrawalFailedTitle,
    };
    return map[type] || stored;
  }

  function getMessage(type: string, stored: string, currency: string): string {
    let params: { amount?: string; currency?: string } = {};
    try { params = JSON.parse(stored); } catch { /* plain text */ }
    const amt = params.amount;
    const cur = (params.currency || "XAF").replace(/\bXAF\b/g, currency);
    const tpl = (tmpl: string) => tmpl.replace("{amount}", amt || "").replace("{currency}", cur);
    switch (type) {
      case "deposit_confirmed":    return amt ? tpl(t.notifications.typeDepositConfirmedMsg)    : stored.replace(/\bXAF\b/g, currency);
      case "deposit_failed":       return t.notifications.typeDepositFailedMsg;
      case "payment_link_received":return amt ? tpl(t.notifications.typePaymentLinkReceivedMsg): stored.replace(/\bXAF\b/g, currency);
      case "payment_link_failed":  return t.notifications.typePaymentLinkFailedMsg;
      case "withdrawal_confirmed": return amt ? tpl(t.notifications.typeWithdrawalConfirmedMsg): stored.replace(/\bXAF\b/g, currency);
      case "withdrawal_failed":    return amt ? tpl(t.notifications.typeWithdrawalFailedMsg)   : stored.replace(/\bXAF\b/g, currency);
      default:                     return stored.replace(/\bXAF\b/g, currency);
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case "deposit_confirmed":    return <ArrowDownCircle className="w-5 h-5 text-green-500" />;
      case "withdrawal_confirmed": return <ArrowUpCircle   className="w-5 h-5 text-orange-500" />;
      case "transfer_received":    return <Send            className="w-5 h-5 text-blue-500" />;
      case "global_message":       return <Megaphone       className="w-5 h-5 text-purple-500" />;
      case "admin_message":        return <MessageSquare   className="w-5 h-5 text-purple-500" />;
      default:                     return <Bell            className="w-5 h-5 text-muted-foreground" />;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto pb-10">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between h-14 px-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setLocation("/dashboard")}
                className="p-2 rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-5 h-5 text-primary shrink-0" />
                <h1 className="font-semibold text-foreground truncate">
                  {t.notifications.title}
                </h1>
                {unreadCount > 0 && (
                  <span className="shrink-0 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="h-9 w-9 text-primary hover:bg-primary/10"
                  title={t.notifications.markAllRead}
                >
                  {markAllReadMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCheck className="w-4 h-4" />}
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteAllMutation.mutate()}
                  disabled={deleteAllMutation.isPending}
                  className="h-9 w-9 text-destructive hover:bg-destructive/10"
                  title="Tout supprimer"
                >
                  {deleteAllMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <Bell className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-sm">{t.notifications.noNotifications}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paged.map((notif) => {
              const isExpanded = expandedId === notif.id;
              const isGlobal = notif.type === "global_message";
              return (
                <div
                  key={notif.id}
                  className={`px-4 py-4 transition-colors cursor-pointer ${
                    isGlobal
                      ? !notif.isRead ? "bg-purple-500/8 hover:bg-purple-500/12" : "hover:bg-purple-500/5"
                      : !notif.isRead ? "bg-primary/5 hover:bg-muted/40"          : "hover:bg-muted/30"
                  }`}
                  onClick={() => {
                    if (isGlobal) { setLocation("/dashboard/global-message"); return; }
                    setExpandedId(isExpanded ? null : notif.id);
                    if (!notif.isRead) markAsReadMutation.mutate(notif.id);
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread dot */}
                    <div className="relative mt-0.5 shrink-0">
                      {getIcon(notif.type)}
                      {!notif.isRead && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border border-background" />
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <p className={`text-sm font-medium leading-snug ${!notif.isRead ? "text-foreground" : "text-foreground/80"}`}>
                            {getTitle(notif.type, notif.title)}
                          </p>
                          {isGlobal && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                              {t.notifications.official}
                            </span>
                          )}
                        </div>
                        {!isGlobal && (
                          <span className="text-muted-foreground shrink-0 mt-0.5">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </span>
                        )}
                      </div>

                      <p className={`text-sm text-muted-foreground mt-1 leading-relaxed ${isExpanded ? "whitespace-pre-wrap break-words" : "line-clamp-2"}`}>
                        {getMessage(notif.type, notif.message || "", preferredCurrency)}
                      </p>

                      {notif.createdAt && (
                        <p className="text-xs text-muted-foreground/70 mt-1.5">
                          {format(new Date(notif.createdAt), language === "fr" ? "dd MMM 'à' HH:mm" : "dd MMM 'at' HH:mm", { locale: language === "fr" ? fr : enUS })}
                        </p>
                      )}

                      {isExpanded && notif.transactionId && (
                        <button
                          className="text-xs text-primary mt-2 underline underline-offset-2"
                          onClick={(e) => { e.stopPropagation(); setLocation("/dashboard/transactions"); }}
                        >
                          {t.notifications.viewTransaction}
                        </button>
                      )}
                      {isExpanded && notif.type === "admin_message" && (
                        <button
                          className="text-xs text-primary mt-2 underline underline-offset-2"
                          onClick={(e) => { e.stopPropagation(); setLocation("/dashboard/support"); }}
                        >
                          {t.notifications.viewMessage}
                        </button>
                      )}
                      {isExpanded && isGlobal && (
                        <button
                          className="text-xs text-purple-500 mt-2 underline underline-offset-2 font-medium"
                          onClick={(e) => { e.stopPropagation(); setLocation("/dashboard/global-message"); }}
                        >
                          {t.notifications.viewOfficialMessage}
                        </button>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      className="shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(notif.id); }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-border mt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={safePage <= 1}
              onClick={() => { setPage(safePage - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </Button>

            <span className="text-sm text-muted-foreground">
              {safePage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={safePage >= totalPages}
              onClick={() => { setPage(safePage + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
