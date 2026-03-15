import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Globe, Key, Copy, CheckCheck, RefreshCw, BookOpen,
  ExternalLink, Zap, Shield, ChevronRight, Eye, EyeOff,
} from "lucide-react";

interface HostedPageConfig {
  id: string;
  userId: string;
  successUrl: string | null;
  cancelUrl: string | null;
  pkLive: string | null;
  skLive: string | null;
  hpLive: string | null;
  createdAt: string;
  updatedAt: string;
}

function CopyableKey({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const { toast } = useToast();

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Clé copiée", description: `${label} copiée dans le presse-papiers.` });
  }

  const masked = value.slice(0, 12) + "•".repeat(20) + value.slice(-4);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-lg border px-3 py-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <code className="text-sm font-mono flex-1 truncate text-foreground">
            {visible ? value : masked}
          </code>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setVisible(!visible)}
          data-testid={`toggle-${label.toLowerCase().replace(/\s/g, "-")}`}
          className="h-9 w-9 p-0 shrink-0"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          data-testid={`copy-${label.toLowerCase().replace(/\s/g, "-")}`}
          className="h-9 w-9 p-0 shrink-0"
        >
          {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function HostedPageDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [successUrl, setSuccessUrl] = useState("");
  const [cancelUrl, setCancelUrl] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { data: config, isLoading } = useQuery<HostedPageConfig | null>({
    queryKey: ["/api/hosted-page/config"],
    select: (data) => data,
    refetchOnWindowFocus: false,
  });

  if (config && !initialized) {
    setSuccessUrl(config.successUrl || "");
    setCancelUrl(config.cancelUrl || "");
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data: { successUrl: string; cancelUrl: string; regenerate?: boolean }) =>
      apiRequest("POST", "/api/hosted-page/config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosted-page/config"] });
      toast({ title: "Configuration sauvegardée", description: "Vos clés API sont prêtes à l'emploi." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de sauvegarder la configuration.", variant: "destructive" });
    },
  });

  const hasKeys = config?.pkLive && config?.skLive && config?.hpLive;

  function handleGenerate() {
    saveMutation.mutate({ successUrl, cancelUrl });
  }

  function handleRegenerate() {
    saveMutation.mutate({ successUrl, cancelUrl, regenerate: true });
  }

  function handleSaveUrls() {
    saveMutation.mutate({ successUrl, cancelUrl });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Globe className="h-4 w-4 text-violet-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Hosted Payment Page</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">
            Intégrez une page de paiement hébergée sur Ashtech Pay dans votre application.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Key, label: "1. Configurez", desc: "Entrez vos URLs de redirection et générez vos clés." },
            { icon: Zap, label: "2. Créez un lien", desc: "Appelez l'API pour créer un lien de paiement unique." },
            { icon: Shield, label: "3. Le client paie", desc: "Le client paie sur la page Ashtech Pay hébergée." },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>URLs de redirection après paiement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="success-url">Success Redirect URL</Label>
              <Input
                id="success-url"
                data-testid="input-success-url"
                placeholder="https://monsite.com/payment/success"
                value={successUrl}
                onChange={(e) => setSuccessUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                URL vers laquelle le client sera redirigé après un paiement réussi.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancel-url">Cancel Redirect URL</Label>
              <Input
                id="cancel-url"
                data-testid="input-cancel-url"
                placeholder="https://monsite.com/payment/cancel"
                value={cancelUrl}
                onChange={(e) => setCancelUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                URL vers laquelle le client sera redirigé si le paiement échoue ou est annulé.
              </p>
            </div>

            {hasKeys ? (
              <Button
                variant="outline"
                onClick={handleSaveUrls}
                disabled={saveMutation.isPending}
                data-testid="button-save-urls"
              >
                {saveMutation.isPending ? "Sauvegarde..." : "Sauvegarder les URLs"}
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={saveMutation.isPending}
                data-testid="button-generate-keys"
                className="w-full sm:w-auto"
              >
                {saveMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Generate API Keys
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* API Keys */}
        {hasKeys && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">API Keys</CardTitle>
                  <CardDescription>Utilisez ces clés pour intégrer Ashtech Pay dans votre application.</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                  Actives
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CopyableKey
                label="Public Key"
                value={config!.pkLive!}
                icon={<Key className="h-3.5 w-3.5" />}
              />
              <CopyableKey
                label="Secret Key"
                value={config!.skLive!}
                icon={<Shield className="h-3.5 w-3.5" />}
              />
              <CopyableKey
                label="Hosted Page Key"
                value={config!.hpLive!}
                icon={<Globe className="h-3.5 w-3.5" />}
              />

              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={saveMutation.isPending}
                  data-testid="button-regenerate-keys"
                  className="text-destructive hover:text-destructive"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  Regénérer toutes les clés
                </Button>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Attention — regénérer les clés invalidera les clés actuelles.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documentation button */}
        {hasKeys && (
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Documentation développeur</p>
                  <p className="text-xs text-muted-foreground">
                    Consultez la documentation complète pour intégrer la Hosted Payment Page.
                  </p>
                </div>
                <Link href="/dashboard/hosted-page/docs">
                  <Button data-testid="button-documentation" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    Documentation
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
