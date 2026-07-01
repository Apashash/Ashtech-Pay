import { useState } from "react";
import { AdminLayout } from "../layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TurnstileWidget } from "@/components/ui/turnstile";
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, ShieldCheck, Key } from "lucide-react";

export default function AdminSettingsTurnstile() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error" | "fallback">("idle");
  const [widgetKey, setWidgetKey] = useState(0);

  const { data: turnstileConfig } = useQuery<{ siteKey: string }>({
    queryKey: ["/api/public/turnstile-key"],
    staleTime: Infinity,
  });

  const siteKey = turnstileConfig?.siteKey || import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

  const handleReset = () => {
    setToken(null);
    setStatus("idle");
    setWidgetKey(k => k + 1);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`${(import.meta.env.VITE_ADMIN_PATH as string) || "/admin"}/settings`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Test Turnstile</h1>
            <p className="text-muted-foreground text-sm">Vérifie que la protection anti-bot Cloudflare fonctionne</p>
          </div>
        </div>

        {/* Clé configurée */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Clé publique (TURNSTILE_SITE_KEY)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {siteKey ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600 border-green-500/40 bg-green-500/10 font-mono text-xs">
                  {siteKey}
                </Badge>
                <Badge className="bg-green-500/20 text-green-600 border-0">Configurée</Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-red-500 border-red-500/40">Non configurée</Badge>
                <span className="text-xs text-muted-foreground">Ajoute TURNSTILE_SITE_KEY dans les variables d'environnement</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Widget test */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Test de vérification</CardTitle>
            </div>
            <CardDescription>
              {siteKey
                ? "Passe la vérification Cloudflare pour confirmer que la clé fonctionne sur ce domaine."
                : "Aucune clé configurée — le test ne peut pas s'exécuter."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!siteKey ? (
              <div className="py-4 px-3 rounded-md border border-dashed border-muted-foreground/40 bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">🔒 Clé Turnstile manquante — test impossible</p>
              </div>
            ) : status === "idle" ? (
              <div className="flex flex-col items-center gap-3">
                <TurnstileWidget
                  key={widgetKey}
                  siteKey={siteKey}
                  theme="auto"
                  onSuccess={(t) => { setToken(t); setStatus("success"); }}
                  onError={() => setStatus("error")}
                  onFallback={() => setStatus("fallback")}
                />
              </div>
            ) : status === "success" ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle className="w-12 h-12 text-green-500" />
                <p className="font-semibold text-green-600">Vérification réussie !</p>
                <p className="text-xs text-muted-foreground text-center break-all max-w-sm">
                  Token : <span className="font-mono">{token?.slice(0, 40)}…</span>
                </p>
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Retester
                </Button>
              </div>
            ) : status === "error" ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <XCircle className="w-12 h-12 text-red-500" />
                <p className="font-semibold text-red-600">Échec de la vérification</p>
                <p className="text-xs text-muted-foreground text-center">
                  Le domaine n'est probablement pas autorisé dans le tableau de bord Cloudflare Turnstile.
                </p>
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Réessayer
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4">
                <XCircle className="w-12 h-12 text-yellow-500" />
                <p className="font-semibold text-yellow-600">Widget non chargé (fallback)</p>
                <p className="text-xs text-muted-foreground text-center">
                  Cloudflare n'a pas répondu dans les 10s. Vérifie ta connexion ou le domaine.
                </p>
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Réessayer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
