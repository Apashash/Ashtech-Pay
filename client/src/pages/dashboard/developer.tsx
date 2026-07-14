import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Copy, CheckCheck, Terminal, Shield, Webhook,
  CheckCircle2, ArrowRight, Code2, Globe, Zap, BookOpen,
  ChevronRight, Menu, X, List, Download, FlaskConical,
} from "lucide-react";
import { downloadSDKDocs } from "@/lib/pdf-docs";

const SECTIONS = [
  { id: "introduction",   label: "Introduction",         icon: BookOpen },
  { id: "authentication", label: "Authentification",     icon: Shield },
  { id: "countries",      label: "GET /v1/countries",    icon: List },
  { id: "collect",        label: "POST /v1/collect",     icon: Terminal },
  { id: "flows",          label: "Flux de paiement",     icon: Zap },
  { id: "transaction",    label: "GET /v1/transaction",  icon: CheckCircle2 },
  { id: "fees",           label: "GET /v1/fees",         icon: ArrowRight },
  { id: "webhooks",       label: "Webhooks",             icon: Webhook },
  { id: "errors",         label: "Codes d'erreur",       icon: ArrowRight },
  { id: "sandbox",        label: "Sandbox & Tests",      icon: FlaskConical },
];

// All active countries — currencies are standard ISO codes (XOF/XAF/GNF/CDF)
const ALL_COUNTRIES = [
  { code: "BJ", name: "Bénin",              currency: "XOFB", operators: ["Moov Money", "MTN Mobile Money"],                               otpOps: ["Orange Money"] },
  { code: "BF", name: "Burkina Faso",       currency: "XOFF", operators: ["Moov Money", "Orange Money"],                                   otpOps: ["Orange Money"] },
  { code: "CM", name: "Cameroun",           currency: "XAF",  operators: ["MTN Mobile Money", "Orange Money"],                             otpOps: [] },
  { code: "CF", name: "Centrafrique",       currency: "XAF",  operators: ["Orange Money"],                                                  otpOps: ["Orange Money"] },
  { code: "CG", name: "Congo",              currency: "XAFC", operators: ["Airtel Money", "MTN Mobile Money"],                             otpOps: [] },
  { code: "CI", name: "Côte d'Ivoire",      currency: "XOFC", operators: ["Moov Money", "MTN Mobile Money", "Orange Money", "Wave"],       otpOps: ["Orange Money"] },
  { code: "GA", name: "Gabon",              currency: "XAFG", operators: ["Airtel Money", "Moov Money"],                                   otpOps: [] },
  { code: "GN", name: "Guinée Conakry",     currency: "GNF",  operators: ["MTN Mobile Money", "Orange Money"],                            otpOps: [] },
  { code: "GQ", name: "Guinée équatoriale", currency: "XAF",  operators: ["Orange Money"],                                                  otpOps: ["Orange Money"] },
  { code: "GW", name: "Guinée-Bissau",      currency: "XOF",  operators: ["Orange Money"],                                                  otpOps: ["Orange Money"] },
  { code: "ML", name: "Mali",               currency: "XOF",  operators: ["Moov Money", "Orange Money"],                                   otpOps: ["Orange Money"] },
  { code: "NE", name: "Niger",              currency: "XOFN", operators: ["Airtel Money"],                                                  otpOps: [] },
  { code: "CD", name: "RD Congo",           currency: "CDF",  operators: ["Afrimoney", "Airtel Money", "Orange Money", "Vodacom M-Pesa"],  otpOps: ["Orange Money"] },
  { code: "SN", name: "Sénégal",            currency: "XOFS", operators: ["Free Money", "Orange Money", "Wave"],                           otpOps: ["Orange Money"] },
  { code: "TD", name: "Tchad",              currency: "XAF",  operators: ["Airtel Money", "Moov Money"],                                   otpOps: [] },
  { code: "TG", name: "Togo",               currency: "XOFT", operators: ["Flooz (Moov)", "T-Money"],                                      otpOps: [] },
];

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-[#0d1117] w-full min-w-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-[#161b22]">
        <span className="text-xs font-mono text-gray-600">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors shrink-0"
          data-testid="button-copy-code"
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <div className="overflow-x-auto w-full">
        <pre className="p-4 text-sm leading-relaxed w-max min-w-full">
          <code className="text-zinc-300 font-mono whitespace-pre">{code.trim()}</code>
        </pre>
      </div>
    </div>
  );
}

function ParamRow({ name, type, required, desc }: { name: string; type: string; required: boolean; desc: string }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3 font-mono text-blue-600 text-xs whitespace-nowrap">{name}</td>
      <td className="px-3 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{type}</td>
      <td className="px-3 py-3 text-xs whitespace-nowrap">
        {required
          ? <span className="text-green-400 font-medium">Requis</span>
          : <span className="text-gray-500">Optionnel</span>}
      </td>
      <td className="px-3 py-3 text-xs text-gray-700">{desc}</td>
    </tr>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-x-auto w-full">
      <table className="w-full text-sm min-w-[500px]">{children}</table>
    </div>
  );
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="bg-gray-50 border-b border-gray-200">
        {cols.map(h => (
          <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
        ))}
      </tr>
    </thead>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    POST: "bg-green-500/20 text-green-400 border-green-500/30",
    GET:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold font-mono border ${colors[method] ?? ""}`}>
      {method}
    </span>
  );
}

export default function DeveloperPage({ publicMode = false }: { publicMode?: boolean }) {
  const [active, setActive] = useState("introduction");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function handleDownloadPDF() {
    setDownloading(true);
    setTimeout(() => {
      downloadSDKDocs();
      setDownloading(false);
    }, 50);
  }

  const { data } = useQuery<{ apiKey: string }>({ queryKey: ["/api/user/api-key"] });
  const apiKey = data?.apiKey ?? "<VOTRE_CLÉ_API>";

  const displayCountries = ALL_COUNTRIES;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    for (const sec of SECTIONS) {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col overflow-x-hidden">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={publicMode ? "/" : "/dashboard/api-keys"}>
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 -ml-2 gap-1.5 shrink-0" data-testid="link-back-api">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{publicMode ? "Accueil" : "Retour"}</span>
              </Button>
            </Link>
            <div className="h-5 w-px bg-gray-100 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Code2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm text-white truncate">Ashtech Pay</span>
              <Badge variant="outline" className="text-[10px] border-white/20 text-gray-600 hidden sm:flex shrink-0">API v1</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {publicMode ? (
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
            ) : null}
            <Link href="/docs/test-pay">
              <Button
                size="sm"
                className="gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 hover:border-primary/50 text-xs hidden sm:flex"
                data-testid="link-test-api"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Tester l'API
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex gap-1.5 border-white/20 text-gray-700 hover:text-white hover:border-white/40 text-xs"
              data-testid="button-download-pdf-sdk"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{downloading ? "Génération…" : "Télécharger PDF"}</span>
              <span className="sm:hidden">{downloading ? "…" : "PDF"}</span>
            </Button>
            <button
              className="lg:hidden text-gray-600 hover:text-white"
              onClick={() => setSidebarOpen(v => !v)}
              data-testid="button-toggle-mobile-nav"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full min-w-0">
        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? "fixed inset-0 z-30 bg-white pt-14 px-4" : "hidden"}
          lg:relative lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:border-r lg:border-gray-200
          lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto
        `}>
          <nav className="py-6 space-y-1 lg:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3 px-2">Documentation</p>
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                data-testid={`nav-${id}`}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                  active === id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
            <div className="my-4 h-px bg-gray-200" />
            <div className="px-3 py-3 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
              <p className="text-[11px] font-medium text-gray-500">Votre clé API</p>
              <p className="text-xs font-mono text-gray-400 break-all line-clamp-2">{apiKey.slice(0, 24)}…</p>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 w-full px-4 py-10 lg:px-10 xl:px-14 space-y-20 overflow-x-hidden">

          {/* Introduction */}
          <section id="introduction" ref={el => sectionRefs.current.introduction = el} className="scroll-mt-20 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary shrink-0" />
                <h1 className="text-2xl font-semibold text-gray-900">Introduction</h1>
              </div>
              <p className="text-gray-600 leading-relaxed">
                L'<strong className="text-gray-900">Ashtech Pay API</strong> unifie plusieurs passerelles de paiement
                africaines en une seule interface REST. Initiez des paiements Mobile Money dans{" "}
                <strong className="text-gray-900">{displayCountries.length}+ pays africains</strong>{" "}
                sans redirection. Le routage entre les opérateurs est automatique — vous n'avez pas à
                choisir le fournisseur.
              </p>
            </div>

            {/* Try it CTA */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white">Prêt à tester ?</p>
                <p className="text-xs text-gray-600">Envoyez un vrai paiement en quelques secondes depuis notre sandbox interactif.</p>
              </div>
              <Link href="/docs/test-pay">
                <Button size="sm" className="gap-2 shrink-0 whitespace-nowrap" data-testid="cta-test-api">
                  <FlaskConical className="w-3.5 h-3.5" />
                  Tester l'API
                </Button>
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Shield, title: "Sécurisé",           desc: "Authentification par clé API Bearer — côté serveur uniquement" },
                { icon: Globe,  title: `${displayCountries.length}+ pays`, desc: "Toute l'Afrique francophone et au-delà" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <p className="font-semibold text-gray-900 text-sm">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3 overflow-x-hidden">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">URL de base</p>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-base font-mono font-semibold text-blue-600 break-all">https://ashtechpay.top</code>
                <Badge variant="outline" className="border-green-500/30 text-green-600 text-[10px] shrink-0">v1</Badge>
              </div>
              <p className="text-xs text-gray-500">Toutes les requêtes doivent être envoyées en HTTPS. Réponses JSON uniquement.</p>
            </div>
          </section>

          {/* Authentication */}
          <section id="authentication" ref={el => sectionRefs.current.authentication = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
              <Shield className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-gray-900">Authentification</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Toutes les requêtes doivent inclure votre clé API dans l'en-tête HTTP{" "}
              <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">Authorization</code>.
            </p>
            <CodeBlock language="http" code={`Authorization: Bearer ${apiKey}`} />
            <div className="flex gap-3 items-start rounded-xl border border-orange-300 bg-orange-50 p-4">
              <span className="text-orange-500 mt-0.5 shrink-0">⚠</span>
              <p className="text-sm text-orange-800">
                Utilisez votre clé API <strong>uniquement depuis votre serveur</strong> (Node.js, Python, PHP…).
                Ne l'incluez jamais dans du code côté navigateur ou application mobile.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Exemple d'appel authentifié (Node.js)</p>
              <CodeBlock language="javascript" code={`const response = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ /* ... */ })
});`} />
            </div>
          </section>

          {/* Countries */}
          <section id="countries" ref={el => sectionRefs.current.countries = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
              <List className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-gray-900">Pays et opérateurs</h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <MethodBadge method="GET" />
              <code className="text-sm font-mono text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5">
                /v1/countries
              </code>
            </div>

            <p className="text-gray-600 leading-relaxed">
              Retourne la liste complète des pays actifs et leurs opérateurs Mobile Money disponibles.
              Cette liste est <strong className="text-gray-900">gérée par l'administrateur</strong> — tout ajout ou retrait de pays/opérateur
              est immédiatement visible via cet endpoint. Utilisez-le pour peupler dynamiquement votre interface de paiement.
            </p>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Requête</p>
                <CodeBlock language="javascript" code={`fetch("https://ashtechpay.top/v1/countries", {
  headers: {
    "Authorization": "Bearer ${apiKey}"
  }
})`} />
                <CodeBlock language="bash" code={`curl https://ashtechpay.top/v1/countries \\
  -H "Authorization: Bearer ${apiKey}"`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Réponse</p>
                <CodeBlock language="json" code={`[
  {
    "code": "CM",
    "name": "Cameroun",
    "currency": "XAF",
    "operators": ["MTN Mobile Money", "Orange Money"]
  },
  {
    "code": "SN",
    "name": "Sénégal",
    "currency": "XOF",
    "operators": ["Free Money", "Orange Money", "Wave"]
  }
  // ...
]`} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                Pays disponibles ({displayCountries.length}) — mis à jour par l'administrateur en temps réel
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayCountries.map(({ code, name, currency, operators, otpOps }) => (
                  <div key={code} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-800">{name}</p>
                      <span className="text-[10px] font-mono text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded shrink-0">{code} · {currency}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {operators.map(op => {
                        const needsOtp = otpOps.includes(op);
                        const isWave = op === "Wave";
                        return (
                          <span
                            key={op}
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              isWave ? "bg-purple-50 text-purple-700 border-purple-200" :
                              needsOtp ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-white text-gray-600 border-gray-200"
                            }`}
                          >
                            {op}{needsOtp && !isWave ? " ⚡" : ""}{isWave ? " 🔗" : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-1">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-200 inline-block" /> USSD Push — pas d'OTP</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-200 inline-block" /> ⚡ OTP requis (code USSD à composer)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-200 inline-block" /> 🔗 Wave — lien de paiement</span>
              </div>
            </div>
          </section>

          {/* Collect */}
          <section id="collect" ref={el => sectionRefs.current.collect = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
              <Terminal className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-gray-900">Initier un paiement</h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <MethodBadge method="POST" />
              <code className="text-sm font-mono text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5">
                /v1/collect
              </code>
            </div>

            <p className="text-gray-600 leading-relaxed">
              Initie un paiement Mobile Money via l'Ashtech Pay API. Le routage entre fournisseurs est
              automatique selon le pays et l'opérateur. Le client reçoit une demande de validation sur son
              téléphone (USSD, OTP ou Wave selon l'opérateur). Les frais sont configurés par l'administrateur
              et déduits automatiquement — le{" "}
              <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">credited_amount</code>{" "}
              correspond au montant net crédité sur votre compte. Consultez{" "}
              <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">GET /v1/fees</code>{" "}
              pour les frais actuels.
            </p>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Corps de la requête (JSON)</p>
              <TableWrapper>
                <TableHead cols={["Paramètre", "Type", "Statut", "Description"]} />
                <tbody>
                  <ParamRow name="amount"       type="number" required desc="Montant brut à collecter" />
                  <ParamRow name="currency"     type="string" required desc="Devise du pays (XAF, XOF, GNF, CDF…)" />
                  <ParamRow name="phone"        type="string" required desc="Numéro de téléphone du payeur" />
                  <ParamRow name="operator"     type="string" required desc="Nom exact de l'opérateur (depuis /v1/countries)" />
                  <ParamRow name="country_code" type="string" required desc="Code ISO du pays (CM, SN, CI…)" />
                  <ParamRow name="reference"    type="string" required={false} desc="Référence unique de votre commande. Obligatoire lors du retry OTP : renvoyer la valeur reçue dans la réponse 400." />
                  <ParamRow name="otp"          type="string" required={false} desc="Code OTP reçu par SMS. Doit toujours être accompagné du champ reference (valeur reçue dans le 400 otp_required)." />
                  <ParamRow name="notify_url"   type="string" required={false} desc="URL webhook pour recevoir le résultat du paiement" />
                </tbody>
              </TableWrapper>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Requête</p>
                <CodeBlock language="javascript" code={`fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XAF",
    phone: "670000000",
    operator: "MTN Mobile Money",
    country_code: "CM",
    reference: "ORDER-001",
    notify_url: "https://monsite.com/webhook"
  })
})`} />
                <CodeBlock language="bash" code={`curl https://ashtechpay.top/v1/collect \\
  -X POST \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "currency": "XAF",
    "phone": "670000000",
    "operator": "MTN Mobile Money",
    "country_code": "CM",
    "reference": "ORDER-001",
    "notify_url": "https://monsite.com/webhook"
  }'`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Réponse (202)</p>
                <CodeBlock language="json" code={`{
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-001",
  "status": "pending",
  "amount": 5000,
  "credited_amount": 4750,
  "fee_amount": 250,
  "currency": "XAF",
  "operator": "MTN Mobile Money",
  "phone": "670000000",
  "country_code": "CM",
  "created_at": "2026-03-15T14:00:00Z"
}`} />
              </div>
            </div>

            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-3">
              <p className="text-sm font-semibold text-yellow-300">OTP requis — deux variantes selon l'opérateur</p>
              <p className="text-sm text-gray-600">
                Certains opérateurs nécessitent un code OTP. L'API retourne{" "}
                <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">400 otp_required</code>{" "}
                avec un champ <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">reference</code>{" "}
                et un champ <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">ussd_code</code>.
                Il existe deux variantes :{" "}
                <strong className="text-orange-300">OTP USSD</strong>{" "}
                (Orange CI, SN, BF — le client compose le code USSD affiché, l'OTP s'affiche dans le menu téléphonique,{" "}
                <em>aucun SMS n'est envoyé</em>) et{" "}
                <strong className="text-yellow-300">OTP SMS</strong>{" "}
                (LigdiCash BF uniquement — SMS déclenché automatiquement,{" "}
                <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">ussd_code</code>{" "}
                est <code className="text-red-400">null</code>).
                Dans les deux cas, relancez la requête avec{" "}
                <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">otp</code>{" "}
                <strong>et</strong>{" "}
                <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">reference</code>{" "}
                (valeur reçue dans le 400).
              </p>
              <CodeBlock language="json" code={`// Étape 1 — Requête initiale (sans otp) → réponse 400
{
  "error": "otp_required",
  "reference": "DEP-A1B2C3D4",    // ← à conserver absolument !
  "ussd_code": "#144*391#",        // OTP USSD → CI: "#144*82#", SN: "#144*391#", BF: "*144*4*6*5000#"
  // "ussd_code": null             // OTP SMS  → LigdiCash BF uniquement (SMS envoyé automatiquement)
  "message": "OTP requis. Composez #144*391# sur votre téléphone pour obtenir votre code…"
}

// Étape 2 — Retry avec otp + reference (identique pour OTP USSD et OTP SMS)
{
  "amount": 5000, "currency": "XOF", "phone": "77XXXXXXX",
  "operator": "Orange Money", "country_code": "SN",
  "otp": "123456",                 // ← code du menu USSD (ou SMS pour LigdiCash)
  "reference": "DEP-A1B2C3D4",    // ← obligatoire, même valeur que la réponse 400
  "notify_url": "https://monsite.com/webhook"
}
// → 202 pending → webhook payment.completed`} />
              <CodeBlock language="bash" code={`# Étape 1 — sans OTP (Orange Money SN — flux OTP USSD)
curl https://ashtechpay.top/v1/collect \\
  -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":5000,"currency":"XOF","phone":"77XXXXXXX",
       "operator":"Orange Money","country_code":"SN",
       "notify_url":"https://monsite.com/webhook"}'

# → 400 : {"error":"otp_required","reference":"DEP-A1B2C3D4","ussd_code":"#144*391#",...}
# Afficher le ussd_code au client → il compose → l'OTP s'affiche dans le menu USSD

# Étape 2 — avec OTP + reference (OBLIGATOIRE)
curl https://ashtechpay.top/v1/collect \\
  -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":5000,"currency":"XOF","phone":"77XXXXXXX",
       "operator":"Orange Money","country_code":"SN",
       "otp":"123456","reference":"DEP-A1B2C3D4",
       "notify_url":"https://monsite.com/webhook"}'

# → 202 pending`} />
            </div>
          </section>

          {/* Payment flows */}
          <section id="flows" ref={el => sectionRefs.current.flows = el} className="scroll-mt-20 space-y-8">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
              <Zap className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-gray-900">Flux de paiement</h2>
            </div>

            <p className="text-gray-600 leading-relaxed">
              Selon le pays et l'opérateur, l'API utilise automatiquement l'un des 4 flux ci-dessous.
              Votre code doit gérer chacun différemment car la réponse et les étapes varient.
            </p>

            {/* Flow overview table */}
            <TableWrapper>
              <TableHead cols={["Flux", "Opérateurs concernés", "Réponse initiale", "Action requise"]} />
              <tbody>
                <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap"><span className="text-blue-400 font-semibold text-sm">USSD Push</span></td>
                  <td className="px-3 py-3 text-gray-700 text-sm">MTN, Moov, Airtel, Orange CM, Free SN, T-Money, Flooz, M-Pesa, Afrimoney…</td>
                  <td className="px-3 py-3 font-mono text-green-400 text-xs whitespace-nowrap">202 pending</td>
                  <td className="px-3 py-3 text-gray-700 text-sm">Attendre le webhook. Le client valide directement sur son téléphone.</td>
                </tr>
                <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap"><span className="text-orange-400 font-semibold text-sm">OTP USSD</span></td>
                  <td className="px-3 py-3 text-gray-700 text-sm">Orange Money CI (#144*82#), SN (#144*391#), BF (*144*4*6*montant#)</td>
                  <td className="px-3 py-3 font-mono text-orange-400 text-xs whitespace-nowrap">400 otp_required<br/><span className="text-zinc-500">ussd_code: "#144*82#"</span></td>
                  <td className="px-3 py-3 text-gray-700 text-sm">Afficher le <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">ussd_code</code> au client — il compose, l'OTP s'affiche dans le menu USSD. Relancer avec <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">otp</code> + <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">reference</code>. Aucun SMS n'est envoyé.</td>
                </tr>
                <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap"><span className="text-yellow-400 font-semibold text-sm">OTP SMS</span></td>
                  <td className="px-3 py-3 text-gray-700 text-sm">LigdiCash BF (wallet) — SMS envoyé automatiquement</td>
                  <td className="px-3 py-3 font-mono text-orange-400 text-xs whitespace-nowrap">400 otp_required<br/><span className="text-zinc-500">ussd_code: null</span></td>
                  <td className="px-3 py-3 text-gray-700 text-sm">SMS OTP envoyé automatiquement par le serveur (LigdiCash BF uniquement). Relancer avec <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">otp</code> + <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">reference</code>.</td>
                </tr>
                <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap"><span className="text-purple-400 font-semibold text-sm">Wave</span></td>
                  <td className="px-3 py-3 text-gray-700 text-sm">Wave (CI), Wave (SN)</td>
                  <td className="px-3 py-3 font-mono text-purple-400 text-xs whitespace-nowrap">202 pending<br/><span className="text-zinc-500">flow: "wave", wave_url: "..."</span></td>
                  <td className="px-3 py-3 text-gray-700 text-sm">Afficher le <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">wave_url</code> en bouton ou QR code. Le client ouvre Wave pour confirmer.</td>
                </tr>
              </tbody>
            </TableWrapper>

            {/* Flow 1: USSD Push */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">1</span>
                <h3 className="font-semibold text-blue-300">Flux USSD Push — La majorité des opérateurs</h3>
              </div>
              <p className="text-sm text-gray-600">
                Flux le plus simple. Le client reçoit une demande USSD sur son téléphone et valide en composant son PIN.
                Vous recevez la confirmation par webhook.{" "}
                <strong className="text-zinc-200">Pas d'OTP à gérer côté merchant.</strong>
              </p>
              <div className="text-xs text-gray-500">
                <strong className="text-zinc-400">Exemples d'opérateurs :</strong>{" "}
                MTN (CM, BJ, CG, GN, CD), Moov (BJ, CI, BF, GA, ML, TG), Airtel (CG, GA, NE, CD, TD),
                Orange (CM), Free Money (SN), T-Money (TG), Flooz (TG), Vodacom M-Pesa (CD), Afrimoney (CD)
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium">Requête</p>
                  <CodeBlock language="javascript" code={`// Orange Money Cameroun — flux USSD push
const res = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XAF",
    phone: "699000000",
    operator: "Orange Money",
    country_code: "CM",
    notify_url: "https://monsite.com/webhook"
  })
});

const data = await res.json();
// data.status === "pending"
// → Attendre le webhook payment.completed / payment.failed`} />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium">Réponse 202</p>
                  <CodeBlock language="json" code={`{
  "transaction_id": "abc-123",
  "status": "pending",
  "amount": 5000,
  "credited_amount": 4750,
  "fee_amount": 250,
  "currency": "XAF"
}

// Le client reçoit la demande USSD
// sur son téléphone → valide avec PIN
// Webhook envoyé à notify_url`} />
                </div>
              </div>
            </div>

            {/* Flow 2: OTP USSD */}
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white shrink-0">2</span>
                <h3 className="font-semibold text-orange-300">Flux OTP USSD — Orange Money CI, SN, BF, ML</h3>
              </div>
              <p className="text-sm text-gray-600">
                Pour Orange Money en Côte d'Ivoire, Sénégal, Burkina Faso et Mali. L'API retourne un{" "}
                <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">ussd_code</code>{" "}
                que le client compose depuis son téléphone — l'OTP s'affiche directement dans le menu USSD (pas de SMS envoyé).{" "}
                <strong className="text-zinc-300">Important :</strong> le serveur ne déclenche aucun SMS — il retourne simplement le code à composer.
              </p>
              <div className="text-xs text-gray-500 space-y-0.5">
                <strong className="text-zinc-400">Codes USSD par pays :</strong>
                <div>CI — <code className="text-orange-300 bg-gray-100 px-1 py-0.5 rounded font-mono">#144*82#</code> &nbsp;|&nbsp; SN — <code className="text-orange-300 bg-gray-100 px-1 py-0.5 rounded font-mono">#144*391#</code> &nbsp;|&nbsp; BF — <code className="text-orange-300 bg-gray-100 px-1 py-0.5 rounded font-mono">*144*4*6*montant#</code></div>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium">Étape 1 — Requête initiale (sans OTP)</p>
                  <CodeBlock language="javascript" code={`// Orange Money CI — étape 1 : sans OTP
const res = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 1000,
    currency: "XOF",
    phone: "0700000000",
    operator: "Orange Money",
    country_code: "CI",
    notify_url: "https://monsite.com/webhook"
  })
});
// → 400 otp_required
// ussd_code contient le code à composer`} />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium">Réponse 400 + Étape 2 — Avec OTP</p>
                  <CodeBlock language="json" code={`// Réponse 400 — CI (même structure pour SN, BF, ML) :
{
  "error": "otp_required",
  "message": "OTP requis. Composez #144*82# sur votre téléphone pour obtenir votre code...",
  "reference": "DEP-A1B2C3D4",  // ← stocker !
  "ussd_code": "#144*82#"        // CI  |  SN: "#144*391#"  |  BF: "*144*4*6*montant#"
}

// Afficher le ussd_code au client :
// "Composez #144*82# sur votre téléphone, puis saisissez l'OTP affiché"`} />
                  <CodeBlock language="javascript" code={`// Étape 2 : même requête + otp + reference
body: JSON.stringify({
  amount: 1000, currency: "XOF",
  phone: "0700000000",
  operator: "Orange Money",
  country_code: "CI",
  otp: "123456",              // ← OTP affiché dans le menu USSD
  reference: "DEP-A1B2C3D4", // ← référence du 400 (obligatoire)
  notify_url: "https://monsite.com/webhook"
})
// → 202 pending → webhook`} />
                </div>
              </div>
            </div>

            {/* Flow 3: OTP SMS (wallet) */}
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-white shrink-0">3</span>
                <h3 className="font-semibold text-yellow-300">Flux OTP SMS — LigdiCash BF (Wallet)</h3>
              </div>
              <p className="text-sm text-gray-600">
                Pour LigdiCash (Burkina Faso). L'API déclenche automatiquement l'envoi d'un SMS OTP
                au numéro du client — <strong className="text-zinc-200">aucun code USSD à composer.</strong>{" "}
                Le champ <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">ussd_code</code> est <code className="text-red-400">null</code>.
              </p>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium">Étape 1 — Requête initiale (sans OTP)</p>
                  <CodeBlock language="javascript" code={`// LigdiCash Burkina Faso — étape 1
const res = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XOF",
    phone: "04000000",
    operator: "LigdiCash",
    country_code: "BF",
    notify_url: "https://monsite.com/webhook"
  })
});
// → 400 otp_required
// ussd_code est null — SMS envoyé automatiquement`} />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium">Réponse 400 + Étape 2</p>
                  <CodeBlock language="json" code={`// Réponse 400 :
{
  "error": "otp_required",
  "message": "OTP requis. Un code a été envoyé par SMS.",
  "reference": "DEP-X9Y8Z7W6",  // ← stocker !
  "ussd_code": null
}

// Le client reçoit son OTP par SMS
// Étape 2 : relancer avec otp + reference`} />
                  <CodeBlock language="javascript" code={`// Étape 2 : même requête + otp + reference
body: JSON.stringify({
  amount: 5000, currency: "XOF",
  phone: "04000000",
  operator: "LigdiCash",
  country_code: "BF",
  otp: "456789",              // ← OTP reçu par SMS
  reference: "DEP-X9Y8Z7W6", // ← référence du 400 (obligatoire)
  notify_url: "https://monsite.com/webhook"
})
// → 202 pending → webhook`} />
                </div>
              </div>
            </div>

            {/* Flow 4: Wave */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white shrink-0">4</span>
                <h3 className="font-semibold text-purple-300">Flux Wave — Côte d'Ivoire et Sénégal</h3>
              </div>
              <p className="text-sm text-gray-600">
                Pour Wave CI et Wave SN. L'API retourne directement un <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">wave_url</code> dans la réponse 202.
                Votre interface doit afficher ce lien (bouton ou QR code) pour que le client l'ouvre dans son
                application Wave. <strong className="text-zinc-200">Pas d'OTP.</strong>{" "}
                Le numéro de téléphone n'est pas requis pour Wave.
              </p>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium">Requête</p>
                  <CodeBlock language="javascript" code={`// Wave Côte d'Ivoire
const res = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 2000,
    currency: "XOF",
    phone: "0700000000",  // facultatif pour Wave
    operator: "Wave",
    country_code: "CI",
    notify_url: "https://monsite.com/webhook"
  })
});

const data = await res.json();
if (data.flow === "wave") {
  // Afficher data.wave_url au client
  window.open(data.wave_url, "_blank");
}`} />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium">Réponse 202</p>
                  <CodeBlock language="json" code={`{
  "transaction_id": "xyz-789",
  "status": "pending",
  "amount": 2000,
  "credited_amount": 1910,
  "fee_amount": 90,
  "currency": "XOF",
  "operator": "Wave",
  "country_code": "CI",
  "flow": "wave",
  "wave_url": "https://pay.wave.com/m/..."
}

// → Afficher wave_url comme bouton
// "Payer avec Wave"
// → Le client ouvre l'app Wave et confirme
// → Webhook payment.completed envoyé`} />
                </div>
              </div>
            </div>

            {/* Summary: how to detect flow in code */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Comment détecter le bon flux dans votre code</p>
              <CodeBlock language="javascript" code={`async function collectPayment(params) {
  const res = await fetch("https://ashtechpay.top/v1/collect", {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params)
  });

  const data = await res.json();

  if (res.status === 202 && data.flow === "wave") {
    // ─── Flux Wave : afficher le lien de paiement ─────────────
    return { type: "wave", waveUrl: data.wave_url, transactionId: data.transaction_id };
  }

  if (res.status === 202) {
    // ─── Flux USSD Push : attendre le webhook ──────────────────
    return { type: "ussd_push", transactionId: data.transaction_id };
  }

  if (res.status === 400 && data.error === "otp_required") {
    // Toujours stocker data.reference — OBLIGATOIRE pour le retry OTP
    if (data.ussd_code) {
      // ─── Flux OTP USSD : code USSD à composer (ex: #144*82# CI, #144*391# SN, *144*4*6*montant# BF)
      // Orange Money CI, SN, BF, ML — le client compose le USSD, l'OTP s'affiche dans le menu (pas de SMS)
      return { type: "otp_ussd", ussdCode: data.ussd_code, reference: data.reference };
    } else {
      // ─── Flux OTP SMS : SMS envoyé automatiquement, pas de USSD à composer ────
      // LigdiCash BF — ussd_code est null
      return { type: "otp_sms", reference: data.reference };
    }
  }

  throw new Error(data.message);
}`} />
            </div>
          </section>

          {/* Transaction status */}
          <section id="transaction" ref={el => sectionRefs.current.transaction = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-gray-900">Statut d'une transaction</h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <MethodBadge method="GET" />
              <code className="text-sm font-mono text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5">
                /v1/transaction/:id
              </code>
            </div>

            <p className="text-gray-600 leading-relaxed">
              Consultez le statut d'une transaction à tout moment via le{" "}
              <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">transaction_id</code>{" "}
              retourné lors de l'initiation. Vous pouvez également utiliser ce endpoint en complément du webhook.
            </p>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Requête</p>
                <CodeBlock language="javascript" code={`fetch(
  "https://ashtechpay.top/v1/transaction/8f3e1c2d-...",
  {
    headers: {
      "Authorization": "Bearer ${apiKey}"
    }
  }
)`} />
                <CodeBlock language="bash" code={`curl https://ashtechpay.top/v1/transaction/8f3e1c2d-... \\
  -H "Authorization: Bearer ${apiKey}"`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Réponse</p>
                <CodeBlock language="json" code={`{
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-001",
  "status": "success",
  "amount": 5000,
  "credited_amount": 4750,
  "fee_amount": 250,
  "currency": "XAF",
  "phone": "670000000",
  "created_at": "2026-03-15T14:00:00Z",
  "confirmed_at": "2026-03-15T14:02:17Z"
}`} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Statuts possibles</p>
              <TableWrapper>
                <TableHead cols={["Statut", "Description", "Final ?"]} />
                <tbody>
                  {[
                    { status: "pending", color: "text-yellow-400", desc: "En attente de confirmation de l'opérateur", final: false },
                    { status: "success", color: "text-green-400",  desc: "Paiement confirmé — compte marchand crédité", final: true  },
                    { status: "failed",  color: "text-red-400",    desc: "Paiement refusé, expiré ou annulé",           final: true  },
                  ].map(({ status, color, desc, final }) => (
                    <tr key={status} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap"><span className={`font-mono font-medium text-sm ${color}`}>{status}</span></td>
                      <td className="px-3 py-3 text-gray-700 text-sm">{desc}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm">{final ? <span className="text-green-400">Oui</span> : <span className="text-zinc-500">Non</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </div>
          </section>

          {/* Fees */}
          <section id="fees" ref={el => sectionRefs.current.fees = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
              <ArrowRight className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-gray-900">Grille tarifaire en temps réel</h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <MethodBadge method="GET" />
              <code className="text-sm font-mono text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5">
                /v1/fees
              </code>
            </div>

            <p className="text-gray-600 leading-relaxed">
              Retourne la grille tarifaire en vigueur pour chaque pays actif.
            </p>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Requête</p>
                <CodeBlock language="javascript" code={`fetch("https://ashtechpay.top/v1/fees", {
  headers: {
    "Authorization": "Bearer ${apiKey}"
  }
})`} />
                <CodeBlock language="bash" code={`curl https://ashtechpay.top/v1/fees \\
  -H "Authorization: Bearer ${apiKey}"`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Réponse</p>
                <CodeBlock language="json" code={`[
  {
    "country_code": "CM",
    "country_name": "Cameroun",
    "currency": "XAF",
    "total_fee_pct": 5.5,
    "ashtech_margin_pct": 2.0,
    "operators": ["MTN Mobile Money", "Orange Money"]
  },
  {
    "country_code": "SN",
    "country_name": "Sénégal",
    "currency": "XOF",
    "total_fee_pct": 5.0,
    "ashtech_margin_pct": 2.0,
    "operators": ["Free Money", "Orange Money", "Wave"]
  }
  // ...un objet par pays actif
]`} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Champs de la réponse</p>
              <TableWrapper>
                <TableHead cols={["Champ", "Type", "Description"]} />
                <tbody>
                  {[
                    { name: "country_code",      type: "string",   desc: "Code ISO du pays (CM, SN, CI…)" },
                    { name: "country_name",      type: "string",   desc: "Nom complet du pays" },
                    { name: "currency",          type: "string",   desc: "Devise principale (XAF, XOF, GNF, CDF…)" },
                    { name: "total_fee_pct",     type: "number",   desc: "Frais totaux en % appliqués au montant (ex: 5.5 = 5,5%)" },
                    { name: "ashtech_margin_pct",type: "number",   desc: "Part Ashtech Pay dans les frais totaux" },
                    { name: "operators",         type: "string[]", desc: "Opérateurs disponibles pour ce pays" },
                  ].map(({ name, type, desc }) => (
                    <tr key={name} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 font-mono text-blue-600 text-xs whitespace-nowrap">{name}</td>
                      <td className="px-3 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{type}</td>
                      <td className="px-3 py-3 text-xs text-gray-700">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Exemple — calculer le montant net avant d'appeler /v1/collect</p>
              <CodeBlock language="javascript" code={`// Récupérer les frais en cache (une fois au démarrage ou toutes les heures)
const fees = await fetch("https://ashtechpay.top/v1/fees", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
}).then(r => r.json());

// Trouver les frais pour le pays du client
function getFeeForCountry(countryCode) {
  return fees.find(f => f.country_code === countryCode);
}

// Calculer le montant net crédité sur votre compte
function computeNet(grossAmount, countryCode) {
  const fee = getFeeForCountry(countryCode);
  if (!fee) return grossAmount;
  const feeAmount = Math.round(grossAmount * fee.total_fee_pct / 100);
  return {
    gross: grossAmount,
    fee: feeAmount,
    net: grossAmount - feeAmount,         // montant crédité sur votre wallet
    fee_pct: fee.total_fee_pct,
  };
}

// Exemple :
console.log(computeNet(10000, "CM"));
// → { gross: 10000, fee: 550, net: 9450, fee_pct: 5.5 }`} />
            </div>
          </section>

          {/* Webhooks */}
          <section id="webhooks" ref={el => sectionRefs.current.webhooks = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
              <Webhook className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-gray-900">Webhooks</h2>
            </div>

            <p className="text-gray-600 leading-relaxed">
              Quand une transaction atteint un état final, Ashtech Pay envoie automatiquement une requête{" "}
              <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">POST</code>{" "}
              à la <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">notify_url</code>{" "}
              que vous avez passée dans votre appel à <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">/v1/collect</code>.
              Le champ <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">amount</code> correspond au montant net après frais,
              et <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">total_amount</code> au montant brut collecté.
            </p>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Payload — paiement réussi</p>
                <CodeBlock language="json" code={`{
  "event": "payment.completed",
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-001",
  "status": "completed",
  "amount": 4750,
  "total_amount": 5000,
  "currency": "XAF",
  "type": "deposit",
  "phone": "670000000",
  "timestamp": "2026-03-15T14:02:17.000Z"
}`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Payload — paiement échoué</p>
                <CodeBlock language="json" code={`{
  "event": "payment.failed",
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-001",
  "status": "failed",
  "amount": 5000,
  "total_amount": 5000,
  "currency": "XAF",
  "type": "deposit",
  "phone": "670000000",
  "timestamp": "2026-03-15T14:03:55.000Z"
}`} />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Événements disponibles</p>
              <div className="rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Événement</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Déclencheur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { event: "payment.completed", desc: "Paiement (dépôt) confirmé avec succès" },
                      { event: "payment.failed",    desc: "Paiement refusé, expiré ou annulé" },
                      { event: "payout.completed",  desc: "Retrait ou virement sortant confirmé" },
                      { event: "payout.failed",     desc: "Retrait ou virement échoué" },
                    ].map(({ event, desc }) => (
                      <tr key={event} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 font-mono text-blue-600 text-xs whitespace-nowrap">{event}</td>
                        <td className="px-3 py-3 text-gray-700 text-sm">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Handler (Node.js / Express)</p>
              <CodeBlock language="javascript" code={`app.post("/webhook", express.json(), async (req, res) => {
  // Toujours répondre 200 en premier
  res.status(200).json({ received: true });

  const { event, transaction_id, reference, amount, currency } = req.body;

  if (event === "payment.completed") {
    // Créditer le client dans votre base
    // amount = montant net (après frais)
    await markOrderAsPaid(reference, { transactionId: transaction_id, amount, currency });
  }

  if (event === "payment.failed") {
    await cancelOrder(reference);
  }

  if (event === "payout.completed") {
    await markPayoutDone(reference, { transactionId: transaction_id });
  }

  if (event === "payout.failed") {
    await markPayoutFailed(reference);
  }
});`} />
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-2">
              <p className="text-sm font-semibold text-blue-300">Bonnes pratiques</p>
              <ul className="space-y-1.5 text-sm text-gray-600">
                {[
                  "Répondez toujours HTTP 200 immédiatement pour accuser réception",
                  "Traitez la logique métier après avoir répondu 200 (asynchrone)",
                  "Vérifiez le transaction_id dans votre base pour éviter les doublons",
                  "Le webhook est complémentaire à GET /v1/transaction/:id — utilisez les deux",
                  "Votre notify_url doit être une URL HTTPS publique (pas localhost)",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-blue-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Errors */}
          <section id="errors" ref={el => sectionRefs.current.errors = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
              <ArrowRight className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-gray-900">Codes d'erreur</h2>
            </div>

            <p className="text-gray-600 leading-relaxed">
              En cas d'erreur, l'API retourne un objet JSON avec les champs{" "}
              <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">error</code> et{" "}
              <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">message</code>.
            </p>

            <CodeBlock language="json" code={`{
  "error": "bad_request",
  "message": "Champs requis : amount, currency, phone, operator, country_code"
}`} />

            <TableWrapper>
              <TableHead cols={["Code HTTP", "Erreur", "Signification"]} />
              <tbody>
                {[
                  { code: "400", error: "bad_request",        msg: "Paramètre manquant ou format invalide" },
                  { code: "400", error: "otp_required",       msg: "OTP requis — conservez le champ reference de cette réponse, il est obligatoire pour la confirmation" },
                  { code: "400", error: "missing_reference",  msg: "Confirmation OTP sans le champ reference — utilisez la valeur reçue dans la réponse otp_required" },
                  { code: "400", error: "otp_expired",        msg: "Session OTP expirée (15 min) ou introuvable — relancez sans otp pour initier une nouvelle session" },
                  { code: "401", error: "unauthorized",       msg: "Clé API manquante, invalide ou révoquée" },
                  { code: "403", error: "forbidden",     msg: "Cette transaction n'appartient pas à votre compte" },
                  { code: "404", error: "not_found",     msg: "Transaction introuvable" },
                  { code: "422", error: "unprocessable", msg: "Pays ou opérateur non supporté / devise incorrecte" },
                  { code: "429", error: "rate_limited",  msg: "Trop de requêtes — ralentissez" },
                  { code: "502", error: "gateway_error", msg: "Le réseau de l'opérateur a rejeté le paiement" },
                  { code: "500", error: "server_error",  msg: "Erreur interne — réessayez" },
                ].map(({ code, error, msg }) => (
                  <tr key={`${code}-${error}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 font-mono font-bold text-orange-400 whitespace-nowrap">{code}</td>
                    <td className="px-3 py-3 font-mono text-gray-600 text-xs whitespace-nowrap">{error}</td>
                    <td className="px-3 py-3 text-gray-700 text-sm">{msg}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
              Pour toute question technique non résolue par cette documentation, contactez notre équipe via{" "}
              <Link href="/dashboard/support" className="text-primary hover:underline">le support</Link>.
            </div>
          </section>

          {/* Sandbox & Tests */}
          <section id="sandbox" ref={el => sectionRefs.current.sandbox = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
              <FlaskConical className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-gray-900">Sandbox &amp; Tests</h2>
            </div>

            <p className="text-gray-600 leading-relaxed">
              En sandbox, votre clé API pointe vers l'environnement de test AfribaPay.
              Les paiements ne sont pas réels. Utilisez les numéros et codes OTP ci-dessous pour simuler chaque scénario.
              La logique de gestion des flux (OTP USSD, OTP SMS, Wave, USSD Push) est identique en production.
            </p>

            {/* Supported countries note */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-300">Pays confirmés dans le système AfribaPay</p>
              <p className="text-sm text-gray-600">
                Les pays suivants sont officiellement listés dans l'API AfribaPay :{" "}
                <strong className="text-zinc-200">BF, BJ, CD, CI, CM, GA, GN, ML, NE, SN, TG</strong>.
                Les autres pays de votre compte (CF, CG, GQ, GW, TD…) passent par une passerelle différente (PixPay).
                Si un opérateur de ces pays est configuré sur AfribaPay, les requêtes échoueront avec <code className="text-orange-300 font-mono text-xs">502 gateway_error</code>.
                Contactez le support pour les reconfigurer.
              </p>
            </div>

            {/* Test numbers by country */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Numéros de test officiels AfribaPay — sandbox uniquement
              </p>
              <p className="text-xs text-gray-500 -mt-1">
                Envoyez ces numéros <strong>avec le préfixe pays</strong> dans le champ <code className="font-mono">phone</code> de <code className="font-mono">/v1/collect</code>.
                Le serveur retire automatiquement le préfixe avant de transmettre à AfribaPay.
                Le résultat dépend du numéro choisi (SUCCESS / PENDING / FAILED).
              </p>
              <div className="rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Pays</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Devise</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Numéro → SUCCESS</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Numéro → PENDING</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Numéro → FAILED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { country: "CI", name: "Côte d'Ivoire", cur: "XOF", ok: "2252100000001", pend: "2252100000002", fail: "2252100000003" },
                      { country: "CM", name: "Cameroun",       cur: "XAF", ok: "237660000001",  pend: "237660000002",  fail: "237660000003"  },
                      { country: "SN", name: "Sénégal",        cur: "XOF", ok: "221700000001",  pend: "221700000002",  fail: "221700000003"  },
                      { country: "BF", name: "Burkina Faso",   cur: "XOF", ok: "22660000001",   pend: "22660000002",   fail: "22660000003"   },
                      { country: "GN", name: "Guinée Conakry", cur: "GNF", ok: "224600000001",  pend: "224600000002",  fail: "224600000003"  },
                      { country: "CD", name: "RD Congo",       cur: "CDF", ok: "243120000011",  pend: "243120000012",  fail: "243120000013"  },
                      { country: "CD", name: "RD Congo",       cur: "USD", ok: "243120000001",  pend: "243120000002",  fail: "243120000003"  },
                    ].map(({ country, name, cur, ok, pend, fail }, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">{country} — {name}</td>
                        <td className="px-3 py-3 font-mono text-xs text-gray-500">{cur}</td>
                        <td className="px-3 py-3 font-mono text-green-600 text-xs whitespace-nowrap">{ok}</td>
                        <td className="px-3 py-3 font-mono text-yellow-600 text-xs whitespace-nowrap">{pend}</td>
                        <td className="px-3 py-3 font-mono text-red-500 text-xs whitespace-nowrap">{fail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">
                ⚠️ BJ, GA, ML, NE, TG n'ont pas de numéros de test publiés par AfribaPay — utilisez des numéros fictifs commençant par le préfixe pays.
              </p>
            </div>

            {/* OTP test codes */}
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5 space-y-3">
              <p className="text-sm font-semibold text-orange-300">Codes OTP de test (sandbox AfribaPay)</p>
              <p className="text-sm text-gray-600">
                En sandbox, tout code OTP à 6 chiffres entre{" "}
                <strong className="text-zinc-200">333334 et 999999</strong> est accepté comme valide.
                Les codes <strong className="text-red-400">000000 à 333333</strong> simulent un OTP invalide/refusé.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <CodeBlock language="json" code={`// ✅ OTP valide sandbox (333334–999999)
{ "otp": "500000" }   // → succès garanti

// ❌ OTP invalide sandbox (000000–333333)
{ "otp": "111111" }   // → échec simulé
{ "otp": "000000" }   // → échec simulé`} />
                <CodeBlock language="javascript" code={`// Exemple complet — OTP USSD Orange SN (sandbox)
// Numéro test CI XOF : 2252100000001 → SUCCESS
const step1 = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: { "Authorization": "Bearer YOUR_KEY", "Content-Type": "application/json" },
  body: JSON.stringify({
    amount: 5000, currency: "XOF",
    phone: "2252100000001",  // ← numéro de test officiel
    operator: "Orange Money", country_code: "CI",
    notify_url: "https://monsite.com/webhook"
  })
});
// step1 → 400 { error: "otp_required", ussd_code: "#144*82#", reference: "DEP-..." }

const step2 = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: { "Authorization": "Bearer YOUR_KEY", "Content-Type": "application/json" },
  body: JSON.stringify({
    amount: 5000, currency: "XOF",
    phone: "2252100000001", operator: "Orange Money", country_code: "CI",
    otp: "500000",             // ← code OTP valide sandbox
    reference: "DEP-...",      // ← obligatoire : valeur du 400
    notify_url: "https://monsite.com/webhook"
  })
});
// step2 → 202 pending → webhook payment.completed`} />
              </div>
            </div>

            {/* OTP expiry warning */}
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-2">
              <p className="text-sm font-semibold text-yellow-300">Expiration OTP</p>
              <ul className="space-y-1.5 text-sm text-gray-600">
                {[
                  "La session OTP est valide 15 minutes après la réponse 400 otp_required",
                  "Si le délai est dépassé, l'API retourne 400 otp_expired — relancez la requête sans otp pour démarrer une nouvelle session",
                  "Un même code OTP ne peut être utilisé qu'une seule fois (protection anti-rejeu)",
                  "Pour Orange BF, le code USSD contient le montant exact : *144*4*6*5000# pour 5000 XOF",
                  "Ne stockez jamais le code OTP côté serveur — il doit être saisi directement par le client",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-yellow-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Wave sandbox note */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5 space-y-2">
              <p className="text-sm font-semibold text-purple-300">Test Wave en sandbox</p>
              <p className="text-sm text-gray-600">
                En sandbox, le <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">wave_url</code> retourné est une URL Wave de test.
                Ouvrez-la dans un navigateur pour simuler l'approbation ou le refus du paiement.
                Le webhook <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">payment.completed</code>{" "}
                ou <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">payment.failed</code>{" "}
                est envoyé automatiquement après la simulation.
              </p>
            </div>
          </section>

          <div className="h-20" />
        </main>
      </div>
    </div>
  );
}
