import { DashboardLayout } from "@/components/dashboard-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Megaphone, CheckCircle2, ArrowLeft, Shield, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language";

interface GlobalMessage {
  id: string;
  title: string;
  message: string;
  createdAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string | null;
}

export default function GlobalMessagePage() {
  const [location, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const gm = t.globalMsg;

  const { data: activeMessages = [], isLoading } = useQuery<GlobalMessage[]>({
    queryKey: ["/api/global-messages/active"],
  });

  const { data: notificationData } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
  });
  const notificationId = new URLSearchParams(
    location.includes("?") ? location.slice(location.indexOf("?")) : window.location.search,
  ).get("notificationId");
  const kycNotification = notificationData?.notifications.find(
    notification => notification.id === notificationId && notification.type === "kyc_update_required",
  );

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  useEffect(() => {
    if (!notificationData) return;
    const unreadGlobal = notificationData.notifications.find(
      n => n.type === "global_message" && !n.isRead,
    );
    if (unreadGlobal) {
      markAsReadMutation.mutate(unreadGlobal.id);
    }
  }, [notificationData?.notifications?.length]);

  useEffect(() => {
    if (kycNotification && !kycNotification.isRead) {
      markAsReadMutation.mutate(kycNotification.id);
    }
  }, [kycNotification?.id, kycNotification?.isRead]);

  const displayed = activeMessages
    .slice()
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0] ?? null;
  const displayedItem = kycNotification || displayed;
  const isKycUpdate = Boolean(kycNotification);

  const dateLocale = language === "fr" ? fr : enUS;
  const datePattern = language === "fr" ? "dd MMMM yyyy 'à' HH:mm" : "MMMM dd, yyyy 'at' HH:mm";

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/dashboard")}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {gm.back}
        </Button>

        {!isLoading && displayedItem ? (
          <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-background to-blue-500/5 shadow-xl">

            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-blue-500" />

            <div className="p-8 space-y-6">

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shadow-inner">
                  {isKycUpdate ? (
                    <Shield className="w-7 h-7 text-amber-500" />
                  ) : (
                    <Megaphone className="w-7 h-7 text-purple-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Shield className={`w-3.5 h-3.5 ${isKycUpdate ? "text-amber-500" : "text-purple-500"}`} />
                    <span className="text-xs font-semibold uppercase tracking-widest text-purple-500">
                      {isKycUpdate ? "ACTION REQUISE" : gm.officialBadge}
                    </span>
                  </div>
                  <h1 className="text-xl font-semibold text-foreground leading-tight">
                    {displayedItem.title}
                  </h1>
                </div>
              </div>

              <div className="rounded-xl bg-background/60 border border-border/60 p-5">
                <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
                  {displayedItem.message}
                </p>
              </div>

              {displayedItem.createdAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className={`w-1.5 h-1.5 rounded-full ${isKycUpdate ? "bg-amber-500" : "bg-purple-500"}`} />
                  {gm.published} {format(new Date(displayedItem.createdAt), datePattern, { locale: dateLocale })}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                {isKycUpdate ? (
                  <>
                    <Button
                      onClick={() => setLocation("/dashboard/kyc?update=true&confirmed=true")}
                      className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                      data-testid="button-kyc-update"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Mettre à jour mon KYC
                    </Button>
                    <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                      Plus tard
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setLocation("/dashboard")}
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                    data-testid="button-global-message-ack"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {gm.understood}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  {isKycUpdate ? "AshTech Pay — Vérification KYC" : gm.team}
                </p>
              </div>
            </div>
          </div>
        ) : !isLoading ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Megaphone className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">{gm.noMessage}</p>
            <Button variant="outline" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              {gm.backToDashboard}
            </Button>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
