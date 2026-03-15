import { useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Copy, CheckCheck, Globe, Key, Shield,
  Terminal, Lock, Zap, CheckCircle2,
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

  const langLabel: Record<string, string> = {
    json: "JSON",
    javascript: "Node.js",
    http: "HTTP",
    bash: "cURL",
    php: "PHP",
    python: "Python",
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-700/60 text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700/60">
        <span className="text-xs text-zinc-400 font-mono tracking-wide">{langLabel[language] ?? language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors text-xs"
          data-testid={`copy-code-${language}`}
        >
          {copied
            ? <><CheckCheck className="h-3.5 w-3.5 text-green-400" /><span className="text-green-400">Copié</span></>
            : <><Copy className="h-3.5 w-3.5" /><span>Copier</span></>}
        </button>
      </div>
      <pre className="bg-zinc-900 px-4 py-4 overflow-x-auto leading-relaxed">
        <code className="text-zinc-200 font-mono whitespace-pre">{code.trim()}</code>
      </pre>
    </div>
  );
}

function Section({ id, title, badge, children }: { id: string; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-5 scroll-mt-8">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {badge && <Badge variant="outline" className="text-xs font-mono">{badge}</Badge>}
      </div>
      {children}
    </section>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold border ${
      method === "POST"
        ? "bg-green-500/15 text-green-400 border-green-500/30"
        : "bg-blue-500/15 text-blue-400 border-blue-500/30"
    }`}>
      {method}
    </span>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
  );
}

function ApiEndpoint({ method, path, children }: { method: "GET" | "POST"; path: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/60 border-b border-zinc-700/50">
        <MethodBadge method={method} />
        <code className="text-sm font-mono text-zinc-100">{path}</code>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function ParamRow({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <tr className="border-b border-zinc-800 last:border-0">
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs text-violet-400">{name}</span>
        {required && <span className="ml-1.5 text-[10px] text-red-400 font-semibold">*</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-blue-400 font-mono">{type}</td>
      <td className="px-3 py-2.5 text-xs text-zinc-400">{desc}</td>
    </tr>
  );
}

const sections = [
  { id: "keys", label: "Les 3 clés API" },
  { id: "create", label: "Créer un lien" },
  { id: "status", label: "Vérifier le statut" },
  { id: "flow", label: "Flux complet" },
  { id: "examples", label: "Exemples" },
];

export default function HostedPageDocs() {
  return (
    <DashboardLayout>
      <div className="w-full max-w-5xl min-w-0">

        {/* Header */}
        <div className="mb-8 space-y-4">
          <Link href="/dashboard/api-keys">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground" data-testid="back-to-config">
              <ArrowLeft className="h-4 w-4" />
              Retour aux clés API
            </Button>
          </Link>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
              <Terminal className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Hosted Payment Page</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Intégrez le checkout Ashtech Pay dans votre application via API
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">v1.0</Badge>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">REST API</Badge>
                <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 border-violet-500/20 text-xs">HTTPS</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar nav */}
          <aside className="hidden lg:block w-44 shrink-0">
            <div className="sticky top-6 space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Navigation</p>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5 px-3 rounded-md hover:bg-muted/50"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-12">

            {/* ── 1. Les 3 clés API ── */}
            <Section id="keys" title="Les 3 clés API">
              <p className="text-sm text-muted-foreground">
                Quand tu génères tes clés dans la section Hosted Page, tu reçois <strong>3 clés distinctes</strong>, chacune avec un rôle précis.
              </p>

              <div className="space-y-3">
                {/* pk_live_ */}
                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Globe className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <code className="text-sm font-mono font-bold text-blue-400">pk_live_</code>
                      <span className="ml-2 text-xs text-muted-foreground font-medium">Public Key</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground pl-10">
                    Clé <strong>publique</strong> — peut être exposée dans ton frontend. Utilisée pour initialiser
                    le widget de paiement Ashtech Pay sur ta page (vérification d'identité marchand côté client).
                  </p>
                  <div className="pl-10 flex items-center gap-1.5 text-xs text-blue-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Sûr à exposer côté client (JavaScript frontend)</span>
                  </div>
                </div>

                {/* sk_live_ */}
                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Lock className="h-4 w-4 text-orange-400" />
                    </div>
                    <div>
                      <code className="text-sm font-mono font-bold text-orange-400">sk_live_</code>
                      <span className="ml-2 text-xs text-muted-foreground font-medium">Secret Key</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground pl-10">
                    Clé <strong>secrète</strong> — ne jamais exposer côté client. Utilisée pour les appels
                    serveur-à-serveur : vérification de signature des webhooks, remboursements, etc.
                  </p>
                  <div className="pl-10 flex items-center gap-1.5 text-xs text-orange-400">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Backend uniquement — ne jamais mettre dans le code frontend</span>
                  </div>
                </div>

                {/* hp_live_ */}
                <div className="rounded-xl border-2 border-violet-500/30 bg-violet-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                      <Zap className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <code className="text-sm font-mono font-bold text-violet-400">hp_live_</code>
                      <span className="ml-2 text-xs text-muted-foreground font-medium">Hosted Page Key</span>
                      <Badge className="ml-2 text-[10px] px-1.5 py-0 bg-violet-500 text-white">Clé principale</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground pl-10">
                    Clé utilisée pour <strong>créer des liens de paiement via l'API</strong>. C'est cette clé
                    que tu passes dans le header <InlineCode>Authorization</InlineCode> lors de l'appel à{" "}
                    <InlineCode>POST /api/v1/hosted-payment/create</InlineCode>. Elle génère un lien vers
                    la page de paiement Ashtech Pay.
                  </p>
                  <div className="pl-10 flex items-center gap-1.5 text-xs text-violet-400">
                    <Key className="h-3.5 w-3.5" />
                    <span>Backend uniquement — c'est la clé que tu utilises pour créer des liens de paiement</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex gap-3">
                  <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-200">
                    <strong>Règle d'or</strong> — La <InlineCode>sk_live_</InlineCode> et la{" "}
                    <InlineCode>hp_live_</InlineCode> ne doivent jamais apparaître dans ton code frontend,
                    dans un dépôt Git public, ou être partagées. Utilise des variables d'environnement.
                  </p>
                </div>
              </div>
            </Section>

            {/* ── 2. Créer un lien de paiement ── */}
            <Section id="create" title="Créer un lien de paiement" badge="POST">
              <p className="text-sm text-muted-foreground">
                Crée un lien de paiement unique. Le client est redirigé vers la page de paiement
                Ashtech Pay où il peut payer via Mobile Money (MTN, Orange, Wave, Airtel, etc.).
              </p>

              <ApiEndpoint method="POST" path="/api/v1/hosted-payment/create">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Headers requis</p>
                  <CodeBlock language="http" code={`Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Corps de la requête</p>
                  <CodeBlock language="json" code={`{
  "amount": 5000,
  "currency": "XAF",
  "description": "Paiement commande #123"
}`} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paramètres</p>
                  <div className="rounded-lg border border-zinc-700/50 overflow-hidden text-sm">
                    <table className="w-full">
                      <thead className="bg-zinc-800/60">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Champ</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Type</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <ParamRow name="amount" type="number" required desc="Montant à collecter, ex: 5000" />
                        <ParamRow name="currency" type="string" required desc="XOF · XAF · GNF · CDF" />
                        <ParamRow name="description" type="string?" desc="Description affichée sur la page de paiement" />
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-zinc-500">* champ obligatoire</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Réponse (200)</p>
                  <CodeBlock language="json" code={`{
  "status": "success",
  "payment_link": "https://pay.ashtechpay.top/pay/hp-ab12cd34",
  "payment_id": "uuid-du-lien-de-paiement",
  "slug": "hp-ab12cd34",
  "expires_at": "2026-03-15T15:30:00.000Z"
}`} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Champs de la réponse</p>
                  <div className="rounded-lg border border-zinc-700/50 overflow-hidden text-sm">
                    <table className="w-full">
                      <thead className="bg-zinc-800/60">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Champ</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-zinc-800">
                          <td className="px-3 py-2.5 font-mono text-xs text-violet-400">payment_link</td>
                          <td className="px-3 py-2.5 text-xs text-zinc-400">URL complète à partager avec ton client → page de paiement Ashtech Pay</td>
                        </tr>
                        <tr className="border-b border-zinc-800">
                          <td className="px-3 py-2.5 font-mono text-xs text-violet-400">payment_id</td>
                          <td className="px-3 py-2.5 text-xs text-zinc-400">ID à conserver pour vérifier le statut du paiement</td>
                        </tr>
                        <tr className="border-b border-zinc-800">
                          <td className="px-3 py-2.5 font-mono text-xs text-violet-400">slug</td>
                          <td className="px-3 py-2.5 text-xs text-zinc-400">Identifiant court du lien (préfixe hp-)</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2.5 font-mono text-xs text-violet-400">expires_at</td>
                          <td className="px-3 py-2.5 text-xs text-zinc-400">Date d'expiration du lien (30 minutes après création)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </ApiEndpoint>
            </Section>

            {/* ── 3. Vérifier le statut ── */}
            <Section id="status" title="Vérifier le statut d'un paiement" badge="GET">
              <p className="text-sm text-muted-foreground">
                Vérifie le statut d'un paiement à partir du <InlineCode>payment_id</InlineCode> reçu lors de la création.
                À appeler depuis ton backend pour confirmer le paiement.
              </p>

              <ApiEndpoint method="GET" path="/api/v1/hosted-payment/:payment_id">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Réponse (200)</p>
                  <CodeBlock language="json" code={`{
  "payment_id": "uuid-du-lien-de-paiement",
  "slug": "hp-ab12cd34",
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
                  <div className="rounded-lg border border-zinc-700/50 overflow-hidden text-sm">
                    <table className="w-full">
                      <thead className="bg-zinc-800/60">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Statut</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Signification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { s: "pending", color: "text-yellow-400", desc: "Lien créé, le client n'a pas encore payé." },
                          { s: "processing", color: "text-blue-400", desc: "Le client a initié le paiement, en cours de confirmation." },
                          { s: "success", color: "text-green-400", desc: "Paiement confirmé — ton wallet est crédité." },
                          { s: "failed", color: "text-red-400", desc: "Paiement échoué ou annulé par le client." },
                          { s: "expired", color: "text-zinc-500", desc: "Le lien a expiré (30 min dépassées sans paiement)." },
                        ].map(({ s, color, desc }) => (
                          <tr key={s} className="border-b border-zinc-800 last:border-0">
                            <td className={`px-3 py-2.5 font-mono text-xs ${color}`}>{s}</td>
                            <td className="px-3 py-2.5 text-xs text-zinc-400">{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ApiEndpoint>
            </Section>

            {/* ── 4. Flux complet ── */}
            <Section id="flow" title="Flux de paiement complet">
              <div className="rounded-xl border bg-card overflow-hidden">
                {[
                  { step: "1", label: "Ton backend → API", desc: "POST /api/v1/hosted-payment/create avec amount, currency, description", color: "bg-blue-500" },
                  { step: "2", label: "API → Ton backend", desc: "Retourne payment_link (/pay/hp-xxx) et payment_id", color: "bg-violet-500" },
                  { step: "3", label: "Ton app → Client", desc: "Tu rediriges ton client vers le payment_link", color: "bg-amber-500" },
                  { step: "4", label: "Client → Page de paiement", desc: "Ashtech Pay affiche la page de paiement (déjà opérationnelle)", color: "bg-orange-500" },
                  { step: "5", label: "Client paie", desc: "Il choisit son pays, opérateur, saisit son numéro et confirme via USSD/OTP/Wave", color: "bg-green-500" },
                  { step: "6", label: "Paiement confirmé", desc: "La page redirige le client vers ton site (success_url ou cancel_url)", color: "bg-teal-500" },
                  { step: "7", label: "Ton backend → Vérification", desc: "GET /api/v1/hosted-payment/:payment_id → status = success", color: "bg-emerald-600" },
                  { step: "8", label: "Wallet crédité", desc: "Ton wallet Ashtech Pay est automatiquement crédité du montant", color: "bg-emerald-500" },
                ].map(({ step, label, desc, color }) => (
                  <div key={step} className="flex items-start gap-4 px-5 py-3.5 border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                    <div className={`w-6 h-6 rounded-full ${color} flex items-center justify-center shrink-0 mt-0.5`}>
                      <span className="text-white text-[10px] font-bold">{step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── 5. Exemples de code ── */}
            <Section id="examples" title="Exemples de code">

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Node.js / Express</p>
                <CodeBlock language="javascript" code={`const express = require("express");
const router = express.Router();

const HP_KEY = process.env.HP_LIVE_KEY; // hp_live_xxx

// Route sur ton backend : le client clique "Payer"
router.post("/checkout", async (req, res) => {
  const { amount, currency, orderId } = req.body;

  const response = await fetch("https://pay.ashtechpay.top/api/v1/hosted-payment/create", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${HP_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,         // "XAF", "XOF", "GNF", ou "CDF"
      description: \`Commande #\${orderId}\`,
    }),
  });

  const data = await response.json();

  if (data.status !== "success") {
    return res.status(500).json({ error: "Impossible de créer le lien" });
  }

  // Sauvegarde payment_id en base pour vérifier plus tard
  await db.orders.update({ orderId, paymentId: data.payment_id });

  // Redirige le client vers la page de paiement Ashtech Pay
  res.json({ redirect: data.payment_link });
});

// Webhook / vérification du paiement
router.get("/payment-status/:orderId", async (req, res) => {
  const order = await db.orders.findOne({ orderId: req.params.orderId });

  const response = await fetch(
    \`https://pay.ashtechpay.top/api/v1/hosted-payment/\${order.paymentId}\`,
    { headers: { "Authorization": \`Bearer \${HP_KEY}\` } }
  );

  const data = await response.json();
  // data.status = "pending" | "processing" | "success" | "failed" | "expired"

  res.json({ status: data.status, amount: data.amount });
});`} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PHP</p>
                <CodeBlock language="php" code={`<?php
$hpKey = getenv("HP_LIVE_KEY"); // hp_live_xxx

// Créer un lien de paiement
$ch = curl_init("https://pay.ashtechpay.top/api/v1/hosted-payment/create");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer $hpKey",
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "amount"      => 5000,
    "currency"    => "XAF",
    "description" => "Paiement commande #123",
  ]),
]);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($response["status"] === "success") {
  // Redirige le client
  header("Location: " . $response["payment_link"]);
  exit;
}`} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Python</p>
                <CodeBlock language="python" code={`import requests
import os

HP_KEY = os.environ["HP_LIVE_KEY"]  # hp_live_xxx

def create_payment_link(amount: int, currency: str, description: str = "") -> dict:
    response = requests.post(
        "https://pay.ashtechpay.top/api/v1/hosted-payment/create",
        headers={
            "Authorization": f"Bearer {HP_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "amount": amount,
            "currency": currency,      # "XAF", "XOF", "GNF", ou "CDF"
            "description": description,
        },
    )
    data = response.json()
    if data["status"] != "success":
        raise Exception(f"Erreur: {data}")
    return data

def check_payment_status(payment_id: str) -> str:
    response = requests.get(
        f"https://pay.ashtechpay.top/api/v1/hosted-payment/{payment_id}",
        headers={"Authorization": f"Bearer {HP_KEY}"},
    )
    return response.json()["status"]

# Utilisation
link = create_payment_link(5000, "XAF", "Commande #123")
print(link["payment_link"])   # → https://pay.ashtechpay.top/pay/hp-ab12cd34
print(link["payment_id"])     # → uuid à stocker en base

# Plus tard, vérifier le statut
status = check_payment_status(link["payment_id"])
# "pending" | "processing" | "success" | "failed" | "expired"`} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">cURL (test rapide)</p>
                <CodeBlock language="bash" code={`curl -X POST https://pay.ashtechpay.top/api/v1/hosted-payment/create \\
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 5000, "currency": "XAF", "description": "Test paiement"}'`} />
              </div>
            </Section>

            {/* Back button */}
            <div className="pt-6 border-t">
              <Link href="/dashboard/api-keys">
                <Button variant="outline" className="gap-2" data-testid="button-back-bottom">
                  <ArrowLeft className="h-4 w-4" />
                  Retour aux clés API
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
