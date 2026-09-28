import { DashboardLayout } from "@/components/dashboard-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Megaphone,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
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
  const requestedAnnouncementId = new URLSearchParams(
    location.includes("?") ? location.slice(location.indexOf("?")) : window.location.search,
  ).get("announcementId") ?? (
    notificationId?.startsWith("global-") ? notificationId.slice("global-".length) : null
  );
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
    if (kycNotification && !kycNotification.isRead) {
      markAsReadMutation.mutate(kycNotification.id);
    }
  }, [kycNotification?.id, kycNotification?.isRead]);

  const sortedMessages = activeMessages
    .slice()
    .sort((a, b) => {
      const dateA = a.createdAt ? Date.parse(a.createdAt) : 0;
      const dateB = b.createdAt ? Date.parse(b.createdAt) : 0;
      return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
    });
  const selectedIndex = Math.max(
    0,
    sortedMessages.findIndex(message => message.id === requestedAnnouncementId),
  );
  const selectedAnnouncement = sortedMessages[selectedIndex] ?? null;
  const displayedItem = kycNotification || selectedAnnouncement;
  const isKycUpdate = Boolean(kycNotification);

  const dateLocale = language === "fr" ? fr : enUS;
  const datePattern = language === "fr" ? "dd MMMM yyyy 'à' HH:mm" : "MMMM dd, yyyy 'at' HH:mm";
  const publishedDate = displayedItem?.createdAt
    ? new Date(displayedItem.createdAt)
    : null;
  const formattedPublishedDate = publishedDate && Number.isFinite(publishedDate.getTime())
    ? format(publishedDate, datePattern, { locale: dateLocale })
    : null;

  const openAnnouncement = (index: number) => {
    const announcement = sortedMessages[index];
    if (announcement) {
      setLocation(`/dashboard/global-message?announcementId=${encodeURIComponent(announcement.id)}`);
    }
  };

  const acknowledgeAnnouncement = async () => {
    if (!selectedAnnouncement) return;
    try {
      await markAsReadMutation.mutateAsync(`global-${selectedAnnouncement.id}`);
      setLocation("/dashboard");
    } catch {
      toast({
        title: gm.acknowledgementFailed,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:space-y-8 sm:py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/dashboard")}
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {gm.back}
        </Button>

        <header className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
              isKycUpdate
                ? "border-amber-500/25 bg-amber-500/10 text-amber-600"
                : "border-purple-500/25 bg-purple-500/10 text-purple-600"
            }`}>
              {isKycUpdate ? <Shield className="h-6 w-6" /> : <Megaphone className="h-6 w-6" />}
            </div>
            <div>
              <p className={`mb-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                isKycUpdate ? "text-amber-600" : "text-purple-600"
              }`}>
                {isKycUpdate ? gm.actionRequired : gm.officialBadge}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {isKycUpdate ? gm.kycPageTitle : gm.pageTitle}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {isKycUpdate ? gm.kycPageSubtitle : gm.pageSubtitle}
              </p>
            </div>
          </div>
          {!isKycUpdate && sortedMessages.length > 0 && (
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-2 text-sm text-muted-foreground">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-500/10 px-1.5 text-xs font-semibold text-purple-600">
                {sortedMessages.length}
              </span>
              {sortedMessages.length === 1 ? gm.announcement : gm.announcements}
            </div>
          )}
        </header>

        {isLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card/50 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            {gm.loading}
          </div>
        ) : displayedItem ? (
          <div className={`grid items-start gap-5 lg:gap-6 ${
            !isKycUpdate && sortedMessages.length > 1 ? "lg:grid-cols-[minmax(240px,0.78fr)_minmax(0,1.8fr)]" : ""
          }`}>
            {!isKycUpdate && sortedMessages.length > 1 && (
              <aside className="order-2 lg:order-1">
                <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-foreground">{gm.allAnnouncements}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{gm.selectAnnouncement}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {sortedMessages.length}
                    </span>
                  </div>
                  <nav aria-label={gm.allAnnouncements} className="space-y-2 lg:max-h-[34rem] lg:overflow-y-auto lg:pr-1">
                    {sortedMessages.map((message, index) => {
                      const isSelected = message.id === selectedAnnouncement?.id;
                      const itemDate = message.createdAt ? new Date(message.createdAt) : null;
                      const itemDateLabel = itemDate && Number.isFinite(itemDate.getTime())
                        ? format(itemDate, language === "fr" ? "dd MMM yyyy" : "MMM dd, yyyy", { locale: dateLocale })
                        : null;

                      return (
                        <button
                          key={message.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => openAnnouncement(index)}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${
                            isSelected
                              ? "border-purple-500/40 bg-purple-500/[0.07] shadow-sm"
                              : "border-transparent bg-muted/40 hover:border-border hover:bg-muted/70"
                          }`}
                        >
                          <span className="block truncate text-sm font-medium text-foreground">
                            {message.title}
                          </span>
                          <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{itemDateLabel ?? gm.officialBadge}</span>
                            {isSelected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />}
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </section>
              </aside>
            )}

            <main className="order-1 min-w-0 lg:order-2">
              {!isKycUpdate && sortedMessages.length > 1 && (
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {gm.announcementPosition
                      .replace("{current}", String(selectedIndex + 1))
                      .replace("{total}", String(sortedMessages.length))}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openAnnouncement(selectedIndex - 1)}
                      disabled={selectedIndex <= 0}
                      aria-label={gm.previousAnnouncement}
                      className="h-8 px-2.5"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      <span className="hidden sm:inline">{gm.previousAnnouncement}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openAnnouncement(selectedIndex + 1)}
                      disabled={selectedIndex >= sortedMessages.length - 1}
                      aria-label={gm.nextAnnouncement}
                      className="h-8 px-2.5"
                    >
                      <span className="hidden sm:inline">{gm.nextAnnouncement}</span>
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <article className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${
                isKycUpdate ? "border-amber-500/25" : "border-purple-500/20"
              }`}>
                <div className={`h-1.5 ${
                  isKycUpdate
                    ? "bg-gradient-to-r from-amber-500 to-orange-400"
                    : "bg-gradient-to-r from-purple-600 via-violet-500 to-blue-500"
                }`} />
                <div className="space-y-6 p-5 sm:p-7 lg:p-8">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      isKycUpdate ? "bg-amber-500/10 text-amber-600" : "bg-purple-500/10 text-purple-600"
                    }`}>
                      {isKycUpdate ? <Shield className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                        isKycUpdate
                          ? "bg-amber-500/10 text-amber-700"
                          : "bg-purple-500/10 text-purple-700"
                      }`}>
                        {isKycUpdate ? gm.actionRequired : gm.officialBadge}
                      </span>
                      <h2 className="mt-3 break-words text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">
                        {displayedItem.title}
                      </h2>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/25 p-4 sm:p-5">
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground sm:text-base">
                      {displayedItem.message}
                    </p>
                  </div>

                  {formattedPublishedDate && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays className={`h-4 w-4 ${isKycUpdate ? "text-amber-600" : "text-purple-600"}`} />
                      <span>{gm.published} {formattedPublishedDate}</span>
                    </div>
                  )}

                  <footer className="flex flex-col gap-4 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        isKycUpdate ? "bg-amber-500/10 text-amber-600" : "bg-purple-500/10 text-purple-600"
                      }`}>
                        {isKycUpdate ? <Shield className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {isKycUpdate ? gm.kycSignature : gm.team}
                        </p>
                        {!isKycUpdate && (
                          <p className="text-xs text-muted-foreground">{gm.officialBadge}</p>
                        )}
                      </div>
                    </div>

                    {isKycUpdate ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          onClick={() => setLocation("/dashboard/kyc?update=true&confirmed=true")}
                          className="gap-2 bg-amber-500 text-white hover:bg-amber-600"
                          data-testid="button-kyc-update"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Mettre à jour mon KYC
                        </Button>
                        <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                          Plus tard
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={acknowledgeAnnouncement}
                        disabled={markAsReadMutation.isPending}
                        className="gap-2 bg-purple-600 text-white hover:bg-purple-700"
                        data-testid="button-global-message-ack"
                      >
                        {markAsReadMutation.isPending
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <CheckCircle2 className="h-4 w-4" />}
                        {gm.understood}
                      </Button>
                    )}
                  </footer>
                </div>
              </article>
            </main>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-14 text-center sm:py-20">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Megaphone className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{gm.noMessage}</p>
            <Button variant="outline" onClick={() => setLocation("/dashboard")} className="mt-5">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {gm.backToDashboard}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
