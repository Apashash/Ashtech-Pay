import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Code2, Globe, Eye, EyeOff, Copy, RefreshCw, BookOpen,
  CheckCircle2, Terminal, Shield, CheckCheck, ChevronRight, Key, Zap,
} from "lucide-react";

type Mode = "hosted" | "sdk";

interface HostedPageConfig {
  id: string;
  userId: string;
  successUrl: string | null;
  cancelUrl: string | null;
  pkLive: string | null;
  skLive: string | null;
  hpLive: string | null;
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
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
          <code className="text-sm font-mono flex-1 truncate text-foreground">
            {visible ? value : masked}
          </code>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setVisible(!visible)}
          data-testid={`toggle-${label.toLowerCase().replace(/\s/g, "-")}`}
          className="h-9 w-9 shrink-0"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={copy}
          data-testid={`copy-${label.toLowerCase().replace(/\s/g, "-")}`}
          className="h-9 w-9 shrink-0"
        >
          {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  const [mode, setMode] = useState<Mode>("hosted");

  // SDK panel state
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  // Hosted page state
  const [successUrl, setSuccessUrl] = useState("");
  const [cancelUrl, setCancelUrl] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // SDK: API key query
  const { data: sdkData, isLoading: sdkLoading } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/user/api-key"],
  });

  const regenerateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/user/api-key/regenerate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-key"] });
      setShowKey(false);
      toast({ title: "Clé regénérée", description: "Votre nouvelle clé API est prête. Mettez à jour votre intégration." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de regénérer la clé.", variant: "destructive" });
    },
  });

  const apiKey = sdkData?.apiKey ?? "";
  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}${"•".repeat(24)}${apiKey.slice(-4)}` : "";

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Clé copiée", description: "La clé API a été copiée dans le presse-papiers." });
  }

  // Hosted page: config query
  const { data: hpConfig, isLoading: hpLoading } = useQuery<HostedPageConfig | null>({
    queryKey: ["/api/hosted-page/config"],
    refetchOnWindowFocus: false,
  });

  if (hpConfig && !initialized) {
    setSuccessUrl(hpConfig.successUrl || "");
    setCancelUrl(hpConfig.cancelUrl || "");
    setInitialized(true);
  }

  const hpMutation = useMutation({
    mutationFn: (data: { successUrl: string; cancelUrl: string; regenerate?: boolean }) =>
      apiRequest("POST", "/api/hosted-page/config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosted-page/config"] });
      toast({ title: "Configuration sauvegardée", description: "Vos clés API Hosted Page sont prêtes." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
    },
  });

  const hasHpKeys = hpConfig?.pkLive && hpConfig?.skLive && hpConfig?.hpLive;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clé API</h1>
          <p className="text-muted-foreground text-sm mt-1">Intégrez Ashtech Pay directement dans votre application</p>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMode("hosted")}
            data-testid="button-mode-hosted"
            className={`rounded-xl border-2 p-5 text-left transition-all focus:outline-none ${
              mode === "hosted"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${mode === "hosted" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">Hosted Page</span>
                  {mode === "hosted" && <Badge className="text-[10px] px-1.5 py-0">Actif</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Lien de paiement hébergé par Ashtech Pay</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode("sdk")}
            data-testid="button-mode-sdk"
            className={`rounded-xl border-2 p-5 text-left transition-all focus:outline-none ${
              mode === "sdk"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${mode === "sdk" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">SDK Direct API</span>
                  {mode === "sdk" && <Badge className="text-[10px] px-1.5 py-0">Actif</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Intégration directe sans redirection</p>
              </div>
            </div>
          </button>
        </div>

        {/* ── Hosted Page panel ── */}
        {mode === "hosted" && (
          <div className="space-y-4">

            {/* How it works */}
            <div className="grid grid-cols-3 gap-3">
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

            {/* Configuration URLs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Configuration
                </CardTitle>
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

                {hasHpKeys ? (
                  <Button
                    variant="outline"
                    onClick={() => hpMutation.mutate({ successUrl, cancelUrl })}
                    disabled={hpMutation.isPending}
                    data-testid="button-save-urls"
                  >
                    {hpMutation.isPending ? "Sauvegarde..." : "Sauvegarder les URLs"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => hpMutation.mutate({ successUrl, cancelUrl })}
                    disabled={hpMutation.isPending}
                    data-testid="button-generate-keys"
                    className="w-full sm:w-auto"
                  >
                    {hpMutation.isPending ? (
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

            {/* API Keys display */}
            {hasHpKeys && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary" />
                      API Keys
                    </CardTitle>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                      Actives
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CopyableKey
                    label="Public Key"
                    value={hpConfig!.pkLive!}
                    icon={<Key className="h-3.5 w-3.5" />}
                  />
                  <CopyableKey
                    label="Secret Key"
                    value={hpConfig!.skLive!}
                    icon={<Shield className="h-3.5 w-3.5" />}
                  />
                  <CopyableKey
                    label="Hosted Page Key"
                    value={hpConfig!.hpLive!}
                    icon={<Globe className="h-3.5 w-3.5" />}
                  />

                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => hpMutation.mutate({ successUrl, cancelUrl, regenerate: true })}
                      disabled={hpMutation.isPending}
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
            {hasHpKeys && (
              <Link href="/dashboard/hosted-page/docs">
                <Button className="w-full" data-testid="button-documentation">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Documentation
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            )}

            {hpLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* ── SDK Direct API panel ── */}
        {mode === "sdk" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Votre clé API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Utilisez cette clé pour authentifier toutes vos requêtes à l'API Ashtech Pay. Ne la partagez jamais publiquement.
                </p>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <code
                      className="text-sm font-mono text-foreground flex-1 break-all select-all"
                      data-testid="text-api-key"
                    >
                      {sdkLoading ? "Chargement…" : showKey ? apiKey : maskedKey}
                    </code>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowKey((v) => !v)}
                        disabled={sdkLoading || !apiKey}
                        data-testid="button-toggle-key-visibility"
                        title={showKey ? "Masquer" : "Afficher"}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={copyKey}
                        disabled={sdkLoading || !apiKey}
                        data-testid="button-copy-key"
                        title="Copier"
                      >
                        {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Si vous regénérez la clé, l'ancienne sera immédiatement invalidée.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerateMutation.mutate()}
                    disabled={regenerateMutation.isPending}
                    data-testid="button-regenerate-key"
                    className="shrink-0 ml-4"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                    Regénérer
                  </Button>
                </div>

                <Link href="/dashboard/developer">
                  <Button className="w-full mt-2" data-testid="link-open-docs">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Documentation d'intégration
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  Exemple rapide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted/60 rounded-lg p-4 overflow-x-auto text-foreground/90 leading-relaxed">
{`fetch("https://api.ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${showKey && apiKey ? apiKey : "<VOTRE_CLÉ_API>"}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XAF",
    phone: "670000000",
    operator: "MTN",
    reference: "ORDER-123"
  })
})`}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
