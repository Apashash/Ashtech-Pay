import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Code2, Globe, Eye, EyeOff, Copy, RefreshCw, BookOpen,
  CheckCircle2, Terminal, Shield, CheckCheck, ChevronRight,
} from "lucide-react";

type Mode = "hosted" | "sdk";

export default function ApiKeysPage() {
  const [mode, setMode] = useState<Mode>("hosted");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ apiKey: string }>({
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

  const apiKey = data?.apiKey ?? "";
  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}${"•".repeat(24)}${apiKey.slice(-4)}` : "";

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Clé copiée", description: "La clé API a été copiée dans le presse-papiers." });
  }

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

        {/* Hosted Page panel */}
        {mode === "hosted" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Hosted Page
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Avec la Hosted Page, Ashtech Pay héberge l'interface de paiement. Vous créez simplement un lien de paiement et redirigez vos clients vers cette page. Aucune intégration technique requise.
              </p>
              <div className="space-y-2">
                {[
                  "Aucune configuration serveur requise",
                  "Interface de paiement optimisée et sécurisée",
                  "Compatible avec tous les appareils",
                  "Mise à jour automatique des opérateurs disponibles",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Comment utiliser :</span> Rendez-vous dans{" "}
                <span className="font-mono text-primary">Mes liens</span> pour créer un lien de paiement et le partager avec vos clients.
              </div>
            </CardContent>
          </Card>
        )}

        {/* SDK Direct API panel */}
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

                {/* Key display */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <code
                      className="text-sm font-mono text-foreground flex-1 break-all select-all"
                      data-testid="text-api-key"
                    >
                      {isLoading ? "Chargement…" : showKey ? apiKey : maskedKey}
                    </code>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowKey((v) => !v)}
                        disabled={isLoading || !apiKey}
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
                        disabled={isLoading || !apiKey}
                        data-testid="button-copy-key"
                        title="Copier"
                      >
                        {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Regenerate button */}
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

                {/* Documentation link */}
                <Link href="/dashboard/developer">
                  <Button
                    className="w-full mt-2"
                    data-testid="link-open-docs"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Documentation d'intégration
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Quick start snippet */}
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
