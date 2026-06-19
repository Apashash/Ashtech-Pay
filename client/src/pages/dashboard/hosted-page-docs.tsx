import { useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, CheckCheck, Terminal, Download, FlaskConical } from "lucide-react";
import { downloadHostedPagePDF } from "@/lib/pdf-docs";

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
    <div className="rounded-lg overflow-hidden border border-gray-200 text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
        <span className="text-xs text-gray-500 font-mono">{langLabel[language] ?? language}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors text-xs">
          {copied
            ? <><CheckCheck className="h-3.5 w-3.5 text-emerald-500" /><span>Copié</span></>
            : <><Copy className="h-3.5 w-3.5" /><span>Copier</span></>}
        </button>
      </div>
      <pre className="bg-[#0d1117] px-4 py-4 overflow-x-auto leading-relaxed">
        <code className="text-zinc-300 font-mono whitespace-pre text-xs">{code.trim()}</code>
      </pre>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Method({ m }: { m: "GET" | "POST" }) {
  return (
    <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border ${
      m === "POST" ? "border-sky-300 text-sky-700 bg-sky-50" : "border-gray-300 text-gray-600 bg-gray-100"
    }`}>{m}</span>
  );
}

function IC({ children }: { children: React.ReactNode }) {
  return <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded text-xs font-mono border border-sky-200">{children}</code>;
}

function Endpoint({ method, path }: { method: "GET" | "POST"; path: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
      <Method m={method} />
      <code className="text-xs font-mono text-gray-800">{path}</code>
    </div>
  );
}

function ParamTable({ rows }: { rows: { name: string; type: string; required?: boolean; desc: string }[] }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 text-gray-500 font-medium">Champ</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium">Type</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-gray-100">
              <td className="px-3 py-2.5">
                <span className="font-mono text-sky-700">{r.name}</span>
                {r.required && <span className="ml-1 text-amber-600 font-bold">*</span>}
              </td>
              <td className="px-3 py-2.5 font-mono text-gray-500">{r.type}</td>
              <td className="px-3 py-2.5 text-gray-600">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusTable({ rows }: { rows: { s: string; desc: string; action: string }[] }) {
  const color: Record<string, string> = {
    pending: "text-gray-500",
    processing: "text-sky-700",
    success: "text-emerald-700",
    failed: "text-rose-600",
    expired: "text-gray-400",
  };
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 text-gray-500 font-medium">Statut</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium">Signification</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.map(({ s, desc, action }) => (
            <tr key={s} className="border-t border-gray-100">
              <td className={`px-3 py-2.5 font-mono ${color[s] ?? "text-gray-500"}`}>{s}</td>
              <td className="px-3 py-2.5 text-gray-600">{desc}</td>
              <td className="px-3 py-2.5 text-gray-500">{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ type = "info", children }: { type?: "info" | "warn"; children: React.ReactNode }) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
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
  { id: "webhook", label: "Webhook (notify_url)" },
  { id: "examples", label: "Exemples de code" },
];

export default function HostedPageDocs({ publicMode = false }: { publicMode?: boolean }) {
  const backHref = publicMode ? "/" : "/dashboard/api-keys";
  const backLabel = publicMode ? "Accueil" : "Retour aux clés API";
  const [downloading, setDownloading] = useState(false);

  function handleDownloadPDF() {
    setDownloading(true);
    setTimeout(() => {
      downloadHostedPagePDF();
      setDownloading(false);
    }, 50);
  }

  const content = (
      <div className="w-full max-w-5xl min-w-0">

        {/* Header */}
        <div className="mb-8">
          <Link href={backHref}>
            <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-gray-500 hover:text-gray-900 mb-4" data-testid="back-to-config">
              <ArrowLeft className="h-4 w-4" /> {backLabel}
            </Button>
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <Terminal className="h-5 w-5 text-gray-500" />
                <h1 className="text-xl font-semibold text-gray-900">Hosted Payment Page</h1>
                <span className="text-xs font-mono text-gray-500 border border-gray-300 px-1.5 py-0.5 rounded">v1.0</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Intègre le checkout Ashtech Pay dans ton application via API REST. 22+ pays, Mobile Money.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/docs/test-pay">
                <Button
                  size="sm"
                  className="gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 hover:border-primary/50 shrink-0"
                  data-testid="link-test-api-hp"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Tester l'API
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="gap-2 border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 shrink-0"
                data-testid="button-download-pdf-hosted"
              >
                <Download className="h-3.5 w-3.5" />
                {downloading ? "Génération…" : "Télécharger PDF"}
              </Button>
            </div>
          </div>

          {/* Try it CTA banner */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 mt-4">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-gray-900">Testez l'intégration en direct</p>
              <p className="text-xs text-gray-600">Générez un vrai lien de paiement Hosted Page depuis notre sandbox interactif — aucun code requis.</p>
            </div>
            <Link href="/docs/test-pay">
              <Button size="sm" className="gap-2 shrink-0 whitespace-nowrap" data-testid="cta-test-hp">
                <FlaskConical className="h-3.5 w-3.5" />
                Ouvrir le sandbox
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar nav */}
          <aside className="hidden lg:block w-44 shrink-0">
            <div className="sticky top-6">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Sur cette page</p>
              <div className="space-y-0.5">
                {sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`}
                    className="block text-xs text-gray-500 hover:text-gray-900 transition-colors py-1 pl-3 border-l border-gray-200 hover:border-gray-400">
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
              <p className="text-sm text-gray-600">
                En générant tes clés dans l'onglet <IC>Hosted Page</IC>, tu obtiens 3 clés distinctes.
              </p>

              <div className="rounded-lg border border-gray-200 overflow-hidden text-xs bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Clé</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Rôle</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Où l'utiliser</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-3 font-mono text-sky-700">pk_live_</td>
                      <td className="px-3 py-3 text-gray-700">Public Key</td>
                      <td className="px-3 py-3 text-gray-500">Frontend JS — identifie ton compte côté client</td>
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-3 font-mono text-sky-700">sk_live_</td>
                      <td className="px-3 py-3 text-gray-700">Secret Key</td>
                      <td className="px-3 py-3 text-gray-500">Backend uniquement — webhooks, remboursements</td>
                    </tr>
                    <tr className="border-t border-gray-100 bg-sky-50">
                      <td className="px-3 py-3 font-mono text-sky-700">hp_live_</td>
                      <td className="px-3 py-3 text-gray-900 font-medium">Hosted Page Key ★</td>
                      <td className="px-3 py-3 text-gray-600">Backend — créer des liens de paiement via API</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Note type="warn">
                <strong className="text-amber-800">Sécurité</strong> — <IC>sk_live_</IC> et <IC>hp_live_</IC> doivent rester dans des variables d'environnement côté serveur. Ne les publie jamais dans du code frontend ni dans un dépôt Git public.
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
                { name: "notify_url", type: "string?", desc: "Optionnel — surcharge la Webhook URL configurée dans vos paramètres pour ce lien spécifique" },
              ]} />
              <p className="text-xs text-gray-500">* champ obligatoire</p>

              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Réponse 200</p>
              <CodeBlock language="json" code={`{
  "status": "success",
  "payment_link": "https://ashtechpay.top/pay/hp-ab12cd34",
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
              <p className="text-sm text-gray-600">
                Le montant est défini à la création. Le client voit le montant sur la page et ne peut pas le modifier.
                Idéal pour les produits, abonnements, factures.
              </p>
              <CodeBlock language="javascript" code={`fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {
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
    // notify_url est définie dans vos paramètres — Ashtech Pay la récupère automatiquement
  }),
})`} />
            </Section>

            {/* ── 4. Prix libre ── */}
            <Section id="prix-libre" title="Prix libre — le client choisit le montant">
              <p className="text-sm text-gray-600">
                La page de paiement affiche un champ de saisie pour le montant. Le client entre ce qu'il veut payer.
                Idéal pour les dons, pourboires, paiements à montant variable.
              </p>
              <CodeBlock language="javascript" code={`fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {
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
              <p className="text-sm text-gray-600">
                Par défaut, tous les pays actifs sur Ashtech Pay sont disponibles. Tu peux restreindre à un sous-ensemble
                en passant leurs codes ISO dans <IC>allowed_countries</IC>.
              </p>
              <CodeBlock language="javascript" code={`body: JSON.stringify({
  currency: "XAF",
  amount: 10000,
  description: "Achat produit",
  allowed_countries: ["CM", "SN"],   // uniquement Cameroun + Sénégal
})`} />

              <div className="rounded-lg border border-gray-200 overflow-hidden text-xs bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Code ISO</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Pays</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Wallet crédité</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Opérateurs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "CM", flag: "🇨🇲", pays: "Cameroun",        wallet: "XAF",  ops: "MTN, Orange" },
                      { code: "SN", flag: "🇸🇳", pays: "Sénégal",         wallet: "XOFS", ops: "Orange, Wave, Free" },
                      { code: "CI", flag: "🇨🇮", pays: "Côte d'Ivoire",   wallet: "XOFC", ops: "Orange, MTN, Wave" },
                      { code: "BJ", flag: "🇧🇯", pays: "Bénin",           wallet: "XOFB", ops: "MTN, Moov" },
                      { code: "BF", flag: "🇧🇫", pays: "Burkina Faso",    wallet: "XOFF", ops: "Orange, Moov, Coris" },
                      { code: "ML", flag: "🇲🇱", pays: "Mali",            wallet: "XOFM", ops: "Orange, Moov" },
                      { code: "TG", flag: "🇹🇬", pays: "Togo",            wallet: "XOFT", ops: "Flooz, Tmoney" },
                      { code: "NE", flag: "🇳🇪", pays: "Niger",           wallet: "XOFN", ops: "Orange, Airtel" },
                      { code: "GW", flag: "🇬🇼", pays: "Guinée-Bissau",   wallet: "XOF",  ops: "MTN" },
                      { code: "GN", flag: "🇬🇳", pays: "Guinée",          wallet: "GNF",  ops: "Orange, MTN" },
                      { code: "CD", flag: "🇨🇩", pays: "Congo RDC",       wallet: "CDF",  ops: "Airtel, Orange" },
                      { code: "GA", flag: "🇬🇦", pays: "Gabon",           wallet: "XAFG", ops: "Airtel, Moov" },
                      { code: "CG", flag: "🇨🇬", pays: "Congo",           wallet: "XAFC", ops: "Airtel, MTN" },
                      { code: "CF", flag: "🇨🇫", pays: "Centrafrique",    wallet: "XAF",  ops: "Orange" },
                      { code: "TD", flag: "🇹🇩", pays: "Tchad",           wallet: "XAF",  ops: "Airtel, Moov" },
                      { code: "RW", flag: "🇷🇼", pays: "Rwanda",          wallet: "RWF",  ops: "MTN, Airtel" },
                      { code: "GH", flag: "🇬🇭", pays: "Ghana",           wallet: "GHS",  ops: "MTN, Vodafone, Airtel" },
                      { code: "NG", flag: "🇳🇬", pays: "Nigeria",         wallet: "NGN",  ops: "MTN, Airtel" },
                      { code: "KE", flag: "🇰🇪", pays: "Kenya",           wallet: "KES",  ops: "M-Pesa" },
                      { code: "TZ", flag: "🇹🇿", pays: "Tanzanie",        wallet: "TZS",  ops: "Vodacom, Airtel, Tigo" },
                      { code: "UG", flag: "🇺🇬", pays: "Ouganda",         wallet: "UGX",  ops: "MTN, Airtel" },
                      { code: "GM", flag: "🇬🇲", pays: "Gambie",          wallet: "GMD",  ops: "Afrimoney, QMoney" },
                    ].map(({ code, flag, pays, wallet, ops }) => (
                      <tr key={code} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono text-sky-700">{code}</td>
                        <td className="px-3 py-2 text-gray-700">{flag} {pays}</td>
                        <td className="px-3 py-2 font-mono text-sky-700 font-semibold">{wallet}</td>
                        <td className="px-3 py-2 text-gray-500">{ops}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Note type="info">
                Si <IC>allowed_countries</IC> est absent ou vide, <strong className="text-sky-300">tous les pays actifs</strong> sont disponibles. L'administrateur contrôle quels pays et opérateurs sont actifs — tout changement s'applique automatiquement sans modification de votre code.
              </Note>
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
              <p className="text-sm text-gray-600">
                Dès que l'opérateur Mobile Money confirme le paiement, Ashtech Pay crédite automatiquement ton wallet marchand dans la devise du pays du client. Aucune action requise de ta part.
              </p>

              <div className="rounded-lg border border-gray-200 bg-white divide-y divide-zinc-800/60 text-xs">
                {[
                  "Le client confirme le paiement sur son téléphone (USSD / OTP / Wave)",
                  "L'opérateur Mobile Money notifie Ashtech Pay",
                  "La transaction est enregistrée comme completed",
                  "Ton wallet marchand est crédité dans la devise du pays (frais déduits)",
                  "Le statut passe à success — tu peux livrer",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-zinc-600 font-mono shrink-0">{i + 1}.</span>
                    <span className="text-zinc-400">{step}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Wallet crédité par pays</p>
              <div className="rounded-lg border border-gray-200 overflow-hidden text-xs bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Pays du client</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Wallet marchand crédité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { pays: "🇧🇯 Bénin",           wallet: "XOFB" },
                      { pays: "🇸🇳 Sénégal",         wallet: "XOFS" },
                      { pays: "🇨🇮 Côte d'Ivoire",   wallet: "XOFC" },
                      { pays: "🇧🇫 Burkina Faso",    wallet: "XOFF" },
                      { pays: "🇲🇱 Mali",            wallet: "XOFM" },
                      { pays: "🇹🇬 Togo",            wallet: "XOFT" },
                      { pays: "🇳🇪 Niger",           wallet: "XOFN" },
                      { pays: "🇬🇼 Guinée-Bissau",   wallet: "XOF" },
                      { pays: "🇨🇲 Cameroun",        wallet: "XAF" },
                      { pays: "🇬🇦 Gabon",           wallet: "XAFG" },
                      { pays: "🇨🇬 Congo",           wallet: "XAFC" },
                      { pays: "🇨🇫 Centrafrique",    wallet: "XAF" },
                      { pays: "🇹🇩 Tchad",           wallet: "XAF" },
                      { pays: "🇬🇳 Guinée",          wallet: "GNF" },
                      { pays: "🇨🇩 Congo RDC",       wallet: "CDF" },
                      { pays: "🇷🇼 Rwanda",          wallet: "RWF" },
                      { pays: "🇬🇭 Ghana",           wallet: "GHS" },
                      { pays: "🇳🇬 Nigeria",         wallet: "NGN" },
                      { pays: "🇰🇪 Kenya",           wallet: "KES" },
                      { pays: "🇹🇿 Tanzanie",        wallet: "TZS" },
                      { pays: "🇺🇬 Ouganda",         wallet: "UGX" },
                      { pays: "🇬🇲 Gambie",          wallet: "GMD" },
                    ].map(({ pays, wallet }) => (
                      <tr key={pays} className="border-t border-gray-100">
                        <td className="px-3 py-2.5 text-gray-700">{pays}</td>
                        <td className="px-3 py-2.5 font-mono text-sky-700 font-semibold">{wallet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Note type="info">
                Chaque pays crédite un wallet séparé dans ta balance. Un client béninois → wallet <IC>XOFB</IC>. Un client sénégalais → wallet <IC>XOFS</IC>. Tu peux ensuite convertir ces wallets en <IC>XOF</IC>, <IC>XAF</IC> ou toute autre devise depuis ton tableau de bord.
              </Note>
            </Section>

            {/* ── 8. Webhook ── */}
            <Section id="webhook" title="Webhook — notification automatique">
              <p className="text-sm text-gray-600">
                Configure ta <IC>Webhook URL</IC> une seule fois dans tes{" "}
                <strong className="text-zinc-200">paramètres API Keys</strong>. Ashtech Pay la récupère
                automatiquement à chaque paiement Hosted Page — tu n'as pas besoin de la passer dans chaque lien.
                Une requête <IC>POST</IC> est envoyée dès que le paiement est confirmé ou échoue.
              </p>

              <Note type="info">
                Tu peux aussi passer un <IC>notify_url</IC> spécifique lors de la création d'un lien — il remplacera l'URL configurée par défaut pour ce lien uniquement. Le webhook est envoyé <strong className="text-zinc-200">depuis nos serveurs</strong> vers ton serveur — l'URL doit être publiquement accessible (pas localhost).
              </Note>

              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Payload reçu</p>
              <CodeBlock language="json" code={`{
  "event": "payment.completed",     // ou "payment.failed"
  "transaction_id": "uuid-de-la-txn",
  "reference": "ASHPAY-DEP-XXXXXXXXXXXX",
  "status": "completed",            // ou "failed"
  "amount": 4750,                   // montant net crédité sur ton wallet (frais déduits)
  "total_amount": 5000,             // montant brut payé par le client
  "currency": "XAF",
  "type": "deposit",
  "phone": "656123456",
  "timestamp": "2026-03-16T03:00:00.000Z"
}`} />

              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Exemple de récepteur webhook (Node.js / Express)</p>
              <CodeBlock language="javascript" code={`app.post("/webhooks/ashtechpay", express.json(), (req, res) => {
  // ✅ Toujours répondre 200 d'abord, traiter ensuite
  res.sendStatus(200);

  const { event, transaction_id, reference, amount, total_amount, currency } = req.body;

  if (event === "payment.completed") {
    // Paiement confirmé
    // amount      = montant net crédité sur votre wallet (après frais)
    // total_amount = montant brut payé par le client
    console.log(\`Paiement reçu : \${amount} \${currency} | txn: \${transaction_id}\`);
    // → créditer le compte client, livrer la commande, etc.
  }

  if (event === "payment.failed") {
    // Paiement échoué ou expiré
    console.log(\`Paiement échoué | ref: \${reference}\`);
    // → annuler la commande, notifier le client, etc.
  }
});`} />

              <Note type="warn">
                Réponds toujours <IC>HTTP 200</IC> immédiatement — même si une erreur survient côté serveur. Si ton serveur répond autre chose, le webhook ne sera pas renvoyé.
              </Note>
            </Section>

            {/* ── 9. Exemples ── */}
            <Section id="examples" title="Exemples de code">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Node.js</p>
              <CodeBlock language="javascript" code={`const HP_KEY = process.env.HP_LIVE_KEY;

// Créer un lien de paiement
async function createLink({ amount, currency, description, countries }) {
  const res = await fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {
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
      // notify_url configurée dans les paramètres — récupérée automatiquement
    }),
  });
  return res.json();
  // { payment_link, payment_id, expires_at, ... }
}

// Vérifier le statut
async function checkStatus(paymentId) {
  const res = await fetch(
    \`https://ashtechpay.top/api/v1/hosted-payment/\${paymentId}\`,
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
console.log(link.payment_link); // → https://ashtechpay.top/pay/hp-ab12cd34

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

              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">PHP</p>
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

  $ch = curl_init("https://ashtechpay.top/api/v1/hosted-payment/create");
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

              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">cURL</p>
              <CodeBlock language="bash" code={`# Prix fixe — Cameroun uniquement
curl -X POST https://ashtechpay.top/api/v1/hosted-payment/create \
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"currency":"XAF","amount":5000,"description":"Commande","allowed_countries":["CM"]}'

# Prix libre — tous les pays
curl -X POST https://ashtechpay.top/api/v1/hosted-payment/create \
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"currency":"XOF","description":"Don","is_fixed_amount":false}'

# Vérifier le statut
curl https://ashtechpay.top/api/v1/hosted-payment/UUID_DU_LIEN \
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"`} />
            </Section>

            {/* Back */}
            <div className="pt-6 border-t border-gray-200">
              <Link href={backHref}>
                <Button variant="outline" size="sm" className="gap-2 border-zinc-700 text-gray-600 hover:text-zinc-200" data-testid="button-back-bottom">
                  <ArrowLeft className="h-4 w-4" /> {backLabel}
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </div>
  );

  if (publicMode) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        {/* Public top bar */}
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 -ml-2 gap-1.5" data-testid="link-back-home">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Accueil</span>
                </Button>
              </Link>
              <div className="h-5 w-px bg-gray-200" />
              <span className="font-semibold text-sm text-gray-900">Ashtech Pay</span>
              <span className="text-[10px] border border-gray-300 text-gray-500 px-1.5 py-0.5 rounded font-mono hidden sm:inline">Hosted Page v1</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="gap-1.5 border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 text-xs"
                data-testid="button-download-pdf-hosted-public"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{downloading ? "Génération…" : "Télécharger PDF"}</span>
                <span className="sm:hidden">{downloading ? "…" : "PDF"}</span>
              </Button>
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 text-xs" data-testid="link-login">
                    Connexion
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="text-xs" data-testid="link-register">
                    S'inscrire
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-5xl mx-auto px-4 py-8">
          {content}
        </div>
      </div>
    );
  }

  return <DashboardLayout>{content}</DashboardLayout>;
}
