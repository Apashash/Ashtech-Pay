import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Pencil, Trash2, MessageSquare, Calendar } from "lucide-react";
import {
  GLOBAL_MESSAGE_PUSH_AUDIENCES,
  type GlobalMessagePushAudience,
} from "@shared/global-message-audiences";

interface GlobalMessage {
  id: string;
  adminId: string;
  title: string;
  message: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string | null;
}

interface PushAudienceStats {
  targetAccounts: number;
  subscribedAccounts: number;
  subscribedDevices: number;
  pushConfigured: boolean;
  deliveryStarted?: boolean;
}

export default function GlobalMessagesPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<GlobalMessage | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    expiresAt: "",
    pushAudience: "all_active" as GlobalMessagePushAudience,
  });

  const { data: messages = [], isLoading } = useQuery<GlobalMessage[]>({
    queryKey: ["/api/admin/global-messages"],
  });

  const pushAudienceUrl = `/api/admin/global-messages/push-audience?audience=${encodeURIComponent(formData.pushAudience)}`;
  const {
    data: pushAudienceStats,
    isLoading: isPushAudienceLoading,
    isError: isPushAudienceError,
  } = useQuery<PushAudienceStats>({
    queryKey: [pushAudienceUrl],
    enabled: isCreateOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      message: string;
      expiresAt?: string;
      pushAudience: GlobalMessagePushAudience;
    }) => {
      const response = await apiRequest("POST", "/api/admin/global-messages", data);
      return await response.json() as { pushAudienceStats?: PushAudienceStats };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-messages"] });
      setIsCreateOpen(false);
      setFormData({ title: "", message: "", expiresAt: "", pushAudience: "all_active" });

      const selected = GLOBAL_MESSAGE_PUSH_AUDIENCES.find(
        (audience) => audience.value === formData.pushAudience,
      );
      const stats = result.pushAudienceStats;
      let description = "Le message reste visible dans le centre de notifications de tous les utilisateurs.";
      if (stats && !stats.pushConfigured) {
        description += " Le push n'a pas été lancé : Web Push n'est pas configuré.";
      } else if (stats && !stats.deliveryStarted) {
        description += " Aucun utilisateur de ce groupe n'a d'abonnement push actif.";
      } else if (stats) {
        description += ` Push lancé pour ${stats.subscribedAccounts.toLocaleString("fr-FR")} compte(s) abonné(s) — ${selected?.label ?? "groupe choisi"}.`;
      }
      toast({ title: "Message global créé", description });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; message?: string; isActive?: boolean; expiresAt?: string | null }) => {
      return await apiRequest("PATCH", `/api/admin/global-messages/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-messages"] });
      setEditingMessage(null);
      toast({ title: "Message mis à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/global-messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-messages"] });
      toast({ title: "Message supprimé" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMessage) {
      updateMutation.mutate({
        id: editingMessage.id,
        title: formData.title,
        message: formData.message,
        expiresAt: formData.expiresAt || null,
      });
    } else {
      createMutation.mutate({
        title: formData.title,
        message: formData.message,
        expiresAt: formData.expiresAt || undefined,
        pushAudience: formData.pushAudience,
      });
    }
  };

  const openEditDialog = (msg: GlobalMessage) => {
    setEditingMessage(msg);
    setFormData({
      title: msg.title,
      message: msg.message,
      expiresAt: msg.expiresAt ? new Date(msg.expiresAt).toISOString().slice(0, 16) : "",
      pushAudience: "all_active",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Messages Globaux</h1>
            <p className="text-muted-foreground">Le message reste global; choisissez le groupe qui recevra le push.</p>
          </div>
          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (open) {
                setFormData({ title: "", message: "", expiresAt: "", pushAudience: "all_active" });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button data-testid="button-create-message">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau message
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Créer un message global</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Titre du message"
                    required
                    data-testid="input-message-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Contenu du message..."
                    rows={4}
                    required
                    data-testid="input-message-content"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Date d'expiration (optionnel)</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    data-testid="input-message-expires"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="push-audience">Groupe qui recevra la notification push</Label>
                  <select
                    id="push-audience"
                    value={formData.pushAudience}
                    onChange={(event) => setFormData({
                      ...formData,
                      pushAudience: event.target.value as GlobalMessagePushAudience,
                    })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="select-global-message-push-audience"
                  >
                    {GLOBAL_MESSAGE_PUSH_AUDIENCES.map((audience) => (
                      <option key={audience.value} value={audience.value}>
                        {audience.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {GLOBAL_MESSAGE_PUSH_AUDIENCES.find(
                      (audience) => audience.value === formData.pushAudience,
                    )?.description}
                    {" "}Le message affiché dans le centre reste accessible à tous.
                  </p>
                </div>

                <div
                  className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm"
                  aria-live="polite"
                  data-testid="push-audience-preview"
                >
                  <p className="font-medium">Portée estimée du push</p>
                  {isPushAudienceLoading ? (
                    <p className="text-muted-foreground">Calcul des destinataires…</p>
                  ) : isPushAudienceError ? (
                    <p className="text-destructive">Impossible de calculer la portée pour le moment.</p>
                  ) : pushAudienceStats ? (
                    <>
                      <p>{pushAudienceStats.targetAccounts.toLocaleString("fr-FR")} compte(s) dans le groupe</p>
                      <p>{pushAudienceStats.subscribedAccounts.toLocaleString("fr-FR")} compte(s) avec un abonnement push</p>
                      <p>{pushAudienceStats.subscribedDevices.toLocaleString("fr-FR")} appareil(s) inscrit(s)</p>
                      {!pushAudienceStats.pushConfigured && (
                        <p className="pt-1 text-destructive">Web Push n'est pas configuré : le message restera visible dans le centre, mais aucun push ne sera envoyé.</p>
                      )}
                    </>
                  ) : null}
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-message">
                  {createMutation.isPending ? "Création..." : "Créer le message et lancer le push ciblé"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Historique</p>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Historique des messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun message global envoyé
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow key={msg.id} data-testid={`row-message-${msg.id}`}>
                      <TableCell className="font-medium">{msg.title}</TableCell>
                      <TableCell className="max-w-xs truncate">{msg.message}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={msg.isActive}
                            onCheckedChange={(checked) => updateMutation.mutate({ id: msg.id, isActive: checked })}
                            data-testid={`switch-active-${msg.id}`}
                          />
                          <Badge variant={msg.isActive ? "default" : "secondary"}>
                            {msg.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {msg.expiresAt ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(msg.expiresAt), "dd MMM yyyy HH:mm", { locale: fr })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Permanent</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {msg.createdAt && format(new Date(msg.createdAt), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog open={editingMessage?.id === msg.id} onOpenChange={(open) => !open && setEditingMessage(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(msg)}
                                data-testid={`button-edit-${msg.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Modifier le message</DialogTitle>
                              </DialogHeader>
                              <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-title">Titre</Label>
                                  <Input
                                    id="edit-title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-message">Message</Label>
                                  <Textarea
                                    id="edit-message"
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    rows={4}
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-expiresAt">Date d'expiration</Label>
                                  <Input
                                    id="edit-expiresAt"
                                    type="datetime-local"
                                    value={formData.expiresAt}
                                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                                  />
                                </div>
                                <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                                  {updateMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
                                </Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(msg.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${msg.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
