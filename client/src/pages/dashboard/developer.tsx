import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Copy, CheckCheck, Terminal, Shield, Webhook,
  CheckCircle2, ArrowRight, Code2, Globe, Zap, BookOpen,
  ChevronRight, Menu, X, List, Download,
} from "lucide-react";
import { downloadSDKDocs } from "@/lib/pdf-docs";

const SECTIONS = [
  { id: "introduction",   label: "Introduction",         icon: BookOpen },
  { id: "authentication", label: "Authentification",     icon: Shield },
  { id: "countries",      label: "GET /v1/countries",    icon: List },
  { id: "collect",        label: "POST /v1/collect",     icon: Terminal },
  { id: "flows",          label: "Flux de paiement",     icon: Zap },
  { id: "transaction",    label: "GET /v1/transaction",  icon: CheckCircle2 },
  { id: "webhooks",       label: "Webhooks",             icon: Webhook },
  { id: "errors",         label: "Codes d'erreur",       icon: ArrowRight },
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
  { code: "GN", name: "Guinée Conakry",     currency: "GNF",  operators: ["MTN Mobile Money", "Orange Money"],                            otpOps: ["Orange Money"] },
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
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0d1117] w-full min-w-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
        <span className="text-xs font-mono text-zinc-400">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
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
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-3 py-3 font-mono text-[#79c0ff] text-xs whitespace-nowrap">{name}</td>
      <td className="px-3 py-3 text-xs text-zinc-400 font-mono whitespace-nowrap">{type}</td>
      <td className="px-3 py-3 text-xs whitespace-nowrap">
        {required
          ? <span className="text-green-400 font-medium">Requis</span>
          : <span className="text-zinc-500">Optionnel</span>}
      </td>
      <td className="px-3 py-3 text-xs text-zinc-300">{desc}</td>
    </tr>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 overflow-x-auto w-full">
      <table className="w-full text-sm min-w-[500px]">{children}</table>
    </div>
  );
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="bg-white/5 border-b border-white/10">
        {cols.map(h => (
          <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 whitespace-nowrap">{h}</th>
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
    <div className="min-h-screen bg-[#0a0c10] text-zinc-100 flex flex-col overflow-x-hidden">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0c10]/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={publicMode ? "/" : "/dashboard/api-keys"}>
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white -ml-2 gap-1.5 shrink-0" data-testid="link-back-api">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{publicMode ? "Accueil" : "Retour"}</span>
              </Button>
            </Link>
            <div className="h-5 w-px bg-white/10 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Code2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm text-white truncate">Ashtech Pay</span>
              <Badge variant="outline" className="text-[10px] border-white/20 text-zinc-400 hidden sm:flex shrink-0">API v1</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {publicMode ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white text-xs" data-testid="link-login">
                    Connexion
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="text-xs" data-testid="link-register">
                    S'inscrire
                  </Button>
                </Link>
              </div>
            ) : (
              <span className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500">
                <Globe className="w-3.5 h-3.5" />
                ashtechpay.top
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="hidden sm:flex gap-1.5 border-white/20 text-zinc-300 hover:text-white hover:border-white/40 text-xs"
              data-testid="button-download-pdf-sdk"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? "Génération…" : "PDF"}
            </Button>
            <button
              className="lg:hidden text-zinc-400 hover:text-white"
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
          ${sidebarOpen ? "fixed inset-0 z-30 bg-[#0a0c10] pt-14 px-4" : "hidden"}
          lg:relative lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:border-r lg:border-white/10
          lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto
        `}>
          <nav className="py-6 space-y-1 lg:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3 px-2">Documentation</p>
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                data-testid={`nav-${id}`}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                  active === id
                    ? "bg-white/10 text-white font-medium"
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
            <div className="my-4 h-px bg-white/10" />
            <div className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <p className="text-[11px] font-medium text-zinc-400">Votre clé API</p>
              <p className="text-xs font-mono text-zinc-500 break-all line-clamp-2">{apiKey.slice(0, 24)}…</p>
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
                <h1 className="text-2xl font-semibold text-white">Introduction</h1>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                L'API Ashtech Pay permet à vos applications d'initier des paiements Mobile Money dans{" "}
                <strong className="text-white">{ALL_COUNTRIES.length} pays africains</strong>,
                sans redirection. Elle gère automatiquement le routage entre les opérateurs et vous notifie
                du résultat via webhook.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Shield, title: "Sécurisé",   desc: "Chaque requête est authentifiée par clé API Bearer" },
                { icon: Zap,    title: "Temps réel",  desc: "Résultat envoyé instantanément sur votre webhook" },
                { icon: Globe,  title: `${ALL_COUNTRIES.length} pays`, desc: "Toute l'Afrique francophone couverte" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <p className="font-semibold text-white text-sm">{title}</p>
                  <p className="text-xs text-zinc-500">{desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#161b22] p-5 space-y-3 overflow-x-hidden">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">URL de base</p>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-base font-mono font-semibold text-[#79c0ff] break-all">https://ashtechpay.top</code>
                <Badge variant="outline" className="border-green-500/30 text-green-400 text-[10px] shrink-0">v1</Badge>
              </div>
              <p className="text-xs text-zinc-500">Toutes les requêtes doivent être envoyées en HTTPS. Réponses JSON uniquement.</p>
            </div>
          </section>

          {/* Authentication */}
          <section id="authentication" ref={el => sectionRefs.current.authentication = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <Shield className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-white">Authentification</h2>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Toutes les requêtes doivent inclure votre clé API dans l'en-tête HTTP{" "}
              <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">Authorization</code>.
            </p>
            <CodeBlock language="http" code={`Authorization: Bearer ${apiKey}`} />
            <div className="flex gap-3 items-start rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
              <span className="text-orange-400 mt-0.5 shrink-0">⚠</span>
              <p className="text-sm text-orange-300">
                Utilisez votre clé API <strong>uniquement depuis votre serveur</strong> (Node.js, Python, PHP…).
                Ne l'incluez jamais dans du code côté navigateur ou application mobile.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-300">Exemple d'appel authentifié (Node.js)</p>
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
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <List className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-white">Pays et opérateurs</h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <MethodBadge method="GET" />
              <code className="text-sm font-mono text-zinc-300 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                /v1/countries
              </code>
            </div>

            <p className="text-zinc-400 leading-relaxed">
              Retourne la liste complète des pays actifs et leurs opérateurs Mobile Money disponibles.
              Utilisez cet endpoint pour peupler dynamiquement votre interface de paiement.
            </p>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Requête</p>
                <CodeBlock language="javascript" code={`fetch("https://ashtechpay.top/v1/countries", {
  headers: {
    "Authorization": "Bearer ${apiKey}"
  }
})`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Réponse</p>
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
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
                Pays disponibles ({ALL_COUNTRIES.length})
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ALL_COUNTRIES.map(({ code, name, currency, operators, otpOps }) => (
                  <div key={code} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-zinc-200">{name}</p>
                      <span className="text-[10px] font-mono text-zinc-500 bg-white/10 px-1.5 py-0.5 rounded shrink-0">{code} · {currency}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {operators.map(op => {
                        const needsOtp = otpOps.includes(op);
                        const isWave = op === "Wave";
                        return (
                          <span
                            key={op}
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              isWave ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                              needsOtp ? "bg-yellow-500/15 text-yellow-300 border border-yellow-500/25" :
                              "bg-white/10 text-zinc-400"
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
              <div className="flex flex-wrap gap-4 text-xs text-zinc-500 pt-1">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white/10 inline-block" /> USSD Push — pas d'OTP</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500/30 inline-block" /> ⚡ OTP requis (SMS reçu)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500/30 inline-block" /> 🔗 Wave — lien de paiement</span>
              </div>
            </div>
          </section>

          {/* Collect */}
          <section id="collect" ref={el => sectionRefs.current.collect = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <Terminal className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-white">Initier un paiement</h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <MethodBadge method="POST" />
              <code className="text-sm font-mono text-zinc-300 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                /v1/collect
              </code>
            </div>

            <p className="text-zinc-400 leading-relaxed">
              Initie un paiement Mobile Money. Le client reçoit une demande de validation sur son téléphone
              (USSD ou notification push selon l'opérateur). Les frais de la plateforme sont automatiquement
              déduits — le <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">credited_amount</code> correspond
              au montant net crédité sur votre compte.
            </p>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Corps de la requête (JSON)</p>
              <TableWrapper>
                <TableHead cols={["Paramètre", "Type", "Statut", "Description"]} />
                <tbody>
                  <ParamRow name="amount"       type="number" required desc="Montant brut à collecter" />
                  <ParamRow name="currency"     type="string" required desc="Devise du pays (XAF, XOF, GNF, CDF…)" />
                  <ParamRow name="phone"        type="string" required desc="Numéro de téléphone du payeur" />
                  <ParamRow name="operator"     type="string" required desc="Nom exact de l'opérateur (depuis /v1/countries)" />
                  <ParamRow name="country_code" type="string" required desc="Code ISO du pays (CM, SN, CI…)" />
                  <ParamRow name="reference"    type="string" required={false} desc="Référence unique de votre commande" />
                  <ParamRow name="otp"          type="string" required={false} desc="Code OTP si requis (voir réponse 400 otp_required)" />
                  <ParamRow name="notify_url"   type="string" required={false} desc="URL webhook pour recevoir le résultat du paiement" />
                </tbody>
              </TableWrapper>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Requête</p>
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
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Réponse (202)</p>
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
              <p className="text-sm font-semibold text-yellow-300">OTP requis (Orange Money CI, SN, ML, BF…)</p>
              <p className="text-sm text-zinc-400">
                Certains opérateurs nécessitent un code OTP. Si c'est le cas, l'API retourne une erreur{" "}
                <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">400 otp_required</code>{" "}
                avec le code USSD à composer. Relancez ensuite la requête en ajoutant le champ{" "}
                <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">otp</code>.
              </p>
              <CodeBlock language="json" code={`// Réponse 400 initiale
{
  "error": "otp_required",
  "message": "OTP requis. Composez #144*82# pour obtenir votre code OTP.",
  "ussd_code": "#144*82#"
}

// Relancer avec l'OTP
{
  "amount": 5000, "currency": "XOF", "phone": "07XXXXXXXX",
  "operator": "Orange Money", "country_code": "CI",
  "otp": "123456",
  "notify_url": "https://monsite.com/webhook"
}`} />
            </div>
          </section>

          {/* Payment flows */}
          <section id="flows" ref={el => sectionRefs.current.flows = el} className="scroll-mt-20 space-y-8">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <Zap className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-white">Flux de paiement</h2>
            </div>

            <p className="text-zinc-400 leading-relaxed">
              Selon le pays et l'opérateur, l'API utilise automatiquement l'un des 4 flux ci-dessous.
              Votre code doit gérer chacun différemment car la réponse et les étapes varient.
            </p>

            {/* Flow overview table */}
            <TableWrapper>
              <TableHead cols={["Flux", "Opérateurs concernés", "Réponse initiale", "Action requise"]} />
              <tbody>
                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap"><span className="text-blue-400 font-semibold text-sm">USSD Push</span></td>
                  <td className="px-3 py-3 text-zinc-300 text-sm">MTN, Moov, Airtel, Orange CM, Free SN, T-Money, Flooz, M-Pesa, Afrimoney…</td>
                  <td className="px-3 py-3 font-mono text-green-400 text-xs whitespace-nowrap">202 pending</td>
                  <td className="px-3 py-3 text-zinc-300 text-sm">Attendre le webhook. Le client valide directement sur son téléphone.</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap"><span className="text-yellow-400 font-semibold text-sm">OTP SMS</span></td>
                  <td className="px-3 py-3 text-zinc-300 text-sm">Orange Money (CI, SN, ML, GN, CF, CG, GA, GW, GQ, CD, TD, TG) — reçoit SMS</td>
                  <td className="px-3 py-3 font-mono text-orange-400 text-xs whitespace-nowrap">400 otp_required<br/><span className="text-zinc-500">ussd_code: null</span></td>
                  <td className="px-3 py-3 text-zinc-300 text-sm">Le client reçoit un SMS avec son OTP. Relancer la requête avec le champ <code className="text-[#79c0ff] bg-white/10 px-1 py-0.5 rounded">otp</code>.</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap"><span className="text-orange-400 font-semibold text-sm">OTP USSD</span></td>
                  <td className="px-3 py-3 text-zinc-300 text-sm">Orange Money (BF) — compose un code USSD pour obtenir l'OTP</td>
                  <td className="px-3 py-3 font-mono text-orange-400 text-xs whitespace-nowrap">400 otp_required<br/><span className="text-zinc-500">ussd_code: "*144*4*6*5000#"</span></td>
                  <td className="px-3 py-3 text-zinc-300 text-sm">Le client compose le code USSD fourni, saisit l'OTP reçu. Relancer avec <code className="text-[#79c0ff] bg-white/10 px-1 py-0.5 rounded">otp</code>.</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap"><span className="text-purple-400 font-semibold text-sm">Wave</span></td>
                  <td className="px-3 py-3 text-zinc-300 text-sm">Wave (CI), Wave (SN)</td>
                  <td className="px-3 py-3 font-mono text-purple-400 text-xs whitespace-nowrap">202 pending<br/><span className="text-zinc-500">flow: "wave", wave_url: "..."</span></td>
                  <td className="px-3 py-3 text-zinc-300 text-sm">Afficher le <code className="text-[#79c0ff] bg-white/10 px-1 py-0.5 rounded">wave_url</code> en bouton ou QR code. Le client ouvre Wave pour confirmer.</td>
                </tr>
              </tbody>
            </TableWrapper>

            {/* Flow 1: USSD Push */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">1</span>
                <h3 className="font-semibold text-blue-300">Flux USSD Push — La majorité des opérateurs</h3>
              </div>
              <p className="text-sm text-zinc-400">
                Flux le plus simple. Le client reçoit une demande USSD sur son téléphone et valide en composant son PIN.
                Vous recevez la confirmation par webhook.{" "}
                <strong className="text-zinc-200">Pas d'OTP à gérer côté merchant.</strong>
              </p>
              <div className="text-xs text-zinc-500">
                <strong className="text-zinc-400">Exemples d'opérateurs :</strong>{" "}
                MTN (CM, BJ, CG, GN, CD), Moov (BJ, CI, BF, GA, ML, TG), Airtel (CG, GA, NE, CD, TD),
                Orange (CM), Free Money (SN), T-Money (TG), Flooz (TG), Vodacom M-Pesa (CD), Afrimoney (CD)
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-zinc-500 font-medium">Requête</p>
                  <CodeBlock language="javascript" code={`// Orange Money Cameroun — flux USSD push
const res = await fetch("/v1/collect", {
  method: "POST",
  headers: { "Authorization": "Bearer ${apiKey}" },
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
                  <p className="text-xs text-zinc-500 font-medium">Réponse 202</p>
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

            {/* Flow 2: OTP SMS (AfribaPay) */}
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-white shrink-0">2</span>
                <h3 className="font-semibold text-yellow-300">Flux OTP SMS — Orange Money (la plupart des pays)</h3>
              </div>
              <p className="text-sm text-zinc-400">
                Pour Orange Money dans la majorité des pays. Le réseau Orange envoie automatiquement un SMS
                contenant l'OTP au numéro du client. Votre interface doit demander au client de saisir cet OTP.
                <strong className="text-zinc-200"> Le champ <code className="text-[#79c0ff] bg-white/10 px-1 py-0.5 rounded">ussd_code</code> est <code className="text-red-400">null</code></strong> — aucun code à composer.
              </p>
              <div className="text-xs text-zinc-500">
                <strong className="text-zinc-400">Opérateurs concernés :</strong>{" "}
                Orange Money CI, Orange Money SN, Orange Money ML, Orange Money GN, Orange Money CF,
                Orange Money CG, Orange Money GA, Orange Money GW, Orange Money GQ, Orange Money CD, Orange Money TD
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-zinc-500 font-medium">Étape 1 — Requête initiale (sans OTP)</p>
                  <CodeBlock language="javascript" code={`// Orange Money CI — étape 1 : sans OTP
const res = await fetch("/v1/collect", {
  method: "POST",
  headers: { "Authorization": "Bearer ${apiKey}" },
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
// ussd_code est null
// Le client reçoit l'OTP par SMS`} />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-zinc-500 font-medium">Réponse 400 + Étape 2 — Avec OTP</p>
                  <CodeBlock language="json" code={`// Réponse 400 :
{
  "error": "otp_required",
  "message": "OTP requis pour cet opérateur.",
  "ussd_code": null
}

// Le client reçoit son OTP par SMS
// Étape 2 : relancer avec otp`} />
                  <CodeBlock language="javascript" code={`// Étape 2 : même requête + otp
body: JSON.stringify({
  amount: 1000, currency: "XOF",
  phone: "0700000000",
  operator: "Orange Money",
  country_code: "CI",
  otp: "123456",  // ← OTP reçu par SMS
  notify_url: "https://monsite.com/webhook"
})
// → 202 pending → webhook`} />
                </div>
              </div>
            </div>

            {/* Flow 3: OTP USSD (PixPay) */}
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white shrink-0">3</span>
                <h3 className="font-semibold text-orange-300">Flux OTP USSD — Orange Money Burkina Faso uniquement</h3>
              </div>
              <p className="text-sm text-zinc-400">
                Spécifique au Burkina Faso. L'API retourne un <code className="text-[#79c0ff] bg-white/10 px-1 py-0.5 rounded">ussd_code</code>{" "}
                incluant le montant (ex : <code className="text-orange-300 bg-white/10 px-1 py-0.5 rounded">*144*4*6*5000#</code>).
                Le client doit composer ce code depuis son téléphone — Orange répond par SMS avec l'OTP.
              </p>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-zinc-500 font-medium">Étape 1 — Requête initiale (sans OTP)</p>
                  <CodeBlock language="javascript" code={`// Orange Money Burkina Faso — étape 1
const res = await fetch("/v1/collect", {
  method: "POST",
  headers: { "Authorization": "Bearer ${apiKey}" },
  body: JSON.stringify({
    amount: 5000,
    currency: "XOF",
    phone: "70000000",
    operator: "Orange Money",
    country_code: "BF",
    notify_url: "https://monsite.com/webhook"
  })
});
// → 400 otp_required
// ussd_code contient le code USSD à composer`} />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-zinc-500 font-medium">Réponse 400 + Étape 2</p>
                  <CodeBlock language="json" code={`// Réponse 400 :
{
  "error": "otp_required",
  "message": "OTP requis. Composez *144*4*6*5000# pour obtenir votre code OTP.",
  "ussd_code": "*144*4*6*5000#"
}

// Afficher à l'utilisateur :
// "Composez *144*4*6*5000# sur votre téléphone,
//  puis saisissez l'OTP reçu"`} />
                  <CodeBlock language="javascript" code={`// Étape 2 : même requête + otp
body: JSON.stringify({
  amount: 5000, currency: "XOF",
  phone: "70000000",
  operator: "Orange Money",
  country_code: "BF",
  otp: "456789",  // ← OTP reçu après le USSD
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
              <p className="text-sm text-zinc-400">
                Pour Wave CI et Wave SN. L'API retourne directement un <code className="text-[#79c0ff] bg-white/10 px-1 py-0.5 rounded">wave_url</code> dans la réponse 202.
                Votre interface doit afficher ce lien (bouton ou QR code) pour que le client l'ouvre dans son
                application Wave. <strong className="text-zinc-200">Pas d'OTP.</strong>{" "}
                Le numéro de téléphone n'est pas requis pour Wave.
              </p>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-zinc-500 font-medium">Requête</p>
                  <CodeBlock language="javascript" code={`// Wave Côte d'Ivoire
const res = await fetch("/v1/collect", {
  method: "POST",
  headers: { "Authorization": "Bearer ${apiKey}" },
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
                  <p className="text-xs text-zinc-500 font-medium">Réponse 202</p>
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
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Comment détecter le bon flux dans votre code</p>
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
    if (data.ussd_code) {
      // ─── Flux OTP USSD (BF Orange) : code à composer ─────────
      return { type: "otp_ussd", ussdCode: data.ussd_code };
    } else {
      // ─── Flux OTP SMS (Orange CI, SN, ML…) : SMS automatique ─
      return { type: "otp_sms" };
    }
  }

  throw new Error(data.message);
}`} />
            </div>
          </section>

          {/* Transaction status */}
          <section id="transaction" ref={el => sectionRefs.current.transaction = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-white">Statut d'une transaction</h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <MethodBadge method="GET" />
              <code className="text-sm font-mono text-zinc-300 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                /v1/transaction/:id
              </code>
            </div>

            <p className="text-zinc-400 leading-relaxed">
              Consultez le statut d'une transaction à tout moment via le{" "}
              <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">transaction_id</code>{" "}
              retourné lors de l'initiation. Vous pouvez également utiliser ce endpoint en complément du webhook.
            </p>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Requête</p>
                <CodeBlock language="javascript" code={`fetch(
  "https://ashtechpay.top/v1/transaction/8f3e1c2d-...",
  {
    headers: {
      "Authorization": "Bearer ${apiKey}"
    }
  }
)`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Réponse</p>
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
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Statuts possibles</p>
              <TableWrapper>
                <TableHead cols={["Statut", "Description", "Final ?"]} />
                <tbody>
                  {[
                    { status: "pending", color: "text-yellow-400", desc: "En attente de confirmation de l'opérateur", final: false },
                    { status: "success", color: "text-green-400",  desc: "Paiement confirmé — compte marchand crédité", final: true  },
                    { status: "failed",  color: "text-red-400",    desc: "Paiement refusé, expiré ou annulé",           final: true  },
                  ].map(({ status, color, desc, final }) => (
                    <tr key={status} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap"><span className={`font-mono font-medium text-sm ${color}`}>{status}</span></td>
                      <td className="px-3 py-3 text-zinc-300 text-sm">{desc}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm">{final ? <span className="text-green-400">Oui</span> : <span className="text-zinc-500">Non</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </div>
          </section>

          {/* Webhooks */}
          <section id="webhooks" ref={el => sectionRefs.current.webhooks = el} className="scroll-mt-20 space-y-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <Webhook className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-white">Webhooks</h2>
            </div>

            <p className="text-zinc-400 leading-relaxed">
              Quand une transaction atteint un état final, Ashtech Pay envoie automatiquement une requête{" "}
              <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">POST</code>{" "}
              à la <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">notify_url</code>{" "}
              que vous avez passée dans votre appel à <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">/v1/collect</code>.
              Le champ <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">amount</code> correspond au montant net après frais,
              et <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">total_amount</code> au montant brut collecté.
            </p>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Payload — paiement réussi</p>
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
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Payload — paiement échoué</p>
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
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Événements disponibles</p>
              <div className="rounded-xl border border-white/10 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Événement</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Déclencheur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { event: "payment.completed", desc: "Paiement (dépôt) confirmé avec succès" },
                      { event: "payment.failed",    desc: "Paiement refusé, expiré ou annulé" },
                      { event: "payout.completed",  desc: "Retrait ou virement sortant confirmé" },
                      { event: "payout.failed",     desc: "Retrait ou virement échoué" },
                    ].map(({ event, desc }) => (
                      <tr key={event} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-3 font-mono text-[#79c0ff] text-xs whitespace-nowrap">{event}</td>
                        <td className="px-3 py-3 text-zinc-300 text-sm">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Handler (Node.js / Express)</p>
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
              <ul className="space-y-1.5 text-sm text-zinc-400">
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
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <ArrowRight className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold text-white">Codes d'erreur</h2>
            </div>

            <p className="text-zinc-400 leading-relaxed">
              En cas d'erreur, l'API retourne un objet JSON avec les champs{" "}
              <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">error</code> et{" "}
              <code className="text-[#79c0ff] bg-white/10 px-1.5 py-0.5 rounded text-xs">message</code>.
            </p>

            <CodeBlock language="json" code={`{
  "error": "bad_request",
  "message": "Champs requis : amount, currency, phone, operator, country_code"
}`} />

            <TableWrapper>
              <TableHead cols={["Code HTTP", "Erreur", "Signification"]} />
              <tbody>
                {[
                  { code: "400", error: "bad_request",   msg: "Paramètre manquant ou format invalide" },
                  { code: "400", error: "otp_required",  msg: "OTP nécessaire — vérifiez ussd_code dans la réponse" },
                  { code: "401", error: "unauthorized",  msg: "Clé API manquante, invalide ou révoquée" },
                  { code: "403", error: "forbidden",     msg: "Cette transaction n'appartient pas à votre compte" },
                  { code: "404", error: "not_found",     msg: "Transaction introuvable" },
                  { code: "422", error: "unprocessable", msg: "Pays ou opérateur non supporté / devise incorrecte" },
                  { code: "429", error: "rate_limited",  msg: "Trop de requêtes — ralentissez" },
                  { code: "502", error: "gateway_error", msg: "Le réseau de l'opérateur a rejeté le paiement" },
                  { code: "500", error: "server_error",  msg: "Erreur interne — réessayez" },
                ].map(({ code, error, msg }) => (
                  <tr key={`${code}-${error}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-3 py-3 font-mono font-bold text-orange-400 whitespace-nowrap">{code}</td>
                    <td className="px-3 py-3 font-mono text-zinc-400 text-xs whitespace-nowrap">{error}</td>
                    <td className="px-3 py-3 text-zinc-300 text-sm">{msg}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
              Pour toute question technique non résolue par cette documentation, contactez notre équipe via{" "}
              <Link href="/dashboard/support" className="text-primary hover:underline">le support</Link>.
            </div>
          </section>

          <div className="h-20" />
        </main>
      </div>
    </div>
  );
}
