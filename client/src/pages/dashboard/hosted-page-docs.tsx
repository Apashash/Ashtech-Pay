import { useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, CheckCheck, Terminal } from "lucide-react";

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  function copy() {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copié !" });
  }
  const langLabel: Record<string, string> = {
    json: "JSON", javascript: "Node.js", http: "HTTP",
    bash: "cURL", php: "PHP", python: "Python",
  };
  return (
    <div className="rounded-lg overflow-hidden border border-zinc-700/50 text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700/50">
        <span className="text-xs text-zinc-500 font-mono">{langLabel[language] ?? language}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-xs">
          {copied
            ? <><CheckCheck className="h-3.5 w-3.5" /><span>Copié</span></>
            : <><Copy className="h-3.5 w-3.5" /><span>Copier</span></>}
        </button>
      </div>
      <pre className="bg-zinc-950 px-4 py-4 overflow-x-auto leading-relaxed">
        <code className="text-zinc-300 font-mono whitespace-pre text-xs">{code.trim()}</code>
      </pre>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-8">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Method({ m }: { m: "GET" | "POST" }) {
  return (
    <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border ${
      m === "POST" ? "border-sky-800 text-sky-400 bg-sky-950/50" : "border-zinc-700 text-zinc-400 bg-zinc-800/50"
    }`}>{m}</span>
  );
}

function IC({ children }: { children: React.ReactNode }) {
  return <code className="text-sky-400 bg-sky-950/40 px-1 py-0.5 rounded text-xs font-mono">{children}</code>;
}

function Endpoint({ method, path }: { method: "GET" | "POST"; path: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700/50 rounded-lg">
      <Method m={method} />
      <code className="text-xs font-mono text-zinc-200">{path}</code>
    </div>
  );
}

function ParamTable({ rows }: { rows: { name: string; type: string; required?: boolean; desc: string }[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-zinc-900 border-b border-zinc-800">
            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Champ</th>
            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Type</th>
            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="bg-zinc-950">
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-zinc-800/60">
              <td className="px-3 py-2.5">
                <span className="font-mono text-sky-400">{r.name}</span>
                {r.required && <span className="ml-1 text-amber-500 font-bold">*</span>}
              </td>
              <td className="px-3 py-2.5 font-mono text-zinc-500">{r.type}</td>
              <td className="px-3 py-2.5 text-zinc-400">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusTable({ rows }: { rows: { s: string; desc: string; action: string }[] }) {
  const color: Record<string, string> = {
    pending: "text-zinc-400",
    processing: "text-sky-400",
    success: "text-emerald-400",
    failed: "text-rose-400/80",
    expired: "text-zinc-600",
  };
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-zinc-900 border-b border-zinc-800">
            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Statut</th>
            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Signification</th>
            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="bg-zinc-950">
          {rows.map(({ s, desc, action }) => (
            <tr key={s} className="border-t border-zinc-800/60">
              <td className={`px-3 py-2.5 font-mono ${color[s] ?? "text-zinc-400"}`}>{s}</td>
              <td className="px-3 py-2.5 text-zinc-400">{desc}</td>
              <td className="px-3 py-2.5 text-zinc-500">{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ type = "info", children }: { type?: "info" | "warn"; children: React.ReactNode }) {
  const styles = {
    info: "border-sky-900 bg-sky-950/30 text-sky-300",
    warn: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-xs leading-relaxed ${styles[type]}`}>
      {children}
    </div>
  );
}

const sections = [
  { id: "keys", label: "Les 3 clés API" },
  { id: "create", label: "Créer un lien" },
  { id: "prix-fixe", label: "Prix fixe" },
  { id: "prix-libre", label: "Prix libre" },
  { id: "pays", label: "Filtrer les pays" },
  { id: "status", label: "Vérifier le statut" },
  { id: "credit", label: "Créditement wallet" },
  { id: "examples", label: "Exemples de code" },
];

export default function HostedPageDocs() {
  return (
    <DashboardLayout>
      <div className="w-full max-w-5xl min-w-0">

        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/api-keys">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-zinc-500 hover:text-zinc-300 mb-4" data-testid="back-to-config">
              <ArrowLeft className="h-4 w-4" /> Retour aux clés API
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-zinc-500" />
            <h1 className="text-xl font-semibold text-zinc-100">Hosted Payment Page</h1>
            <span className="text-xs font-mono text-zinc-600 border border-zinc-700 px-1.5 py-0.5 rounded">v1.0</span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Intègre le checkout Ashtech Pay dans ton application via API REST. 16+ pays, Mobile Money.
          </p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar nav */}
          <aside className="hidden lg:block w-44 shrink-0">
            <div className="sticky top-6">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">Sur cette page</p>
              <div className="space-y-0.5">
                {sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`}
                    className="block text-xs text-zinc-500 hover:text-zinc-200 transition-colors py-1 pl-3 border-l border-zinc-800 hover:border-zinc-500">
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-12">

            {/* ── 1. Les 3 clés ── */}
            <Section id="keys" title="Les 3 clés API">
              <p className="text-sm text-zinc-400">
                En générant tes clés dans l'onglet <IC>Hosted Page</IC>, tu obtiens 3 clés distinctes.
              </p>

              <div className="rounded-lg border border-zinc-800 overflow-hidden text-xs bg-zinc-950">
                <table className="w-full">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-zinc-800">
                      <th className="text-left px-3 py-2 text-zinc-500 font-medium">Clé</th>
                      <th className="text-left px-3 py-2 text-zinc-500 font-medium">Rôle</th>
                      <th className="text-left px-3 py-2 text-zinc-500 font-medium">Où l'utiliser</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-zinc-800/60">
                      <td className="px-3 py-3 font-mono text-sky-400">pk_live_</td>
                      <td className="px-3 py-3 text-zinc-300">Public Key</td>
                      <td className="px-3 py-3 text-zinc-500">Frontend JS — identifie ton compte côté client</td>
                    </tr>
                    <tr className="border-t border-zinc-800/60">
                      <td className="px-3 py-3 font-mono text-sky-400">sk_live_</td>
                      <td className="px-3 py-3 text-zinc-300">Secret Key</td>
                      <td className="px-3 py-3 text-zinc-500">Backend uniquement — webhooks, remboursements</td>
                    </tr>
                    <tr className="border-t border-zinc-800/60 bg-sky-950/10">
                      <td className="px-3 py-3 font-mono text-sky-400">hp_live_</td>
                      <td className="px-3 py-3 text-zinc-200 font-medium">Hosted Page Key ★</td>
                      <td className="px-3 py-3 text-zinc-400">Backend — créer des liens de paiement via API</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Note type="warn">
                <strong className="text-amber-200">Sécurité</strong> — <IC>sk_live_</IC> et <IC>hp_live_</IC> doivent rester dans des variables d'environnement côté serveur. Ne les publie jamais dans du code frontend ni dans un dépôt Git public.
              </Note>
            </Section>

            {/* ── 2. Créer un lien ── */}
            <Section id="create" title="Créer un lien de paiement">
              <Endpoint method="POST" path="/api/v1/hosted-payment/create" />

              <CodeBlock language="http" code={`Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`} />

              <ParamTable rows={[
                { name: "currency", type: "string", required: true, desc: "XOF · XAF · GNF · CDF" },
                { name: "amount", type: "number", desc: "Montant fixe. Obligatoire si is_fixed_amount est true" },
                { name: "description", type: "string?", desc: "Titre affiché sur la page de paiement" },
                { name: "is_fixed_amount", type: "boolean?", desc: "true (défaut) = prix fixe. false = le client saisit le montant" },
                { name: "allowed_countries", type: "string[]?", desc: 'Codes ISO des pays à afficher. Ex: ["CM","SN"]. Vide = tous les pays' },
              ]} />
              <p className="text-xs text-zinc-600">* champ obligatoire</p>

              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Réponse 200</p>
              <CodeBlock language="json" code={`{
  "status": "success",
  "payment_link": "https://pay.ashtechpay.top/pay/hp-ab12cd34",
  "payment_id": "uuid-du-lien",
  "slug": "hp-ab12cd34",
  "is_fixed_amount": true,
  "amount": 5000,
  "currency": "XAF",
  "allowed_countries": null,
  "expires_at": "2026-03-15T15:30:00.000Z"
}`} />
            </Section>

            {/* ── 3. Prix fixe ── */}
            <Section id="prix-fixe" title="Prix fixe — tu définis le montant">
              <p className="text-sm text-zinc-400">
                Le montant est défini à la création. Le client voit le montant sur la page et ne peut pas le modifier.
                Idéal pour les produits, abonnements, factures.
              </p>
              <CodeBlock language="javascript" code={`fetch("https://pay.ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "XAF",
    amount: 5000,             // montant en unité locale (FCFA, GNF, CDF…)
    description: "Abonnement mensuel",
    is_fixed_amount: true,    // défaut — peut être omis
  }),
})`} />
            </Section>

            {/* ── 4. Prix libre ── */}
            <Section id="prix-libre" title="Prix libre — le client choisit le montant">
              <p className="text-sm text-zinc-400">
                La page de paiement affiche un champ de saisie pour le montant. Le client entre ce qu'il veut payer.
                Idéal pour les dons, pourboires, paiements à montant variable.
              </p>
              <CodeBlock language="javascript" code={`fetch("https://pay.ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "XOF",
    description: "Don libre",
    is_fixed_amount: false,   // ← le client saisit son montant
    // pas besoin de "amount"
  }),
})`} />
              <Note type="info">
                En mode prix libre, le montant réel payé par le client est disponible dans <IC>GET /api/v1/hosted-payment/:payment_id</IC> une fois le statut passé à <IC>success</IC>, dans le champ <IC>amount</IC>.
              </Note>
            </Section>

            {/* ── 5. Filtrer les pays ── */}
            <Section id="pays" title="Filtrer les pays affichés">
              <p className="text-sm text-zinc-400">
                Par défaut, tous les pays actifs sur Ashtech Pay sont disponibles. Tu peux restreindre à un sous-ensemble
                en passant leurs codes ISO dans <IC>allowed_countries</IC>.
              </p>
              <CodeBlock language="javascript" code={`body: JSON.stringify({
  currency: "XAF",
  amount: 10000,
  description: "Achat produit",
  allowed_countries: ["CM", "SN"],   // uniquement Cameroun + Sénégal
})`} />

              <div className="rounded-lg border border-zinc-800 overflow-hidden text-xs bg-zinc-950">
                <table className="w-full">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-zinc-800">
                      <th className="text-left px-3 py-2 text-zinc-500 font-medium">Code</th>
                      <th className="text-left px-3 py-2 text-zinc-500 font-medium">Pays</th>
                      <th className="text-left px-3 py-2 text-zinc-500 font-medium">Devise</th>
                      <th className="text-left px-3 py-2 text-zinc-500 font-medium">Opérateurs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "CM", pays: "Cameroun", flag: "🇨🇲", devise: "XAF", ops: "MTN, Orange" },
                      { code: "SN", pays: "Sénégal", flag: "🇸🇳", devise: "XOF", ops: "Orange, Wave, Free" },
                      { code: "CI", pays: "Côte d'Ivoire", flag: "🇨🇮", devise: "XOF", ops: "Orange, MTN, Wave" },
                      { code: "GN", pays: "Guinée", flag: "🇬🇳", devise: "GNF", ops: "Orange, MTN" },
                      { code: "CD", pays: "Congo RDC", flag: "🇨🇩", devise: "CDF", ops: "Airtel, Orange" },
                      { code: "BF", pays: "Burkina Faso", flag: "🇧🇫", devise: "XOF", ops: "Orange, Moov" },
                      { code: "ML", pays: "Mali", flag: "🇲🇱", devise: "XOF", ops: "Orange, Moov" },
                      { code: "TG", pays: "Togo", flag: "🇹🇬", devise: "XOF", ops: "Flooz, Tmoney" },
                      { code: "BJ", pays: "Bénin", flag: "🇧🇯", devise: "XOF", ops: "MTN, Moov" },
                    ].map(({ code, pays, flag, devise, ops }) => (
                      <tr key={code} className="border-t border-zinc-800/60">
                        <td className="px-3 py-2 font-mono text-sky-400">{code}</td>
                        <td className="px-3 py-2 text-zinc-400">{flag} {pays}</td>
                        <td className="px-3 py-2 font-mono text-zinc-500">{devise}</td>
                        <td className="px-3 py-2 text-zinc-500">{ops}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-600">
                Appelle <IC>GET /api/public/countries</IC> pour la liste complète en temps réel.
              </p>
            </Section>

            {/* ── 6. Vérifier le statut ── */}
            <Section id="status" title="Vérifier le statut d'un paiement">
              <Endpoint method="GET" path="/api/v1/hosted-payment/:payment_id" />

              <CodeBlock language="json" code={`{
  "payment_id": "uuid-du-lien",
  "slug": "hp-ab12cd34",
  "is_fixed_amount": true,
  "amount": 5000,
  "currency": "XAF",
  "description": "Abonnement Premium",
  "allowed_countries": ["CM"],
  "status": "success",
  "paid_at": "2026-03-15T15:12:34.000Z",
  "created_at": "2026-03-15T15:00:00.000Z",
  "expires_at": "2026-03-15T15:30:00.000Z"
}`} />

              <StatusTable rows={[
                { s: "pending", desc: "Lien créé, le client n'a pas encore payé", action: "Continuer à poller (toutes les 5s)" },
                { s: "processing", desc: "Le client a initié le paiement", action: "Continuer à poller" },
                { s: "success", desc: "Paiement confirmé — wallet crédité", action: "Livrer le produit / service" },
                { s: "failed", desc: "Paiement échoué ou refusé", action: "Notifier le client" },
                { s: "expired", desc: "30 min dépassées sans paiement", action: "Créer un nouveau lien" },
              ]} />

              <Note type="warn">
                <strong className="text-amber-200">Important</strong> — Ne livre jamais avant d'avoir vérifié <IC>status === "success"</IC>. Le statut <IC>processing</IC> signifie que le paiement est initié mais pas encore confirmé par l'opérateur.
              </Note>
            </Section>

            {/* ── 7. Créditement wallet ── */}
            <Section id="credit" title="Créditement automatique du wallet">
              <p className="text-sm text-zinc-400">
                Dès que l'opérateur Mobile Money confirme le paiement, Ashtech Pay crédite automatiquement ton wallet marchand.
                Aucune action requise de ta part.
              </p>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800/60 text-xs">
                {[
                  "Le client confirme le paiement sur son téléphone (USSD / OTP / Wave)",
                  "L'opérateur Mobile Money notifie Ashtech Pay",
                  "La transaction est enregistrée comme completed",
                  "Ton wallet marchand est crédité du montant (frais déduits)",
                  "Le statut passe à success — tu peux livrer",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-zinc-600 font-mono shrink-0">{i + 1}.</span>
                    <span className="text-zinc-400">{step}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── 8. Exemples ── */}
            <Section id="examples" title="Exemples de code">
              <p className="text-xs text-zinc-600 uppercase tracking-wide font-medium">Node.js</p>
              <CodeBlock language="javascript" code={`const HP_KEY = process.env.HP_LIVE_KEY;

// Créer un lien de paiement
async function createLink({ amount, currency, description, countries }) {
  const res = await fetch("https://pay.ashtechpay.top/api/v1/hosted-payment/create", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${HP_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currency,
      amount,
      description,
      is_fixed_amount: !!amount,           // false si pas de montant
      allowed_countries: countries ?? null, // null = tous les pays
    }),
  });
  return res.json();
  // { payment_link, payment_id, expires_at, ... }
}

// Vérifier le statut
async function checkStatus(paymentId) {
  const res = await fetch(
    \`https://pay.ashtechpay.top/api/v1/hosted-payment/\${paymentId}\`,
    { headers: { "Authorization": \`Bearer \${HP_KEY}\` } }
  );
  const data = await res.json();
  return data;
  // data.status  = "pending" | "processing" | "success" | "failed" | "expired"
  // data.paid_at = timestamp si success
  // data.amount  = montant réel (utile pour is_fixed_amount: false)
}

// Exemple d'utilisation
const link = await createLink({ amount: 5000, currency: "XAF", description: "Commande #123" });
console.log(link.payment_link); // → https://pay.ashtechpay.top/pay/hp-ab12cd34

// Polling toutes les 5 secondes
const interval = setInterval(async () => {
  const { status } = await checkStatus(link.payment_id);
  if (status === "success") {
    clearInterval(interval);
    console.log("Paiement confirmé — livrer le produit");
  } else if (status === "failed" || status === "expired") {
    clearInterval(interval);
    console.log("Paiement non abouti :", status);
  }
}, 5000);`} />

              <p className="text-xs text-zinc-600 uppercase tracking-wide font-medium">PHP</p>
              <CodeBlock language="php" code={`<?php
$hpKey = getenv("HP_LIVE_KEY");

function createPaymentLink($currency, $amount, $description, $countries = null) {
  global $hpKey;
  $payload = array_filter([
    "currency"          => $currency,
    "amount"            => $amount,
    "description"       => $description,
    "is_fixed_amount"   => !empty($amount),
    "allowed_countries" => $countries,
  ]);

  $ch = curl_init("https://pay.ashtechpay.top/api/v1/hosted-payment/create");
  curl_setopt_array($ch, [
    CURLOPT_POST            => true,
    CURLOPT_RETURNTRANSFER  => true,
    CURLOPT_HTTPHEADER      => [
      "Authorization: Bearer $hpKey",
      "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
  ]);
  $result = json_decode(curl_exec($ch), true);
  curl_close($ch);
  return $result;
}

$link = createPaymentLink("XAF", 10000, "Facture #456", ["CM"]);
header("Location: " . $link["payment_link"]);`} />

              <p className="text-xs text-zinc-600 uppercase tracking-wide font-medium">cURL</p>
              <CodeBlock language="bash" code={`# Prix fixe — Cameroun uniquement
curl -X POST https://pay.ashtechpay.top/api/v1/hosted-payment/create \
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"currency":"XAF","amount":5000,"description":"Commande","allowed_countries":["CM"]}'

# Prix libre — tous les pays
curl -X POST https://pay.ashtechpay.top/api/v1/hosted-payment/create \
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"currency":"XOF","description":"Don","is_fixed_amount":false}'

# Vérifier le statut
curl https://pay.ashtechpay.top/api/v1/hosted-payment/UUID_DU_LIEN \
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"`} />
            </Section>

            {/* Back */}
            <div className="pt-6 border-t border-zinc-800">
              <Link href="/dashboard/api-keys">
                <Button variant="outline" size="sm" className="gap-2 border-zinc-700 text-zinc-400 hover:text-zinc-200" data-testid="button-back-bottom">
                  <ArrowLeft className="h-4 w-4" /> Retour aux clés API
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
