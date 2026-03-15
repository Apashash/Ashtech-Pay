import { useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Copy, CheckCheck, Globe, Key, Zap, Shield,
  ChevronRight, BookOpen, Terminal,
} from "lucide-react";

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  function copy() {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copié !", description: "Code copié dans le presse-papiers." });
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-700">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700">
        <span className="text-xs text-zinc-400 font-mono">{language}</span>
        <button
          onClick={copy}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
          data-testid={`copy-code-${language}`}
        >
          {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="bg-zinc-900 px-4 py-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-zinc-200 font-mono whitespace-pre">{code.trim()}</code>
      </pre>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-6">
      <h2 className="text-lg font-bold text-foreground border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    POST: "bg-green-500/15 text-green-400 border-green-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${colors[method] || ""}`}>
      {method}
    </span>
  );
}

const sections = [
  { id: "authentication", label: "Authentification" },
  { id: "create-link", label: "Créer un lien" },
  { id: "check-status", label: "Vérifier le statut" },
  { id: "flow", label: "Flux complet" },
];

export default function HostedPageDocs() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <Link href="/dashboard/hosted-page">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground" data-testid="back-to-config">
              <ArrowLeft className="h-4 w-4" />
              Retour à la configuration
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Hosted Payment Page</h1>
              <p className="text-muted-foreground text-sm">Documentation d'intégration</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">v1.0</Badge>
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">REST API</Badge>
            <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 border-violet-500/20">HTTPS</Badge>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar nav */}
          <aside className="hidden lg:block w-48 shrink-0">
            <div className="sticky top-6 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contenu</p>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 border-l-2 border-transparent hover:border-primary pl-3"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 space-y-10 min-w-0">

            {/* Authentication */}
            <Section id="authentication" title="Authentification">
              <p className="text-sm text-muted-foreground">
                L'API Hosted Payment Page utilise la clé <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-xs">hp_live_</code> pour l'authentification.
                Incluez-la dans le header <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-xs">Authorization</code> de chaque requête.
              </p>
              <CodeBlock language="http" code={`Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`} />
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex gap-2">
                  <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-200">
                    <strong>Important</strong> — Ne partagez jamais votre clé <code className="text-amber-300">hp_live_</code> côté client.
                    Utilisez-la uniquement dans vos serveurs backend.
                  </div>
                </div>
              </div>
            </Section>

            {/* Create payment link */}
            <Section id="create-link" title="Créer un lien de paiement">
              <p className="text-sm text-muted-foreground">
                Créez un lien de paiement unique que vous pouvez partager avec votre client.
                Le client sera redirigé vers la page de paiement hébergée par Ashtech Pay.
              </p>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <MethodBadge method="POST" />
                  <code className="text-sm font-mono text-foreground">/api/v1/hosted-payment/create</code>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Headers</p>
                  <CodeBlock language="http" code={`Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Request Body</p>
                  <CodeBlock language="json" code={`{
  "amount": 5000,
  "currency": "XAF",
  "description": "Paiement commande #123"
}`} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paramètres</p>
                  <div className="overflow-hidden rounded-lg border text-sm">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground">Champ</th>
                          <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground">Type</th>
                          <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[
                          { field: "amount", type: "number", desc: "Montant à collecter (ex: 5000)" },
                          { field: "currency", type: "string", desc: "Devise: XOF, XAF, GNF, CDF" },
                          { field: "description", type: "string?", desc: "Description optionnelle du paiement" },
                        ].map((r) => (
                          <tr key={r.field}>
                            <td className="px-3 py-2 font-mono text-xs text-violet-400">{r.field}</td>
                            <td className="px-3 py-2 text-xs text-blue-400">{r.type}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{r.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Réponse</p>
                  <CodeBlock language="json" code={`{
  "status": "success",
  "payment_link": "https://pay.ashtechpay.top/hpay/pay_a1b2c3d4e5f6...",
  "payment_id": "pay_a1b2c3d4e5f6...",
  "expires_at": "2026-03-15T15:30:00.000Z"
}`} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exemple complet (Node.js)</p>
                <CodeBlock language="javascript" code={`const response = await fetch("https://pay.ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": "Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XAF",
    description: "Paiement commande #123",
  }),
});

const data = await response.json();

if (data.status === "success") {
  // Redirigez votre client vers le lien de paiement
  window.location.href = data.payment_link;
}`} />
              </div>
            </Section>

            {/* Check status */}
            <Section id="check-status" title="Vérifier le statut d'un paiement">
              <p className="text-sm text-muted-foreground">
                Utilisez le <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-xs">payment_id</code> retourné
                lors de la création pour vérifier le statut du paiement.
              </p>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <MethodBadge method="GET" />
                  <code className="text-sm font-mono text-foreground">/api/v1/hosted-payment/:payment_id</code>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Réponse</p>
                  <CodeBlock language="json" code={`{
  "payment_id": "pay_a1b2c3d4e5f6...",
  "amount": 5000,
  "currency": "XAF",
  "description": "Paiement commande #123",
  "status": "success",
  "created_at": "2026-03-15T15:00:00.000Z",
  "expires_at": "2026-03-15T15:30:00.000Z"
}`} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statuts possibles</p>
                  <div className="overflow-hidden rounded-lg border text-sm">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground">Statut</th>
                          <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[
                          { status: "pending", color: "text-yellow-400", desc: "Lien créé, en attente du client." },
                          { status: "processing", color: "text-blue-400", desc: "Le client a initié le paiement." },
                          { status: "success", color: "text-green-400", desc: "Paiement confirmé, wallet crédité." },
                          { status: "failed", color: "text-red-400", desc: "Paiement échoué ou annulé." },
                          { status: "expired", color: "text-zinc-400", desc: "Lien expiré (30 minutes)." },
                        ].map((r) => (
                          <tr key={r.status}>
                            <td className={`px-3 py-2 font-mono text-xs ${r.color}`}>{r.status}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{r.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Section>

            {/* Flow */}
            <Section id="flow" title="Flux de paiement complet">
              <p className="text-sm text-muted-foreground">
                Voici le flux complet d'un paiement via la Hosted Payment Page.
              </p>

              <div className="rounded-xl border bg-card overflow-hidden">
                {[
                  { step: "1", label: "Merchant → API", desc: "POST /api/v1/hosted-payment/create", color: "bg-blue-500" },
                  { step: "2", label: "API → Merchant", desc: "Retourne payment_link + payment_id", color: "bg-violet-500" },
                  { step: "3", label: "Merchant → Client", desc: "Redirige vers payment_link", color: "bg-amber-500" },
                  { step: "4", label: "Client → Ashtech Pay", desc: "Ouvre la page de paiement hébergée", color: "bg-orange-500" },
                  { step: "5", label: "Client paie", desc: "Saisit son numéro et confirme via USSD/OTP/Wave", color: "bg-green-500" },
                  { step: "6", label: "Ashtech Pay → Client", desc: "Redirige vers success_url ou cancel_url", color: "bg-teal-500" },
                  { step: "7", label: "Wallet crédité", desc: "Le wallet marchand est crédité automatiquement", color: "bg-emerald-500" },
                ].map(({ step, label, desc, color }) => (
                  <div key={step} className="flex items-start gap-4 px-5 py-4 border-b last:border-b-0">
                    <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center shrink-0 mt-0.5`}>
                      <span className="text-white text-xs font-bold">{step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <CodeBlock language="javascript" code={`// Dispatcher universel — créer un lien et rediriger
async function createPaymentLink({ amount, currency, description }) {
  const res = await fetch("/api/v1/hosted-payment/create", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.HP_LIVE_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, currency, description }),
  });

  const data = await res.json();
  if (data.status !== "success") throw new Error(data.message);

  return {
    paymentId: data.payment_id,
    paymentLink: data.payment_link,
    expiresAt: data.expires_at,
  };
}

// Vérifier le statut (depuis votre backend)
async function checkPaymentStatus(paymentId) {
  const res = await fetch(\`/api/v1/hosted-payment/\${paymentId}\`, {
    headers: { Authorization: \`Bearer \${process.env.HP_LIVE_KEY}\` },
  });
  const data = await res.json();
  return data.status; // "pending" | "processing" | "success" | "failed" | "expired"
}`} />
            </Section>

            {/* Back button */}
            <div className="pt-4 border-t">
              <Link href="/dashboard/hosted-page">
                <Button variant="outline" className="gap-2" data-testid="button-back-bottom">
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la configuration
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
