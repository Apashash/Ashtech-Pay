import { DashboardLayout } from "@/components/dashboard-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Megaphone, CheckCircle2, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  transactionId: string | null;
  isRead: boolean;
  createdAt: string | null;
}

export default function GlobalMessagePage() {
  const [, setLocation] = useLocation();

  const { data: notificationData } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const globalNotif = notificationData?.notifications?.find(n => n.type === "global_message");

  useEffect(() => {
    if (globalNotif && !globalNotif.isRead) {
      markAsReadMutation.mutate(globalNotif.id);
    }
  }, [globalNotif?.id]);

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
          Retour
        </Button>

        {globalNotif ? (
          <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-background to-blue-500/5 shadow-xl">

            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-blue-500" />

            <div className="p-8 space-y-6">

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shadow-inner">
                  <Megaphone className="w-7 h-7 text-purple-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Shield className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-purple-500">
                      Message officiel
                    </span>
                  </div>
                  <h1 className="text-xl font-bold text-foreground leading-tight">
                    {globalNotif.title}
                  </h1>
                </div>
              </div>

              <div className="rounded-xl bg-background/60 border border-border/60 p-5">
                <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
                  {globalNotif.message}
                </p>
              </div>

              {globalNotif.createdAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Publié le {format(new Date(globalNotif.createdAt), "dd MMMM yyyy à HH:mm", { locale: fr })}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => setLocation("/dashboard")}
                  className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="button-global-message-ack"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  J'ai compris
                </Button>
                <p className="text-xs text-muted-foreground">
                  — L'équipe AshTech Pay
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Megaphone className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">Aucun message de l'administration pour le moment.</p>
            <Button variant="outline" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour au tableau de bord
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
