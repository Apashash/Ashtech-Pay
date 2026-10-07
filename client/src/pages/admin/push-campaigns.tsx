import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ADMIN_PUSH_BODY_MAX_LENGTH,
  ADMIN_PUSH_CAMPAIGN_SEGMENTS,
  ADMIN_PUSH_TITLE_MAX_LENGTH,
  type AdminPushCampaignSegment,
} from "@shared/push-campaigns";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Globe2,
  Loader2,
  Send,
  Smartphone,
  Users,
} from "lucide-react";

interface PushCampaignOptions {
  pushConfigured: boolean;
  countries: string[];
}

interface PushAudience {
  targetAccounts: number;
  subscribedAccounts: number;
  subscribedDevices: number;
  pushConfigured: boolean;
}

interface CampaignResult {
  success: boolean;
  targetAccounts: number;
  targetedUsers: number;
  subscribedUsers: number;
  attemptedDevices: number;
  deliveredDevices: number;
  failedDevices: number;
  removedSubscriptions: number;
  usersReached: number;
}

const numberFormat = new Intl.NumberFormat("fr-FR");

export default function AdminPushCampaigns() {
  const { toast } = useToast();
  const [segment, setSegment] = useState<AdminPushCampaignSegment>("all_active");
  const [country, setCountry] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/dashboard/notifications");
  const [lastResult, setLastResult] = useState<CampaignResult | null>(null);

  const { data: options, isLoading: optionsLoading } = useQuery<PushCampaignOptions>({
    queryKey: ["/api/admin/push-campaigns/options"],
  });

  const { data: audience, isLoading: audienceLoading, isFetching: audienceFetching } =
    useQuery<PushAudience>({
      queryKey: ["/api/admin/push-campaigns/audience", segment, country],
      queryFn: async () => {
        const params = new URLSearchParams({ segment });
        if (country !== "all") params.set("country", country);
        const response = await apiRequest(
          "GET",
          `/api/admin/push-campaigns/audience?${params.toString()}`,
        );
        return response.json();
      },
    });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/push-campaigns", {
        segment,
        country,
        title: title.trim(),
        body: body.trim(),
        url: url.trim(),
      });
      return response.json() as Promise<CampaignResult>;
    },
    onSuccess: (result) => {
      setLastResult(result);
      toast({
        title: "Notification envoyée",
        description: `${numberFormat.format(result.deliveredDevices)} appareil(s) ont reçu le push.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Échec de l'envoi",
        description: error.message || "La notification n'a pas pu être envoyée.",
        variant: "destructive",
      });
    },
  });

  const selectedSegment = ADMIN_PUSH_CAMPAIGN_SEGMENTS.find(
    (item) => item.value === segment,
  );
  const canSend = Boolean(
    options?.pushConfigured
      && audience?.subscribedAccounts
      && title.trim()
      && body.trim()
      && title.trim().length <= ADMIN_PUSH_TITLE_MAX_LENGTH
      && body.trim().length <= ADMIN_PUSH_BODY_MAX_LENGTH
      && !sendMutation.isPending,
  );

  const confirmAndSend = () => {
    if (!canSend || !audience) return;
    const selectedCountry = country === "all" ? "tous les pays" : country;
    const confirmed = window.confirm(
      `Envoyer « ${title.trim()} » à ${numberFormat.format(audience.subscribedAccounts)} compte(s) abonné(s) aux notifications push, dans ${selectedCountry} ?\n\n${numberFormat.format(audience.subscribedDevices)} appareil(s) seront ciblés.`,
    );
    if (confirmed) sendMutation.mutate();
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Notifications Push</h1>
            <p className="text-sm text-muted-foreground">
              Prépare et envoie une notification aux clients qui ont autorisé les push.
            </p>
          </div>
        </div>

        {!optionsLoading && options && !options.pushConfigured && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Notifications push non configurées</p>
              <p className="mt-1 text-muted-foreground">
                L'envoi est désactivé tant que le serveur n'a pas de configuration Web Push valide.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  Destinataires
                </CardTitle>
                <CardDescription>
                  Les comptes du personnel sont exclus. Les comptes suspendus sont ciblés uniquement si ce segment est choisi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="push-segment">Type d'utilisateur</Label>
                  <Select
                    value={segment}
                    onValueChange={(value) => setSegment(value as AdminPushCampaignSegment)}
                  >
                    <SelectTrigger id="push-segment">
                      <SelectValue placeholder="Choisir un segment" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(70vh,480px)]">
                      {ADMIN_PUSH_CAMPAIGN_SEGMENTS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSegment && (
                    <p className="text-xs text-muted-foreground">{selectedSegment.description}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="push-country">Pays</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger id="push-country">
                      <SelectValue placeholder="Tous les pays" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les pays</SelectItem>
                      {(options?.countries || []).map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      Comptes dans le segment
                    </div>
                    <p className="mt-2 text-xl font-semibold">
                      {audienceLoading
                        ? "…"
                        : numberFormat.format(audience?.targetAccounts || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Bell className="h-3.5 w-3.5" />
                      Comptes abonnés
                    </div>
                    <p className="mt-2 text-xl font-semibold">
                      {audienceLoading
                        ? "…"
                        : numberFormat.format(audience?.subscribedAccounts || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Smartphone className="h-3.5 w-3.5" />
                      Appareils abonnés
                    </div>
                    <p className="mt-2 text-xl font-semibold">
                      {audienceLoading
                        ? "…"
                        : numberFormat.format(audience?.subscribedDevices || 0)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Seuls les navigateurs où l'utilisateur a autorisé les notifications recevront le push. Une personne peut avoir plusieurs appareils.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="h-4 w-4 text-primary" />
                  Contenu de la notification
                </CardTitle>
                <CardDescription>
                  Le même titre et le même message seront envoyés à tous les destinataires sélectionnés.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="push-title">Titre</Label>
                    <span className="text-xs text-muted-foreground">
                      {title.length}/{ADMIN_PUSH_TITLE_MAX_LENGTH}
                    </span>
                  </div>
                  <Input
                    id="push-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={ADMIN_PUSH_TITLE_MAX_LENGTH}
                    placeholder="Ex. Nouvelle fonctionnalité disponible"
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="push-body">Message</Label>
                    <span className="text-xs text-muted-foreground">
                      {body.length}/{ADMIN_PUSH_BODY_MAX_LENGTH}
                    </span>
                  </div>
                  <Textarea
                    id="push-body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={ADMIN_PUSH_BODY_MAX_LENGTH}
                    rows={4}
                    placeholder="Écrivez un message court et utile."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="push-url">Lien interne à ouvrir au clic</Label>
                  <Input
                    id="push-url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    maxLength={512}
                    placeholder="/dashboard/notifications"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Utilisez un chemin de l'application commençant par « / ». Les liens vers des sites externes ne sont pas acceptés.
                  </p>
                </div>

                <Button
                  className="w-full sm:w-auto"
                  onClick={confirmAndSend}
                  disabled={!canSend || audienceLoading || audienceFetching}
                >
                  {sendMutation.isPending || audienceFetching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {sendMutation.isPending ? "Envoi en cours…" : "Envoyer la notification"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Aperçu
                </CardTitle>
                <CardDescription>
                  L'apparence exacte dépend du navigateur et de l'appareil.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border bg-muted/40 p-4">
                  <div className="flex items-start gap-3 rounded-lg border bg-background p-3 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bell className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold">
                        {title.trim() || "Titre de la notification"}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {body.trim() || "Votre message apparaîtra ici."}
                      </p>
                      <p className="mt-2 flex items-center gap-1 break-all text-xs text-muted-foreground">
                        <Globe2 className="h-3 w-3 shrink-0" />
                        {url.trim() || "/dashboard/notifications"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {lastResult && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {lastResult.failedDevices === 0
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    Résultat du dernier envoi
                  </CardTitle>
                  <CardDescription>
                    Le service push a accepté les notifications indiquées comme livrées; l'affichage final dépend de l'appareil.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <ResultRow label="Comptes dans le segment" value={lastResult.targetAccounts} />
                  <ResultRow label="Comptes ciblés avec abonnement" value={lastResult.targetedUsers} />
                  <ResultRow label="Appareils tentés" value={lastResult.attemptedDevices} />
                  <ResultRow label="Appareils acceptés" value={lastResult.deliveredDevices} />
                  <ResultRow label="Échecs" value={lastResult.failedDevices} />
                  <ResultRow label="Abonnements expirés retirés" value={lastResult.removedSubscriptions} />
                </CardContent>
              </Card>
            )}

            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">À savoir</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Les notifications push ne peuvent pas atteindre les utilisateurs qui ne se sont pas abonnés.</li>
                <li>Les abonnements expirés sont supprimés automatiquement pendant l'envoi.</li>
                <li>Le pays filtre les comptes selon le pays enregistré dans leur profil.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function ResultRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{numberFormat.format(value)}</span>
    </div>
  );
}
