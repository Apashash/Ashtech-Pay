import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Code2, Globe, Eye, EyeOff, Copy, RefreshCw, BookOpen, CheckCircle2,
  Terminal, Webhook, ArrowRight, Shield, Zap, CheckCheck, ChevronRight,
} from "lucide-react";

type Mode = "hosted" | "sdk";

export default function ApiKeysPage() {
  const [mode, setMode] = useState<Mode>("hosted");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
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

                {/* Documentation button */}
                <Button
                  className="w-full mt-2"
                  onClick={() => setShowDocs(true)}
                  data-testid="button-open-docs"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Documentation d'intégration
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
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

      {/* Documentation dialog */}
      <Dialog open={showDocs} onOpenChange={setShowDocs}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="w-5 h-5 text-primary" />
              Documentation d'intégration — Ashtech Pay API
            </DialogTitle>
          </DialogHeader>
          <DocsContent apiKey={showKey && apiKey ? apiKey : "<VOTRE_CLÉ_API>"} />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function DocsContent({ apiKey }: { apiKey: string }) {
  const sections = [
    {
      id: "intro",
      icon: <Zap className="w-4 h-4" />,
      title: "Introduction",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            L'API Ashtech Pay permet à vos clients de payer directement sur votre site ou application mobile, sans quitter votre interface. Elle agit comme passerelle entre votre système et les opérateurs Mobile Money africains.
          </p>
          <ul className="space-y-1 pl-4">
            {["Collecte de paiements Mobile Money en temps réel", "Support multi-pays (CM, CI, SN, ML, BF, GN…)", "Routage intelligent entre opérateurs", "Webhooks pour confirmation en temps réel"].map((item) => (
              <li key={item} className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary" />{item}</li>
            ))}
          </ul>
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
            <p className="text-xs font-medium text-foreground">URL de base</p>
            <code className="text-xs font-mono text-primary">https://api.ashtechpay.top</code>
          </div>
        </div>
      ),
    },
    {
      id: "auth",
      icon: <Shield className="w-4 h-4" />,
      title: "Authentification",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Toutes les requêtes doivent inclure votre clé API dans l'en-tête <code className="text-xs bg-muted px-1 rounded">Authorization</code>.</p>
          <pre className="text-xs bg-muted/60 rounded-lg p-3 overflow-x-auto text-foreground/90">
{`Authorization: Bearer ${apiKey}`}
          </pre>
          <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">⚠ Ne partagez jamais votre clé API dans le code côté client (navigateur). Utilisez-la uniquement depuis votre serveur.</p>
        </div>
      ),
    },
    {
      id: "collect",
      icon: <Terminal className="w-4 h-4" />,
      title: "POST /v1/collect — Initier un paiement",
      content: (
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>Initie un paiement Mobile Money. Le client reçoit une demande de validation sur son téléphone.</p>

          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Corps de la requête</p>
            <div className="rounded-lg border overflow-hidden text-xs">
              <table className="w-full">
                <thead className="bg-muted/60">
                  <tr>
                    {["Paramètre", "Type", "Requis", "Description"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["amount", "number", "Oui", "Montant en unité de la devise"],
                    ["currency", "string", "Oui", "XAF, XOF, GNF, CDF"],
                    ["phone", "string", "Oui", "Numéro de téléphone du payeur"],
                    ["operator", "string", "Oui", "MTN, Orange, Wave, Moov…"],
                    ["reference", "string", "Non", "Référence unique de votre commande"],
                    ["notify_url", "string", "Non", "URL webhook de notification"],
                  ].map(([p, t, r, d]) => (
                    <tr key={p} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-primary">{p}</td>
                      <td className="px-3 py-2 text-foreground">{t}</td>
                      <td className="px-3 py-2">{r === "Oui" ? <span className="text-green-600 font-medium">Oui</span> : <span className="text-muted-foreground">Non</span>}</td>
                      <td className="px-3 py-2">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Exemple de requête</p>
            <pre className="text-xs bg-muted/60 rounded-lg p-3 overflow-x-auto text-foreground/90 leading-relaxed">
{`fetch("https://api.ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XAF",
    phone: "670000000",
    operator: "MTN",
    reference: "ORDER-123",
    notify_url: "https://monsite.com/webhook"
  })
})`}
            </pre>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Réponse</p>
            <pre className="text-xs bg-muted/60 rounded-lg p-3 overflow-x-auto text-foreground/90 leading-relaxed">
{`{
  "status": "pending",
  "transaction_id": "txn_abc123",
  "amount": 5000,
  "currency": "XAF",
  "operator": "MTN",
  "reference": "ORDER-123"
}`}
            </pre>
          </div>
        </div>
      ),
    },
    {
      id: "status",
      icon: <CheckCircle2 className="w-4 h-4" />,
      title: "GET /v1/transaction/:id — Statut",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Consultez le statut d'une transaction à tout moment.</p>
          <pre className="text-xs bg-muted/60 rounded-lg p-3 overflow-x-auto text-foreground/90">
{`fetch("https://api.ashtechpay.top/v1/transaction/txn_abc123", {
  headers: { "Authorization": "Bearer ${apiKey}" }
})`}
          </pre>
          <div className="rounded-lg border overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-muted/60">
                <tr>
                  {["Statut", "Description"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["pending", "En attente de confirmation"],
                  ["success", "Paiement confirmé"],
                  ["failed", "Paiement échoué ou annulé"],
                ].map(([s, d]) => (
                  <tr key={s} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono">{s}</td>
                    <td className="px-3 py-2">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: "webhook",
      icon: <Webhook className="w-4 h-4" />,
      title: "Webhooks",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Lorsqu'une transaction atteint un état final (<code className="text-xs bg-muted px-1 rounded">success</code> ou <code className="text-xs bg-muted px-1 rounded">failed</code>), Ashtech Pay envoie une notification POST à votre <code className="text-xs bg-muted px-1 rounded">notify_url</code>.</p>
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Corps de la notification</p>
            <pre className="text-xs bg-muted/60 rounded-lg p-3 overflow-x-auto text-foreground/90 leading-relaxed">
{`{
  "event": "payment.success",
  "transaction_id": "txn_abc123",
  "reference": "ORDER-123",
  "amount": 5000,
  "currency": "XAF",
  "operator": "MTN",
  "status": "success"
}`}
            </pre>
          </div>
          <p className="text-xs">Votre serveur doit répondre avec un code HTTP <code className="bg-muted px-1 rounded">200</code>. En cas d'échec de livraison, Ashtech Pay retentera jusqu'à 3 fois.</p>
        </div>
      ),
    },
    {
      id: "errors",
      icon: <Shield className="w-4 h-4" />,
      title: "Codes d'erreur",
      content: (
        <div className="text-sm text-muted-foreground">
          <div className="rounded-lg border overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-muted/60">
                <tr>
                  {["Code HTTP", "Message", "Signification"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["400", "Bad Request", "Paramètre manquant ou invalide"],
                  ["401", "Unauthorized", "Clé API manquante ou invalide"],
                  ["404", "Not Found", "Transaction introuvable"],
                  ["422", "Unprocessable", "Opérateur non supporté pour ce pays"],
                  ["500", "Server Error", "Erreur interne — réessayez"],
                ].map(([code, msg, desc]) => (
                  <tr key={code} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-orange-600 dark:text-orange-400">{code}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{msg}</td>
                    <td className="px-3 py-2">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pt-2">
      {sections.map((section) => (
        <div key={section.id} className="space-y-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <span className="text-primary">{section.icon}</span>
            <h3 className="font-semibold text-foreground text-sm">{section.title}</h3>
          </div>
          {section.content}
        </div>
      ))}

      <div className="rounded-lg bg-muted/40 border px-4 py-3 text-xs text-muted-foreground">
        Pour toute question technique, contactez notre support via <span className="font-medium text-foreground">Tableau de bord → Support</span>.
      </div>
    </div>
  );
}
