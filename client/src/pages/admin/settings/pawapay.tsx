import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  Save,
  Server,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAdminPath } from "@/lib/adminPath";
import { useToast } from "@/hooks/use-toast";

type PawaPaySettings = {
  apiTokenConfigured: boolean;
  apiTokenMasked: string | null;
  apiTokenUnreadable?: boolean;
  webhookSecretConfigured: boolean;
  webhookSecretMasked: string | null;
  webhookSecretUnreadable?: boolean;
  credentialEncryptionConfigured?: boolean;
  baseUrl: string;
  callbackUrls: { deposit: string; payout: string };
};

export default function AdminSettingsPawaPay() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PawaPaySettings>({
    queryKey: ["/api/admin/pawapay/settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/pawapay/settings");
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/admin/pawapay/settings", {
        ...(apiToken.trim() ? { apiToken: apiToken.trim() } : {}),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
      });
      return response.json();
    },
    onSuccess: (updated: PawaPaySettings) => {
      setApiToken("");
      setWebhookSecret("");
      queryClient.setQueryData(["/api/admin/pawapay/settings"], updated);
      toast({ title: "Configuration PawaPay enregistrée" });
    },
    onError: (error: Error) => {
      toast({ title: "Enregistrement impossible", description: error.message, variant: "destructive" });
    },
  });

  const copyUrl = async (key: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation(`${getAdminPath()}/settings`)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Passerelle de paiement</p>
            <h1 className="text-2xl font-bold">PawaPay production</h1>
            <p className="text-muted-foreground">Identifiants chiffrés et callbacks officiels Ashtech Pay</p>
          </div>
        </div>

        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <Server className="h-4 w-4 text-emerald-600" />
          <AlertTitle>Environnement verrouillé</AlertTitle>
          <AlertDescription>
            Toutes les opérations utilisent exclusivement l’API PawaPay de production. Le mode sandbox n’est pas disponible.
          </AlertDescription>
        </Alert>

        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Configuration inaccessible</AlertTitle>
            <AlertDescription>La configuration PawaPay n’a pas pu être chargée. Vérifiez votre session administrateur.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-600" />
              Identifiants PawaPay
            </CardTitle>
            <CardDescription>
              Les champs sont toujours vides. Laissez un champ vide pour conserver sa valeur actuelle.
                Les secrets sont chiffrés côté serveur avant d’être enregistrés en base.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(data?.apiTokenUnreadable || data?.webhookSecretUnreadable) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Identifiant enregistré mais illisible</AlertTitle>
                <AlertDescription>
                  Une ancienne valeur chiffrée existe en base, mais ce serveur ne peut pas la lire.
                  Remplacez simplement l’identifiant concerné ci-dessous ; il sera enregistré avec le
                  chiffrement sécurisé actuel.
                </AlertDescription>
              </Alert>
            )}
            {data && data.credentialEncryptionConfigured === false && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Chiffrement sécurisé indisponible</AlertTitle>
                <AlertDescription>
                  Le serveur ne possède pas le secret nécessaire pour protéger les identifiants.
                  Contactez l’administrateur de l’hébergement avant d’enregistrer un token.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pawapay-api-token">Bearer API token</Label>
                {data?.apiTokenConfigured ? (
                  <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Configuré {data.apiTokenMasked}</Badge>
                ) : <Badge variant="outline">Non configuré</Badge>}
              </div>
              <Input
                id="pawapay-api-token"
                type="password"
                autoComplete="new-password"
                value={apiToken}
                onChange={(event) => setApiToken(event.target.value)}
                placeholder={data?.apiTokenConfigured ? "Remplacer le token actuel" : "Coller le token de production"}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pawapay-webhook-secret">Secret des callbacks</Label>
                {data?.webhookSecretConfigured ? (
                  <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Configuré {data.webhookSecretMasked}</Badge>
                ) : <Badge variant="outline">Non configuré</Badge>}
              </div>
              <Input
                id="pawapay-webhook-secret"
                type="password"
                autoComplete="new-password"
                value={webhookSecret}
                onChange={(event) => setWebhookSecret(event.target.value)}
                placeholder={data?.webhookSecretConfigured ? "Remplacer le secret actuel" : "Saisir le secret de callback"}
              />
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || (!apiToken.trim() && !webhookSecret.trim()) || isLoading}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Enregistrement..." : "Enregistrer les identifiants"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="w-5 h-5 text-slate-600" />
              Endpoints de production
            </CardTitle>
            <CardDescription>
              Ces adresses sont configurées dans le tableau de bord PawaPay. Aucun secret n’est inclus dans les URLs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">API</p>
              <p className="font-mono text-sm break-all">{data?.baseUrl || "https://api.pawapay.io/v2"}</p>
            </div>
            {(["deposit", "payout"] as const).map((key) => {
              const url = data?.callbackUrls?.[key];
              if (!url) return null;
              return (
                <div key={key} className="flex items-center gap-2 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {key === "deposit" ? "Callback dépôt" : "Callback retrait / transfert"}
                    </p>
                    <p className="font-mono text-xs break-all">{url}</p>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => copyUrl(key, url)} aria-label="Copier l’URL">
                    {copied === key ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clipboard className="h-4 w-4" />}
                  </Button>
                </div>
              );
            })}
            <a
              href="https://api.pawapay.io/v2"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline"
            >
              Vérifier l’API PawaPay <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}