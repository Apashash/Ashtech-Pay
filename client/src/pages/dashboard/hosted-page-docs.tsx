import { useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Copy, CheckCheck, Globe, Key, Shield,
  Terminal, Lock, Zap, CheckCircle2, Wallet, MapPin, Tag,
} from "lucide-react";

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
    <div className="relative rounded-xl overflow-hidden border border-zinc-700/60 text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700/60">
        <span className="text-xs text-zinc-400 font-mono tracking-wide">{langLabel[language] ?? language}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors text-xs">
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
      <div className="flex items-center gap-3 border-b border-border pb-3">
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
      method === "POST" ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-blue-500/15 text-blue-400 border-blue-500/30"
    }`}>{method}</span>
  );
}

function IC({ children }: { children: React.ReactNode }) {
  return <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
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

function ParamTable({ rows }: { rows: { name: string; type: string; required?: boolean; desc: string }[] }) {
  return (
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
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-zinc-800">
              <td className="px-3 py-2.5">
                <span className="font-mono text-xs text-violet-400">{r.name}</span>
                {r.required && <span className="ml-1 text-[10px] text-red-400 font-bold">*</span>}
              </td>
              <td className="px-3 py-2.5 text-xs text-blue-400 font-mono">{r.type}</td>
              <td className="px-3 py-2.5 text-xs text-zinc-400">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  { id: "flow", label: "Flux complet" },
  { id: "examples", label: "Exemples de code" },
];

export default function HostedPageDocs() {
  return (
    <DashboardLayout>
      <div className="w-full max-w-5xl min-w-0">

        {/* Header */}
        <div className="mb-8 space-y-4">
          <Link href="/dashboard/api-keys">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground" data-testid="back-to-config">
              <ArrowLeft className="h-4 w-4" /> Retour aux clés API
            </Button>
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
              <Terminal className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Hosted Payment Page — Documentation</h1>
              <p className="text-muted-foreground text-sm mt-1">Intègre le checkout Ashtech Pay dans ton app via API REST</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">v1.0</Badge>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">REST API</Badge>
                <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 border-violet-500/20 text-xs">16+ pays</Badge>
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
                <a key={s.id} href={`#${s.id}`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5 px-3 rounded-md hover:bg-muted/50">
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
                Quand tu génères tes clés dans l'onglet <strong>Hosted Page</strong>, tu reçois 3 clés distinctes, chacune avec un rôle précis.
              </p>

              <div className="space-y-3">
                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Globe className="h-4 w-4 text-blue-400" />
                    </div>
                    <code className="text-sm font-mono font-bold text-blue-400">pk_live_</code>
                    <span className="text-xs text-muted-foreground">— Public Key</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-10">
                    Clé <strong>publique</strong>. Peut être exposée dans ton frontend JavaScript. Identifie ton compte marchand côté client (future initialisation de widget).
                  </p>
                  <div className="pl-10 flex items-center gap-1.5 text-xs text-blue-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Sûr à exposer côté client
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Lock className="h-4 w-4 text-orange-400" />
                    </div>
                    <code className="text-sm font-mono font-bold text-orange-400">sk_live_</code>
                    <span className="text-xs text-muted-foreground">— Secret Key</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-10">
                    Clé <strong>secrète</strong>. Réservée aux appels serveur-à-serveur : vérification de signature webhook, remboursements, etc.
                  </p>
                  <div className="pl-10 flex items-center gap-1.5 text-xs text-orange-400">
                    <Shield className="h-3.5 w-3.5 shrink-0" /> Backend uniquement — ne jamais mettre côté client
                  </div>
                </div>

                <div className="rounded-xl border-2 border-violet-500/30 bg-violet-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                      <Zap className="h-4 w-4 text-violet-400" />
                    </div>
                    <code className="text-sm font-mono font-bold text-violet-400">hp_live_</code>
                    <span className="text-xs text-muted-foreground">— Hosted Page Key</span>
                    <Badge className="text-[10px] px-1.5 py-0 bg-violet-500 text-white">Clé principale</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground pl-10">
                    La clé utilisée pour <strong>créer des liens de paiement via l'API</strong>. Tu la passes dans le header <IC>Authorization: Bearer hp_live_xxx</IC> de chaque requête à <IC>POST /api/v1/hosted-payment/create</IC>.
                  </p>
                  <div className="pl-10 flex items-center gap-1.5 text-xs text-violet-400">
                    <Key className="h-3.5 w-3.5 shrink-0" /> Backend uniquement — c'est la clé pour créer des liens de paiement
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex gap-3">
                  <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-200">
                    <strong>Règle d'or</strong> — <IC>sk_live_</IC> et <IC>hp_live_</IC> doivent rester dans des variables d'environnement côté serveur. Ne les publie jamais sur GitHub ou dans du code frontend.
                  </p>
                </div>
              </div>
            </Section>

            {/* ── 2. Créer un lien ── */}
            <Section id="create" title="Créer un lien de paiement" badge="POST">
              <p className="text-sm text-muted-foreground">
                Un seul endpoint pour créer tous tes liens de paiement. Il supporte le prix fixe, le prix libre, et le filtrage par pays.
                Le lien généré pointe vers la page de paiement Ashtech Pay déjà opérationnelle.
              </p>

              <ApiEndpoint method="POST" path="/api/v1/hosted-payment/create">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Headers</p>
                  <CodeBlock language="http" code={`Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tous les paramètres</p>
                  <ParamTable rows={[
                    { name: "currency", type: "string", required: true, desc: "Devise : XOF · XAF · GNF · CDF" },
                    { name: "amount", type: "number", desc: "Montant fixe (ex: 5000). Obligatoire si is_fixed_amount = true" },
                    { name: "description", type: "string?", desc: "Titre/description affiché sur la page de paiement" },
                    { name: "is_fixed_amount", type: "boolean?", desc: "true = prix fixe (défaut), false = le client saisit le montant" },
                    { name: "allowed_countries", type: "string[]?", desc: "Codes pays ISO à afficher (ex: [\"CM\", \"SN\"]). Vide = tous les pays actifs" },
                  ]} />
                  <p className="text-xs text-zinc-500">* champ obligatoire</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Réponse (200)</p>
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
                </div>
              </ApiEndpoint>
            </Section>

            {/* ── 3. Prix fixe ── */}
            <Section id="prix-fixe" title="Mode Prix Fixe">
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-card">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Tag className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Le montant est défini par toi</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Le client voit le montant affiché sur la page de paiement et ne peut pas le modifier.
                    Idéal pour les produits avec prix fixe, abonnements, factures.
                  </p>
                </div>
              </div>

              <CodeBlock language="javascript" code={`// Prix fixe : 5 000 XAF — le client ne peut pas changer le montant
const res = await fetch("https://pay.ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "XAF",
    amount: 5000,               // montant en unité locale (FCFA, GNF, CDF…)
    description: "Abonnement mensuel Premium",
    is_fixed_amount: true,      // c'est la valeur par défaut, tu peux l'omettre
  }),
});

const { payment_link, payment_id } = await res.json();
// → Redirige le client vers payment_link`} />
            </Section>

            {/* ── 4. Prix libre ── */}
            <Section id="prix-libre" title="Mode Prix Libre (le client choisit)">
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-card">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Wallet className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Le client saisit lui-même le montant</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    La page de paiement affiche un champ où le client entre le montant qu'il souhaite payer.
                    Idéal pour les dons, pourboires, paiements à montant variable.
                  </p>
                </div>
              </div>

              <CodeBlock language="javascript" code={`// Prix libre : le client saisit lui-même le montant sur la page
const res = await fetch("https://pay.ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "XOF",
    description: "Don à l'association",
    is_fixed_amount: false,   // ← le client entre son montant
    // pas besoin de "amount"
  }),
});

const { payment_link, payment_id } = await res.json();
// → Le client arrive sur la page, voit un champ montant et saisit ce qu'il veut payer`} />

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-200">
                    En mode prix libre, le vrai montant payé sera disponible dans la réponse de{" "}
                    <IC>GET /api/v1/hosted-payment/:payment_id</IC> une fois le statut <IC>success</IC>.
                  </p>
                </div>
              </div>
            </Section>

            {/* ── 5. Filtrer les pays ── */}
            <Section id="pays" title="Filtrer les pays affichés">
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-card">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Restreindre les pays disponibles</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Par défaut, tous les pays actifs sur Ashtech Pay sont disponibles sur ta page de paiement.
                    Tu peux restreindre à certains pays en passant leurs codes ISO dans <IC>allowed_countries</IC>.
                  </p>
                </div>
              </div>

              <CodeBlock language="javascript" code={`// Afficher uniquement le Cameroun et le Sénégal
const res = await fetch("https://pay.ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "XAF",
    amount: 10000,
    description: "Achat produit",
    allowed_countries: ["CM", "SN"],   // codes ISO 2 lettres
  }),
});`} />

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Codes pays disponibles</p>
                <div className="rounded-lg border border-zinc-700/50 overflow-hidden text-sm">
                  <table className="w-full">
                    <thead className="bg-zinc-800/60">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Code</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Pays</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Devise</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Opérateurs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "CM", pays: "🇨🇲 Cameroun", devise: "XAF", ops: "MTN, Orange" },
                        { code: "SN", pays: "🇸🇳 Sénégal", devise: "XOF", ops: "Orange, Wave, Free" },
                        { code: "CI", pays: "🇨🇮 Côte d'Ivoire", devise: "XOF", ops: "Orange, MTN, Wave" },
                        { code: "GN", pays: "🇬🇳 Guinée", devise: "GNF", ops: "Orange, MTN" },
                        { code: "CD", pays: "🇨🇩 Congo RDC", devise: "CDF", ops: "Airtel, Orange" },
                        { code: "BF", pays: "🇧🇫 Burkina Faso", devise: "XOF", ops: "Orange, Moov" },
                        { code: "ML", pays: "🇲🇱 Mali", devise: "XOF", ops: "Orange, Moov" },
                        { code: "TG", pays: "🇹🇬 Togo", devise: "XOF", ops: "Flooz, Tmoney" },
                        { code: "BJ", pays: "🇧🇯 Bénin", devise: "XOF", ops: "MTN, Moov" },
                      ].map(({ code, pays, devise, ops }) => (
                        <tr key={code} className="border-t border-zinc-800">
                          <td className="px-3 py-2 font-mono text-xs text-violet-400">{code}</td>
                          <td className="px-3 py-2 text-xs text-zinc-300">{pays}</td>
                          <td className="px-3 py-2 text-xs text-blue-400 font-mono">{devise}</td>
                          <td className="px-3 py-2 text-xs text-zinc-400">{ops}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-zinc-500">
                  Si <IC>allowed_countries</IC> est vide ou absent, tous les pays actifs sur Ashtech Pay sont affichés.
                  Tu peux aussi appeler <IC>GET /api/public/countries</IC> pour la liste complète en temps réel.
                </p>
              </div>
            </Section>

            {/* ── 6. Vérifier le statut ── */}
            <Section id="status" title="Vérifier le statut d'un paiement" badge="GET">
              <p className="text-sm text-muted-foreground">
                Vérifie le statut d'un paiement à partir du <IC>payment_id</IC> reçu lors de la création.
                Le statut est calculé en temps réel à partir des vraies transactions.
              </p>

              <ApiEndpoint method="GET" path="/api/v1/hosted-payment/:payment_id">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Réponse (200)</p>
                  <CodeBlock language="json" code={`{
  "payment_id": "uuid-du-lien",
  "slug": "hp-ab12cd34",
  "is_fixed_amount": true,
  "amount": 5000,
  "currency": "XAF",
  "description": "Abonnement Premium",
  "allowed_countries": ["CM", "SN"],
  "status": "success",
  "paid_at": "2026-03-15T15:12:34.000Z",
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
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Action recommandée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { s: "pending", color: "text-yellow-400", desc: "Lien créé, client pas encore arrivé", action: "Continuer à poller (toutes les 5s)" },
                          { s: "processing", color: "text-blue-400", desc: "Client a initié le paiement", action: "Continuer à poller" },
                          { s: "success", color: "text-green-400", desc: "Paiement confirmé et wallet crédité", action: "✅ Livrer le produit/service" },
                          { s: "failed", color: "text-red-400", desc: "Paiement échoué ou refusé", action: "Notifier le client" },
                          { s: "expired", color: "text-zinc-500", desc: "Lien expiré (30 min sans paiement)", action: "Créer un nouveau lien" },
                        ].map(({ s, color, desc, action }) => (
                          <tr key={s} className="border-t border-zinc-800">
                            <td className={`px-3 py-2.5 font-mono text-xs ${color}`}>{s}</td>
                            <td className="px-3 py-2.5 text-xs text-zinc-400">{desc}</td>
                            <td className="px-3 py-2.5 text-xs text-zinc-300">{action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ApiEndpoint>
            </Section>

            {/* ── 7. Créditement wallet ── */}
            <Section id="credit" title="Créditement automatique du wallet">
              <div className="flex items-start gap-3 p-5 rounded-xl border-2 border-green-500/30 bg-green-500/5">
                <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Wallet className="h-5 w-5 text-green-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-green-300">100% automatique — zéro action requise de ta part</p>
                  <p className="text-sm text-muted-foreground">
                    Dès que le client confirme son paiement (USSD, OTP, Wave…), le système Ashtech Pay traite
                    la transaction et crédite automatiquement ton wallet marchand. Tu n'as rien à faire.
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {[
                      "Le client confirme le paiement sur son téléphone",
                      "Ashtech Pay reçoit la confirmation de l'opérateur Mobile Money",
                      "La transaction est enregistrée comme completed",
                      "Ton wallet est crédité du montant (après déduction des frais)",
                      "Le statut passe à success dans l'API",
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                        <span className="w-4 h-4 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-200">
                    <strong>Bonne pratique</strong> — Ne livre jamais un produit/service avant d'avoir vérifié
                    que le statut est <IC>success</IC> via <IC>GET /api/v1/hosted-payment/:payment_id</IC>.
                    Le statut <IC>processing</IC> signifie que la transaction est en cours mais pas encore confirmée.
                  </p>
                </div>
              </div>
            </Section>

            {/* ── 8. Flux complet ── */}
            <Section id="flow" title="Flux de paiement complet">
              <div className="rounded-xl border bg-card overflow-hidden">
                {[
                  { step: "1", label: "Ton backend → API", desc: "POST /api/v1/hosted-payment/create avec currency, amount (ou is_fixed_amount: false), allowed_countries", color: "bg-blue-500" },
                  { step: "2", label: "API → Ton backend", desc: "Retourne payment_link (/pay/hp-xxx) et payment_id à conserver en base", color: "bg-violet-500" },
                  { step: "3", label: "Ton app → Client", desc: "Tu rediriges ton client vers le payment_link", color: "bg-amber-500" },
                  { step: "4", label: "Client → Page de paiement", desc: "Ashtech Pay affiche la page : sélection pays/opérateur, saisie du téléphone", color: "bg-orange-500" },
                  { step: "5", label: "Client paie", desc: "USSD (Orange/MTN) ou OTP ou redirection Wave — le client confirme", color: "bg-green-500" },
                  { step: "6", label: "Opérateur → Ashtech Pay", desc: "L'opérateur Mobile Money confirme le débit du client", color: "bg-teal-500" },
                  { step: "7", label: "Wallet crédité", desc: "Ton wallet marchand Ashtech Pay est crédité automatiquement", color: "bg-emerald-600" },
                  { step: "8", label: "Ton backend → Vérification", desc: "GET /api/v1/hosted-payment/:payment_id → status = \"success\"", color: "bg-emerald-500" },
                  { step: "9", label: "Tu livres", desc: "Statut confirmed → tu livres le produit ou service", color: "bg-green-400" },
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

            {/* ── 9. Exemples de code ── */}
            <Section id="examples" title="Exemples de code">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Node.js — Prix fixe + filtre pays</p>
                <CodeBlock language="javascript" code={`const HP_KEY = process.env.HP_LIVE_KEY;

async function createPaymentLink(orderId, amount) {
  const res = await fetch("https://pay.ashtechpay.top/api/v1/hosted-payment/create", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${HP_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currency: "XAF",
      amount: amount,
      description: \`Commande #\${orderId}\`,
      is_fixed_amount: true,
      allowed_countries: ["CM"],   // uniquement le Cameroun
    }),
  });

  const data = await res.json();
  if (data.status !== "success") throw new Error("Création du lien échouée");

  // Sauvegarde payment_id en base pour vérifier le statut plus tard
  await db.orders.update({ orderId, paymentId: data.payment_id });

  return data.payment_link;  // URL à envoyer au client
}

// Vérification du statut (depuis ton backend, toutes les 5 secondes)
async function checkPaymentStatus(paymentId) {
  const res = await fetch(
    \`https://pay.ashtechpay.top/api/v1/hosted-payment/\${paymentId}\`,
    { headers: { "Authorization": \`Bearer \${HP_KEY}\` } }
  );
  const data = await res.json();
  return data;
  // data.status = "pending" | "processing" | "success" | "failed" | "expired"
  // data.paid_at = timestamp si success
  // data.amount  = montant réel payé (utile pour is_fixed_amount: false)
}`} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Node.js — Prix libre (le client choisit)</p>
                <CodeBlock language="javascript" code={`const res = await fetch("https://pay.ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "XOF",
    description: "Don à l'association",
    is_fixed_amount: false,   // le client entre son montant
  }),
});

const { payment_link, payment_id } = await res.json();

// Plus tard, vérifier combien le client a payé :
const status = await fetch(
  \`https://pay.ashtechpay.top/api/v1/hosted-payment/\${payment_id}\`,
  { headers: { "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\` } }
).then(r => r.json());

if (status.status === "success") {
  console.log(\`Le client a payé \${status.amount} \${status.currency}\`);
  // → "Le client a payé 2500 XOF"
}`} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PHP</p>
                <CodeBlock language="php" code={`<?php
$hpKey = getenv("HP_LIVE_KEY");

// Créer un lien — prix fixe, Côte d'Ivoire uniquement
$ch = curl_init("https://pay.ashtechpay.top/api/v1/hosted-payment/create");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer $hpKey",
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "currency"         => "XOF",
    "amount"           => 10000,
    "description"      => "Facture #456",
    "is_fixed_amount"  => true,
    "allowed_countries" => ["CI"],
  ]),
]);
$data = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($data["status"] === "success") {
  header("Location: " . $data["payment_link"]);
  exit;
}

// Vérifier le statut
$ch = curl_init("https://pay.ashtechpay.top/api/v1/hosted-payment/" . $data["payment_id"]);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer $hpKey"],
]);
$status = json_decode(curl_exec($ch), true);
if ($status["status"] === "success") {
    // Livrer le produit
}`} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">cURL (test rapide)</p>
                <CodeBlock language="bash" code={`# Prix fixe — Cameroun seulement
curl -X POST https://pay.ashtechpay.top/api/v1/hosted-payment/create \\
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"currency":"XAF","amount":5000,"description":"Test","allowed_countries":["CM"]}'

# Prix libre — tous les pays
curl -X POST https://pay.ashtechpay.top/api/v1/hosted-payment/create \\
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"currency":"XOF","description":"Don","is_fixed_amount":false}'

# Vérifier le statut
curl https://pay.ashtechpay.top/api/v1/hosted-payment/UUID_DU_LIEN \\
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"`} />
              </div>
            </Section>

            {/* Back button */}
            <div className="pt-6 border-t">
              <Link href="/dashboard/api-keys">
                <Button variant="outline" className="gap-2" data-testid="button-back-bottom">
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
