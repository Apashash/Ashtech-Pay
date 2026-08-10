import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Copy, CheckCheck, Terminal, Shield, Webhook,
  CheckCircle2, ArrowRight, Code2, Globe, Zap, BookOpen,
  ChevronRight, Menu, X, List, Download, FlaskConical, Bitcoin, Lock,
  WrapText,
} from "lucide-react";
import { downloadSDKDocs } from "@/lib/pdf-docs";

const SECTIONS = [
  { id: "introduction",   label: "Introduction",         icon: BookOpen },
  { id: "authentication", label: "Authentification",     icon: Shield },
  { id: "countries",      label: "GET /v1/countries",    icon: List },
  { id: "crypto",         label: "Pay-In Crypto",        icon: Bitcoin },
  { id: "collect",        label: "POST /v1/collect",     icon: Terminal },
  { id: "flows",          label: "Flux de paiement",     icon: Zap },
  { id: "transaction",    label: "GET /v1/transaction",  icon: CheckCircle2 },
  { id: "fees",           label: "GET /v1/fees",         icon: ArrowRight },
  { id: "webhooks",       label: "Webhooks",             icon: Webhook },
  { id: "errors",         label: "Codes d'erreur",       icon: ArrowRight },
  { id: "sandbox",        label: "Sandbox & Tests",      icon: FlaskConical },
];

const ALL_COUNTRIES = [
  { code: "BJ", name: "Bénin",              currency: "XOF", operators: ["Celtiis Money", "Coris Money", "Moov Money", "MTN Money"], otpOps: [] },
  { code: "BF", name: "Burkina Faso",       currency: "XOF", operators: ["Moov Money", "Orange Money", "Wallet LigdiCash"],                  otpOps: ["Orange Money"] },
  { code: "CM", name: "Cameroun",           currency: "XAF",  operators: ["MTN Money", "Orange Money"],                                  otpOps: [] },
  { code: "CI", name: "Côte d'Ivoire",      currency: "XOF", operators: ["Moov Money", "MTN Money", "Orange Money", "Wave Money"],       otpOps: ["Orange Money"] },
  { code: "GA", name: "Gabon",              currency: "XAF", operators: ["Airtel Money", "Moov Money"],                                   otpOps: [] },
  { code: "ML", name: "Mali",               currency: "XOF", operators: ["Moov Money", "Orange Money"],                                   otpOps: [] },
  { code: "NE", name: "Niger",              currency: "XOF", operators: ["Airtel Money"],                                                  otpOps: [] },
  { code: "CD", name: "RD Congo",           currency: "CDF", operators: ["Afri Money", "Airtel Money", "Mpesa Money", "Orange Money", "Vodacom"], otpOps: [] },
  { code: "SN", name: "Sénégal",            currency: "XOF", operators: ["E-money", "Free Money", "Orange Money", "Wave Money"],             otpOps: ["Orange Money"] },
  { code: "TG", name: "Togo",               currency: "XOF", operators: ["Flooz (Moov)", "T-Money"],                                      otpOps: [] },
];

// ── Syntax highlighting ──────────────────────────────────────────────────────
type _ST = { t: string; c: string };

function _hlJson(code: string): _ST[] {
  const out: _ST[] = [];
  let i = 0;
  while (i < code.length) {
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length) {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === '"') { j++; break; }
        j++;
      }
      const s = code.slice(i, j);
      let k = j;
      while (k < code.length && (code[k] === ' ' || code[k] === '\t')) k++;
      out.push({ t: s, c: code[k] === ':' ? '#f47067' : '#57ab5a' });
      i = j;
    } else if ((code[i] >= '0' && code[i] <= '9') || (code[i] === '-' && i + 1 < code.length && code[i+1] >= '0' && code[i+1] <= '9')) {
      let j = i + (code[i] === '-' ? 1 : 0);
      while (j < code.length && (code[j] >= '0' && code[j] <= '9' || code[j] === '.' || code[j] === 'e' || code[j] === 'E')) j++;
      out.push({ t: code.slice(i, j), c: '#6cb6ff' }); i = j;
    } else if (code.startsWith('true', i))  { out.push({ t: 'true',  c: '#f69d50' }); i += 4;
    } else if (code.startsWith('false', i)) { out.push({ t: 'false', c: '#f69d50' }); i += 5;
    } else if (code.startsWith('null', i))  { out.push({ t: 'null',  c: '#f69d50' }); i += 4;
    } else { out.push({ t: code[i], c: '#adbac7' }); i++; }
  }
  return out;
}

function _hlBash(code: string): _ST[] {
  const out: _ST[] = [];
  const lines = code.split('\n');
  lines.forEach((line, li) => {
    if (li > 0) out.push({ t: '\n', c: '' });
    if (line.trimStart().startsWith('#')) { out.push({ t: line, c: '#768390' }); return; }
    let i = 0;
    while (i < line.length) {
      if (line[i] === ' ' || line[i] === '\t') {
        let j = i; while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j++;
        out.push({ t: line.slice(i, j), c: '#adbac7' }); i = j; continue;
      }
      if (line[i] === '\\') { out.push({ t: '\\', c: '#768390' }); i++; continue; }
      if (line[i] === "'") {
        let j = i + 1; while (j < line.length && line[j] !== "'") j++;
        out.push({ t: line.slice(i, j + 1), c: '#57ab5a' }); i = j + 1; continue;
      }
      if (line[i] === '"') {
        let j = i + 1; while (j < line.length && (line[j] !== '"' || line[j-1] === '\\')) j++;
        out.push({ t: line.slice(i, j + 1), c: '#57ab5a' }); i = j + 1; continue;
      }
      if (line[i] === '-') {
        let j = i; while (j < line.length && line[j] !== ' ' && line[j] !== '\t' && line[j] !== "'" && line[j] !== '"') j++;
        out.push({ t: line.slice(i, j), c: '#768390' }); i = j; continue;
      }
      let j = i;
      while (j < line.length && line[j] !== ' ' && line[j] !== '\t' && line[j] !== "'" && line[j] !== '"' && line[j] !== '\\') j++;
      const w = line.slice(i, j);
      const mc = ['POST','GET','DELETE','PUT','PATCH'].includes(w) ? '#f47067' : null;
      out.push({ t: w, c: mc ?? (w === 'curl' ? '#79c0ff' : w.startsWith('http') ? '#79c0ff' : '#cdd9e5') });
      i = j;
    }
  });
  return out;
}

function _renderToks(tokens: _ST[]): React.ReactNode {
  return tokens.map((tok, i) =>
    tok.c ? <span key={i} style={{ color: tok.c }}>{tok.t}</span> : tok.t
  );
}
// ────────────────────────────────────────────────────────────────────────────

/* ── Code block ── */
function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap]   = useState(false);
  function copy() {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const langLabel: Record<string, string> = {
    json: "json", javascript: "Node.js", http: "HTTP",
    bash: "curl", php: "PHP", python: "Python",
  };
  const tokens = language === 'json' ? _hlJson(code.trim())
    : language === 'bash' ? _hlBash(code.trim())
    : [{ t: code.trim(), c: '#cdd9e5' }];
  return (
    <div className="rounded-lg overflow-hidden border border-[#3a3a3a] w-full min-w-0">
      {/* header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#2b2b2b] border-b border-[#3a3a3a]">
        <span className="text-[11px] font-mono font-medium text-[#d0d0d0] bg-[#3d3d3d] px-2.5 py-0.5 rounded">
          {langLabel[language] ?? language}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWrap(v => !v)}
            title="Toggle wrap"
            className={`text-[#888] hover:text-[#ccc] transition-colors ${wrap ? "text-[#ccc]" : ""}`}
            data-testid="button-wrap-code"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={copy}
            className="text-[#888] hover:text-[#ccc] transition-colors"
            data-testid="button-copy-code"
          >
            {copied
              ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {/* code area */}
      <div className={`overflow-x-auto w-full ${wrap ? "" : ""}`}>
        <pre className={`bg-[#1a1a1a] px-4 py-3.5 leading-relaxed ${wrap ? "whitespace-pre-wrap break-all" : "w-max min-w-full"}`}>
          <code className="font-mono text-[13px]">{_renderToks(tokens)}</code>
        </pre>
      </div>
    </div>
  );
}

/* ── Table components ── */
function DocTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto w-full border border-gray-300 rounded">
      <table className="w-full text-sm min-w-[400px] border-collapse">{children}</table>
    </div>
  );
}

function DocThead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr>
        {cols.map(h => (
          <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-300 whitespace-nowrap">{h}</th>
        ))}
      </tr>
    </thead>
  );
}

function DocTr({ cells }: { cells: React.ReactNode[] }) {
  return (
    <tr className="border-b border-gray-200 last:border-b-0">
      {cells.map((c, i) => (
        <td key={i} className="px-4 py-3 text-sm text-gray-700 align-top">{c}</td>
      ))}
    </tr>
  );
}

/* ── Inline code pill ── */
function IC({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-gray-800">{children}</code>;
}

/* ── Method label ── */
function Method({ m }: { m: string }) {
  const colors: Record<string, string> = {
    POST:   "text-[#e07a10] font-bold",
    GET:    "text-[#2b7fd4] font-bold",
    DELETE: "text-[#dc2626] font-bold",
  };
  return <span className={`font-mono text-sm ${colors[m] ?? "text-gray-700 font-bold"}`}>{m}</span>;
}

/* ── Endpoint row: METHOD PATH 🔒 ── */
function EndpointRow({ method, path, auth = true }: { method: string; path: string; auth?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3 border-t border-b border-gray-200 my-4">
      <Method m={method} />
      <span className="font-mono text-sm text-gray-800 font-semibold">{path}</span>
      {auth && <Lock className="w-3.5 h-3.5 text-gray-400 ml-auto shrink-0" />}
    </div>
  );
}

/* ── Authorization display ── */
function AuthSection() {
  return (
    <div className="mt-4 space-y-1">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold tracking-widest text-gray-700 uppercase">AUTHORIZATION</span>
        <span className="text-xs text-gray-400">Bearer Token</span>
      </div>
      <div>
        <span className="text-xs font-semibold text-gray-700">Token</span>
      </div>
    </div>
  );
}

/* ── Section heading (major) ── */
function SectionH({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="border-t border-gray-200 pt-10 scroll-mt-20">
      <h2 className="text-2xl font-bold text-gray-900 tracking-wide uppercase mb-4">{children}</h2>
    </div>
  );
}

/* ── Subsection heading ── */
function SubH({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-gray-900 mt-6 mb-2">{children}</h3>;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DeveloperPage({ publicMode = false }: { publicMode?: boolean }) {
  const [active, setActive]       = useState("introduction");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function handleDownloadPDF() {
    setDownloading(true);
    setTimeout(() => { downloadSDKDocs(); setDownloading(false); }, 50);
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
    <div className="min-h-screen bg-white text-gray-900 flex flex-col overflow-x-hidden" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* ── Top nav ── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={publicMode ? "/" : "/dashboard/api-keys"}>
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 -ml-2 gap-1.5 shrink-0" data-testid="link-back-api">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{publicMode ? "Accueil" : "Retour"}</span>
              </Button>
            </Link>
            <div className="h-5 w-px bg-gray-200 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Code2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm text-gray-900 truncate">Ashtech Pay</span>
              <Badge variant="outline" className="text-[10px] hidden sm:flex shrink-0">API v1</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {publicMode && (
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 text-xs" data-testid="link-login">Connexion</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="text-xs" data-testid="link-register">S'inscrire</Button>
                </Link>
              </div>
            )}
            <Link href="/docs/test-pay">
              <Button size="sm" className="gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs hidden sm:flex" data-testid="link-test-api">
                <FlaskConical className="w-3.5 h-3.5" />
                Tester l'API
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={downloading}
              className="flex gap-1.5 text-gray-700 text-xs" data-testid="button-download-pdf-sdk">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{downloading ? "Génération…" : "Télécharger PDF"}</span>
              <span className="sm:hidden">{downloading ? "…" : "PDF"}</span>
            </Button>
            <button className="lg:hidden text-gray-600 hover:text-gray-900" onClick={() => setSidebarOpen(v => !v)} data-testid="button-toggle-mobile-nav">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full min-w-0">
        {/* ── Sidebar ── */}
        <aside className={`
          ${sidebarOpen ? "fixed inset-0 z-30 bg-white pt-14 px-4" : "hidden"}
          lg:relative lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:border-r lg:border-gray-200
          lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto
        `}>
          <nav className="py-6 space-y-0.5 lg:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3 px-2">Documentation</p>
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                data-testid={`nav-${id}`}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-all text-left ${
                  active === id
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
            <div className="my-4 h-px bg-gray-200" />
            <div className="px-3 py-3 rounded border border-gray-200 space-y-1">
              <p className="text-[11px] font-medium text-gray-500">Votre clé API</p>
              <p className="text-xs font-mono text-gray-400 tracking-wider">{"•".repeat(28)}</p>
            </div>
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 w-full px-5 py-10 lg:px-12 xl:px-16 overflow-x-hidden">

          {/* ──── PAGE TITLE ──── */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 leading-tight">
              Ashtech Pay API<br />Documentation
            </h1>
          </div>

          {/* ──── INTRODUCTION ──── */}
          <section id="introduction" ref={el => sectionRefs.current.introduction = el} className="scroll-mt-20">
            <p className="text-[15px] text-gray-700 leading-relaxed mb-6">
              L'<strong>Ashtech Pay API</strong> unifie plusieurs passerelles de paiement africaines en une seule interface REST.
              Elle propose un endpoint de production pour les transactions réelles et un endpoint sandbox pour les tests,
              permettant d'initialiser des paiements Mobile Money dans{" "}
              <strong>{displayCountries.length}+ pays africains</strong> sans redirection.
              Le routage entre opérateurs est automatique.
            </p>

            <SubH>Payment API Overview</SubH>
            <p className="text-[15px] text-gray-700 leading-relaxed mb-6">
              L'Ashtech Pay API permet aux marchands d'intégrer facilement des capacités de paiement dans leurs systèmes.
              Elle supporte les opérations clés telles que le traitement des transactions, la consultation des statuts de paiement,
              et la réception de notifications sur les mises à jour de transactions. Cela garantit des flux de paiement fluides
              et efficaces, améliorant l'expérience utilisateur globale dans vos applications.
            </p>

            {/* Try it CTA */}
            <div className="flex items-center justify-between gap-4 rounded border border-primary/20 bg-primary/5 px-5 py-4 mb-6">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-gray-900">Prêt à tester ?</p>
                <p className="text-xs text-gray-600">Envoyez un vrai paiement en quelques secondes depuis notre sandbox interactif.</p>
              </div>
              <Link href="/docs/test-pay">
                <Button size="sm" className="gap-2 shrink-0 whitespace-nowrap" data-testid="cta-test-api">
                  <FlaskConical className="w-3.5 h-3.5" />
                  Tester l'API
                </Button>
              </Link>
            </div>

            <div className="rounded border border-gray-200 bg-gray-50 p-5 space-y-2 mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">URL de base</p>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-base font-mono font-semibold text-blue-700 break-all">https://ashtechpay.top</code>
                <Badge variant="outline" className="border-green-500/30 text-green-700 text-[10px] shrink-0">v1</Badge>
              </div>
              <p className="text-xs text-gray-500">Toutes les requêtes doivent être envoyées en HTTPS. Réponses JSON uniquement.</p>
            </div>
          </section>

          {/* ──── ACCESS TOKEN / AUTHENTIFICATION ──── */}
          <section id="authentication" ref={el => sectionRefs.current.authentication = el}>
            <SectionH>Access TOKEN</SectionH>

            <p className="text-[15px] text-gray-700 leading-relaxed mb-5">
              Toutes les transactions effectuées sur Ashtech Pay nécessitent un token de sécurité valide pour identifier
              et connecter le client à nos APIs. Vous pouvez obtenir votre clé API (<IC>api_key</IC>) depuis votre
              tableau de bord marchand Ashtech Pay.
            </p>

            <EndpointRow method="POST" path="Authorization: Bearer YOUR_API_KEY" />

            <p className="text-[15px] text-gray-700 leading-relaxed mb-4">
              Incluez votre clé API dans l'en-tête HTTP <IC>Authorization</IC> de chaque requête.
            </p>

            <CodeBlock language="http" code={`Authorization: Bearer YOUR_API_KEY`} />

            <div className="flex gap-3 items-start rounded border border-orange-300 bg-orange-50 p-4 my-4">
              <span className="text-orange-500 mt-0.5 shrink-0 font-bold">⚠</span>
              <p className="text-sm text-orange-800">
                Utilisez votre clé API <strong>uniquement depuis votre serveur</strong> (Node.js, Python, PHP…).
                Ne l'incluez jamais dans du code côté navigateur ou application mobile.
              </p>
            </div>

            <SubH>Exemple d'appel authentifié (Node.js)</SubH>
            <CodeBlock language="javascript" code={`const response = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ /* ... */ })
});`} />

            <AuthSection />
          </section>

          {/* ──── PAYS ET OPÉRATEURS ──── */}
          <section id="countries" ref={el => sectionRefs.current.countries = el}>
            <SectionH>Pays et Opérateurs</SectionH>

            <p className="text-[15px] text-gray-700 leading-relaxed mb-4">
              Retourne la liste complète des pays actifs et leurs opérateurs Mobile Money disponibles.
              Cette liste est <strong>gérée par l'administrateur</strong> — tout ajout ou retrait est immédiatement visible via cet endpoint.
              Utilisez-le pour peupler dynamiquement votre interface de paiement.
            </p>

            <EndpointRow method="GET" path="/v1/countries" />

            <div className="grid lg:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Requête</p>
                <CodeBlock language="javascript" code={`fetch("https://ashtechpay.top/v1/countries", {
  headers: {
    "Authorization": "Bearer YOUR_API_KEY"
  }
})`} />
                <CodeBlock language="bash" code={`curl https://ashtechpay.top/v1/countries \\
  -H "Authorization: Bearer YOUR_API_KEY"`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Réponse</p>
                <CodeBlock language="json" code={`[
  {
    "code": "CM",
    "name": "Cameroun",
    "currency": "XAF",
    "operators": ["MTN Money", "Orange Money"]
  },
  {
    "code": "SN",
    "name": "Sénégal",
    "currency": "XOF",
    "operators": ["E-money", "Free Money", "Orange Money", "Wave Money"]
  }
  // ...
]`} />
              </div>
            </div>

            <SubH>Pays disponibles ({displayCountries.length}) — mis à jour en temps réel</SubH>

            <DocTable>
              <DocThead cols={["Pays", "Code", "Devise", "Opérateurs", "OTP Required"]} />
              <tbody>
                {displayCountries.map(({ code, name, currency, operators, otpOps }) => (
                  <DocTr key={code} cells={[
                    <span className="font-medium">{name}</span>,
                    <IC>{code}</IC>,
                    <IC>{currency}</IC>,
                    <span className="flex flex-wrap gap-1">
                      {operators.map(op => (
                        <span key={op} className={`text-[11px] px-1.5 py-0.5 rounded border ${
                          op.toLowerCase().includes("wave")
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : otpOps.includes(op)
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-white text-gray-600 border-gray-200"
                        }`}>
                          {op}{otpOps.includes(op) && !op.toLowerCase().includes("wave") ? " ⚡" : ""}{op.toLowerCase().includes("wave") ? " 🔗" : ""}
                        </span>
                      ))}
                    </span>,
                    otpOps.length > 0
                      ? <span className="text-amber-700 font-semibold text-xs">Yes — {otpOps.join(", ")}</span>
                      : <span className="text-gray-500 text-xs">No</span>,
                  ]} />
                ))}
              </tbody>
            </DocTable>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-200 inline-block" /> USSD Push — pas d'OTP</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-200 inline-block" /> ⚡ OTP requis</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-200 inline-block" /> 🔗 Wave — lien de paiement</span>
            </div>

            <AuthSection />
          </section>

          {/* ──── PAY-IN CRYPTO ──── */}
          <section id="crypto" ref={el => sectionRefs.current.crypto = el}>
            <SectionH>Pay-In Crypto</SectionH>

            <p className="text-[15px] text-gray-700 leading-relaxed mb-4">
              Créez une adresse de dépôt unique pour recevoir un paiement crypto avec la même clé API
              <IC>ak_…</IC>. Ce flux est séparé de <IC>/v1/collect</IC> :
              vos intégrations Mobile Money existantes ne changent pas.
            </p>

            <div className="rounded border border-green-300 bg-green-50 p-4 space-y-1 mb-5">
              <p className="text-sm font-semibold text-green-900">Confirmation, crédit et webhook</p>
              <p className="text-sm text-green-800 leading-relaxed">
                Après la création, le prestataire crypto notifie Ashtech Pay, puis Ashtech Pay passe la transaction à{" "}
                <IC>completed</IC>, crédite automatiquement le wallet USDT du marchand avec{" "}
                <IC>credited_amount_usdt</IC> et envoie un POST à votre <IC>notify_url</IC>.
              </p>
            </div>

            <EndpointRow method="GET" path="/v1/crypto/assets" />
            <p className="text-[15px] text-gray-700 leading-relaxed mb-4">
              Retourne uniquement les réseaux crypto actifs et autorisés. Utilisez la valeur
              <IC>asset_code</IC> retournée dans l'appel de création.
            </p>

            <div className="grid lg:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Requête</p>
                <CodeBlock language="bash" code={`curl https://ashtechpay.top/v1/crypto/assets \\
  -H "Authorization: Bearer YOUR_API_KEY"`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Réponse</p>
                <CodeBlock language="json" code={`{
  "assets": [
    {
      "asset_code": "USDT.TRC20",
      "coin": "USDT",
      "name": "Tether",
      "network": "TRC20",
      "network_label": "TRON (TRC20)",
      "memo_required": false,
      "memo_type": null,
      "currency": "USDT"
    }
  ]
}`} />
              </div>
            </div>

            <EndpointRow method="POST" path="/v1/crypto/collect" />

            <p className="text-[15px] text-gray-700 leading-relaxed mb-4">
              L'API accepte un montant en <strong>USDT</strong> ou dans une devise fiat supportée
              (<IC>XAF</IC>, <IC>XOF</IC>, <IC>CDF</IC> ou <IC>USD</IC>).
              Les devises fiat sont converties en USDT avec le taux USDT/XAF.
              <IC>amount</IC> est le montant brut ; <IC>credited_amount_usdt</IC> est le net après frais.
            </p>

            <div className="rounded border border-blue-300 bg-blue-50 p-4 mb-5">
              <p className="text-sm font-semibold text-blue-900 mb-1">Comment afficher l'adresse et le QR code ?</p>
              <p className="text-sm text-blue-800 leading-relaxed">
                La réponse <strong>202</strong> contient l'adresse unique dans <IC>address</IC> et, pour certains réseaux, le{" "}
                <IC>memo</IC> ou le <IC>tag</IC>. Ashtech Pay ne renvoie pas d'image QR : votre interface génère le QR
                localement à partir de ces valeurs.
              </p>
            </div>

            <SubH>Paramètres</SubH>
            <DocTable>
              <DocThead cols={["Paramètre", "Required", "Description"]} />
              <tbody>
                {[
                  { name: "amount",         req: true,  desc: "Montant brut à recevoir, en currency." },
                  { name: "currency",       req: true,  desc: "USDT, XAF, XOF, CDF, USD." },
                  { name: "asset_code",     req: true,  desc: "Réseau retourné par GET /v1/crypto/assets, ex. USDT.TRC20." },
                  { name: "reference",      req: false, desc: "Référence de votre commande ; générée si absente." },
                  { name: "notify_url",     req: false, desc: "URL HTTPS recevant payment.completed ou payment.failed." },
                  { name: "customer",       req: false, desc: "email, firstName et lastName du payeur." },
                  { name: "refund_address", req: false, desc: "Adresse de remboursement fournie au prestataire." },
                ].map(r => (
                  <DocTr key={r.name} cells={[
                    <IC>{r.name}</IC>,
                    r.req
                      ? <span className="text-green-700 font-semibold text-xs">Yes</span>
                      : <span className="text-gray-400 text-xs">No</span>,
                    r.desc,
                  ]} />
                ))}
              </tbody>
            </DocTable>

            <div className="grid lg:grid-cols-2 gap-5 mt-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Requête</p>
                <CodeBlock language="javascript" code={`fetch("https://ashtechpay.top/v1/crypto/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 25,
    currency: "USDT",
    asset_code: "USDT.TRC20",
    reference: "ORDER-CRYPTO-001",
    notify_url: "https://monsite.com/webhook",
    customer: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com"
    }
  })
})`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Réponse 202</p>
                <CodeBlock language="json" code={`{
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-CRYPTO-001",
  "status": "pending",
  "payment_method": "crypto",
  "asset_code": "USDT.TRC20",
  "network": "TRC20",
  "address": "TX…",
  "memo": null,
  "memo_type": null,
  "amount": 25,
  "currency": "USDT",
  "amount_usdt": 25,
  "credited_amount": 24.375,
  "fee_amount": 0.625,
  "credited_amount_usdt": 24.375,
  "fee_amount_usdt": 0.625,
  "fee_percent": 2.5,
  "expires_at": "2026-07-31T19:00:00Z"
}`} />
              </div>
            </div>

            <SubH>Exemple complet — afficher l'adresse, le memo et le QR</SubH>
            <p className="text-sm text-gray-700 mb-2 leading-relaxed">
              Installez une bibliothèque QR dans votre interface, par exemple{" "}
              <IC>npm install qrcode</IC>. Pour USDT/TRC20, le QR peut contenir directement l'adresse.
              Pour un réseau avec memo/tag, utilisez uniquement une URI officiellement supportée.
            </p>
            <CodeBlock language="javascript" code={`import QRCode from "qrcode";

async function showCryptoPayment(data) {
  // data vient de POST /v1/crypto/collect
  document.querySelector("#crypto-address").textContent = data.address;
  document.querySelector("#crypto-network").textContent = data.asset_code;
  document.querySelector("#crypto-amount").textContent =
    data.amount_usdt + " USDT";

  const memoBox = document.querySelector("#crypto-memo");
  if (data.memo) {
    memoBox.textContent = (data.memo_type || "Memo / tag") + " : " + data.memo;
    memoBox.hidden = false;
  } else {
    memoBox.hidden = true;
  }

  // USDT.TRC20 : QR avec l'adresse uniquement
  await QRCode.toCanvas(
    document.querySelector("#crypto-qr"),
    data.address,
    { width: 240, margin: 2, errorCorrectionLevel: "M" }
  );
}

// HTML : #crypto-amount, #crypto-network, #crypto-address,
//         #crypto-qr (canvas) et #crypto-memo`} />

            <div className="rounded border border-amber-300 bg-amber-50 p-4 mt-4 space-y-1">
              <p className="text-sm font-semibold text-amber-800">Important — memo / tag</p>
              <p className="text-sm text-amber-800 leading-relaxed">
                Ne concaténez jamais le memo à l'adresse. <IC>memo_required</IC> indique si le champ est obligatoire
                et <IC>memo_type</IC> précise <IC>memo</IC> ou <IC>tag</IC>.
                Un memo/tag manquant peut empêcher l'attribution du paiement.
                L'adresse est à usage unique pour cette transaction.
              </p>
            </div>

            <div className="rounded border border-red-300 bg-red-50 p-4 mt-4">
              <p className="text-sm font-semibold text-red-900 mb-1">Erreurs de création et diagnostic</p>
              <p className="text-sm text-red-800 leading-relaxed">
                Une réponse <IC>502 gateway_error</IC> signifie que l'adresse n'a pas pu être générée.
                <IC>provider_invalid_response</IC> signifie que le service a répondu sans adresse exploitable.
                Une réponse <IC>500 server_error</IC> contient un <IC>request_id</IC> : conservez-le pour le diagnostic.
              </p>
            </div>

            <div className="rounded border border-gray-200 bg-gray-50 p-4 mt-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">Après l'affichage : attendre la confirmation</p>
              <p className="text-sm text-gray-700 leading-relaxed">
                La création de l'adresse ne signifie pas que le paiement est confirmé. Gardez{" "}
                <IC>transaction_id</IC> et <IC>reference</IC>, attendez le webhook <IC>payment.completed</IC> ou{" "}
                <IC>payment.failed</IC>, et utilisez <IC>GET /v1/transaction/:id</IC> comme vérification complémentaire.
                Ne livrez jamais un produit avec le seul statut <IC>pending</IC>.
              </p>
            </div>

            <AuthSection />
          </section>

          {/* ──── PAYMENTS (collect) ──── */}
          <section id="collect" ref={el => sectionRefs.current.collect = el}>
            <SectionH>Initier un paiement</SectionH>

            <p className="text-[15px] text-gray-700 leading-relaxed mb-4">
              Initie un paiement Mobile Money via l'Ashtech Pay API. Le routage entre fournisseurs est automatique
              selon le pays et l'opérateur. Le client reçoit une demande de validation sur son téléphone
              (USSD, OTP ou Wave selon l'opérateur). Les frais sont configurés par l'administrateur
              et déduits automatiquement — le <IC>credited_amount</IC> correspond au montant net crédité
              sur votre compte. Consultez <IC>GET /v1/fees</IC> pour les frais actuels.
            </p>

            <EndpointRow method="POST" path="/v1/collect" />

            <SubH>Corps de la requête (JSON)</SubH>
            <DocTable>
              <DocThead cols={["Paramètre", "Type", "Statut", "Description"]} />
              <tbody>
                <DocTr cells={[<IC>amount</IC>, "number", <span className="text-green-700 font-semibold text-xs">Requis</span>, "Montant brut à collecter"]} />
                <DocTr cells={[<IC>currency</IC>, "string", <span className="text-green-700 font-semibold text-xs">Requis</span>, "Devise du pays (XAF, XOF, CDF…)"]} />
                <DocTr cells={[<IC>phone</IC>, "string", <span className="text-green-700 font-semibold text-xs">Requis</span>, "Numéro de téléphone du payeur"]} />
                <DocTr cells={[<IC>operator</IC>, "string", <span className="text-green-700 font-semibold text-xs">Requis</span>, "Nom exact de l'opérateur (depuis /v1/countries)"]} />
                <DocTr cells={[<IC>country_code</IC>, "string", <span className="text-green-700 font-semibold text-xs">Requis</span>, "Code ISO du pays (CM, SN, CI…)"]} />
                <DocTr cells={[<IC>reference</IC>, "string", <span className="text-gray-400 text-xs">Optionnel</span>, "Référence unique de votre commande. Obligatoire lors du retry OTP : renvoyer la valeur reçue dans la réponse 400."]} />
                <DocTr cells={[<IC>otp</IC>, "string", <span className="text-gray-400 text-xs">Optionnel</span>, "Code OTP reçu par SMS. Doit toujours être accompagné du champ reference (valeur reçue dans le 400 otp_required)."]} />
                <DocTr cells={[<IC>notify_url</IC>, "string", <span className="text-gray-400 text-xs">Optionnel</span>, "URL webhook pour recevoir le résultat du paiement"]} />
              </tbody>
            </DocTable>

            <AuthSection />

            <div className="grid lg:grid-cols-2 gap-5 mt-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Requête</p>
                <CodeBlock language="javascript" code={`fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XAF",
    phone: "670000000",
    operator: "MTN Money",
    country_code: "CM",
    reference: "ORDER-001",
    notify_url: "https://monsite.com/webhook"
  })
})`} />
                <CodeBlock language="bash" code={`curl https://ashtechpay.top/v1/collect \\
  -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "currency": "XAF",
    "phone": "670000000",
    "operator": "MTN Money",
    "country_code": "CM",
    "reference": "ORDER-001",
    "notify_url": "https://monsite.com/webhook"
  }'`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Réponse (202)</p>
                <CodeBlock language="json" code={`{
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-001",
  "status": "pending",
  "amount": 5000,
  "credited_amount": 4750,
  "fee_amount": 250,
  "currency": "XAF",
  "operator": "MTN Money",
  "phone": "670000000",
  "country_code": "CM",
  "created_at": "2026-03-15T14:00:00Z"
}`} />
              </div>
            </div>

            <div className="rounded border border-yellow-300 bg-yellow-50 p-4 mt-5 space-y-3">
              <p className="text-sm font-semibold text-yellow-800">OTP requis — deux variantes selon l'opérateur</p>
              <p className="text-sm text-yellow-800 leading-relaxed">
                Certains opérateurs nécessitent un code OTP. L'API retourne{" "}
                <IC>400 otp_required</IC> avec un champ <IC>reference</IC> et un champ <IC>ussd_code</IC>.
                Il existe deux variantes :{" "}
                <strong>OTP USSD</strong>{" "}
                (Orange CI, SN, BF — le client compose le code USSD affiché, l'OTP s'affiche dans le menu téléphonique,{" "}
                <em>aucun SMS n'est envoyé</em>) et{" "}
                <strong>OTP SMS</strong>{" "}
                (certains opérateurs — SMS déclenché automatiquement, <IC>ussd_code</IC> est null).
                Dans les deux cas, relancez la requête avec <IC>otp</IC> <strong>et</strong> <IC>reference</IC>.
              </p>
              <CodeBlock language="json" code={`// Étape 1 — Requête initiale (sans otp) → réponse 400
{
  "error": "otp_required",
  "reference": "DEP-A1B2C3D4",    // ← à conserver absolument !
  "ussd_code": "#144*391#",        // CI: "#144*82#", SN: "#144*391#", BF: "*144*4*6*5000#"
  // "ussd_code": null             // OTP SMS → SMS envoyé automatiquement
  "message": "OTP requis. Composez #144*391# sur votre téléphone pour obtenir votre code…"
}

// Étape 2 — Retry avec otp + reference
{
  "amount": 5000, "currency": "XOF", "phone": "77XXXXXXX",
  "operator": "Orange Money", "country_code": "SN",
  "otp": "123456",                 // ← code du menu USSD ou SMS
  "reference": "DEP-A1B2C3D4",    // ← obligatoire, même valeur que la réponse 400
  "notify_url": "https://monsite.com/webhook"
}
// → 202 pending → webhook payment.completed`} />
            </div>
          </section>

          {/* ──── FLUX DE PAIEMENT ──── */}
          <section id="flows" ref={el => sectionRefs.current.flows = el}>
            <SectionH>Flux de Paiement</SectionH>

            <p className="text-[15px] text-gray-700 leading-relaxed mb-5">
              Selon le pays et l'opérateur, l'API utilise automatiquement l'un des 4 flux ci-dessous.
              Votre code doit gérer chacun différemment car la réponse et les étapes varient.
            </p>

            <DocTable>
              <DocThead cols={["Flux", "Opérateurs concernés", "Réponse initiale", "Action requise"]} />
              <tbody>
                {[
                  {
                    name: "USSD Push", color: "text-blue-700",
                    ops: "MTN, Moov, Airtel, Orange, Free, E-money, T-Money, Flooz, M-Pesa, Afri Money…",
                    resp: "202 pending", rcolor: "text-green-700",
                    action: "Attendre le webhook. Le client valide directement sur son téléphone.",
                  },
                  {
                    name: "OTP USSD", color: "text-orange-700",
                    ops: "Orange Money CI (#144*82#), SN (#144*391#), BF (*144*4*6*montant#)",
                    resp: "400 otp_required  ussd_code: \"#144*82#\"", rcolor: "text-orange-700",
                    action: "Afficher le ussd_code au client — il compose, l'OTP s'affiche dans le menu USSD. Relancer avec otp + reference.",
                  },
                  {
                    name: "OTP SMS", color: "text-yellow-700",
                    ops: "Certains opérateurs — SMS envoyé automatiquement",
                    resp: "400 otp_required  ussd_code: null", rcolor: "text-orange-700",
                    action: "Le fournisseur envoie le SMS OTP. Relancer avec otp + reference.",
                  },
                  {
                    name: "Wave", color: "text-purple-700",
                    ops: "Wave (CI), Wave (SN)",
                    resp: "202 pending  flow: \"wave\", wave_url: \"...\"", rcolor: "text-purple-700",
                    action: "Afficher le wave_url en bouton ou QR code. Le client ouvre Wave pour confirmer.",
                  },
                ].map(f => (
                  <DocTr key={f.name} cells={[
                    <span className={`font-semibold text-sm ${f.color}`}>{f.name}</span>,
                    f.ops,
                    <code className={`font-mono text-xs whitespace-pre-line ${f.rcolor}`}>{f.resp}</code>,
                    f.action,
                  ]} />
                ))}
              </tbody>
            </DocTable>

            {/* Flow 1 */}
            <div className="rounded border border-blue-200 bg-blue-50 p-5 space-y-4 mt-6">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">1</span>
                <h3 className="font-bold text-blue-800">Flux USSD Push — La majorité des opérateurs</h3>
              </div>
              <p className="text-sm text-gray-700">
                Flux le plus simple. Le client reçoit une demande USSD sur son téléphone et valide en composant son PIN.
                Vous recevez la confirmation par webhook. <strong>Pas d'OTP à gérer côté merchant.</strong>
              </p>
              <div className="text-xs text-gray-600">
                <strong>Exemples :</strong>{" "}
                MTN (CM, BJ, CG, GN, CD), Moov (BJ, CI, BF, GA, ML, TG), Airtel (CG, GA, NE, CD, TD),
                Orange (CM), Free Money (SN), E-money (SN), T-Money (TG), Flooz (TG), Mpesa Money (CD), Afri Money (CD), Vodacom (CD)
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Requête</p>
                  <CodeBlock language="javascript" code={`// Orange Money Cameroun — flux USSD push
const res = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
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
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Réponse 202</p>
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

            {/* Flow 2 */}
            <div className="rounded border border-orange-200 bg-orange-50 p-5 space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white shrink-0">2</span>
                <h3 className="font-bold text-orange-800">Flux OTP USSD — Orange Money CI, SN, BF</h3>
              </div>
              <p className="text-sm text-gray-700">
                Pour Orange Money en Côte d'Ivoire, Sénégal et Burkina Faso. L'API retourne un <IC>ussd_code</IC>{" "}
                que le client compose depuis son téléphone — l'OTP s'affiche directement dans le menu USSD (pas de SMS envoyé).
              </p>
              <div className="text-xs text-gray-600">
                <strong>Codes USSD par pays :</strong>{" "}
                CI — <IC>#144*82#</IC> &nbsp;|&nbsp; SN — <IC>#144*391#</IC> &nbsp;|&nbsp; BF — <IC>*144*4*6*montant#</IC>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Étape 1 — Requête initiale (sans OTP)</p>
                  <CodeBlock language="javascript" code={`// Orange Money CI — étape 1 : sans OTP
const res = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
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
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Réponse 400 + Étape 2</p>
                  <CodeBlock language="json" code={`// Réponse 400 — CI :
{
  "error": "otp_required",
  "message": "OTP requis. Composez #144*82# …",
  "reference": "DEP-A1B2C3D4",
  "ussd_code": "#144*82#"
}

// Afficher le ussd_code au client :
// "Composez #144*82# sur votre téléphone"`} />
                  <CodeBlock language="javascript" code={`// Étape 2 : même requête + otp + reference
body: JSON.stringify({
  amount: 1000, currency: "XOF",
  phone: "0700000000",
  operator: "Orange Money",
  country_code: "CI",
  otp: "123456",
  reference: "DEP-A1B2C3D4", // ← obligatoire
  notify_url: "https://monsite.com/webhook"
})
// → 202 pending → webhook`} />
                </div>
              </div>
            </div>

            {/* Flow 3 */}
            <div className="rounded border border-yellow-200 bg-yellow-50 p-5 space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-white shrink-0">3</span>
                <h3 className="font-bold text-yellow-800">Flux OTP SMS — selon la configuration fournisseur</h3>
              </div>
              <p className="text-sm text-gray-700">
                Pour certains opérateurs, l'API déclenche automatiquement l'envoi d'un SMS OTP
                au numéro du client — <strong>aucun code USSD à composer.</strong>{" "}
                Le champ <IC>ussd_code</IC> est <code className="font-mono text-red-600">null</code>.
              </p>
              <div className="grid lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Étape 1 — Requête initiale (sans OTP)</p>
                  <CodeBlock language="javascript" code={`// Opérateur OTP SMS — étape 1
const res = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XOF",
    phone: "04000000",
    operator: "Orange Money",
    country_code: "BF",
    notify_url: "https://monsite.com/webhook"
  })
});
// → 400 otp_required
// ussd_code est null — SMS envoyé automatiquement`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Réponse 400 + Étape 2</p>
                  <CodeBlock language="json" code={`// Réponse 400 :
{
  "error": "otp_required",
  "message": "OTP requis. Un code a été envoyé par SMS.",
  "reference": "DEP-X9Y8Z7W6",
  "ussd_code": null
}

// Le client reçoit son OTP par SMS
// Étape 2 : relancer avec otp + reference`} />
                  <CodeBlock language="javascript" code={`// Étape 2 : même requête + otp + reference
body: JSON.stringify({
  amount: 5000, currency: "XOF",
  phone: "04000000",
  operator: "Orange Money",
  country_code: "BF",
  otp: "456789",
  reference: "DEP-X9Y8Z7W6", // ← obligatoire
  notify_url: "https://monsite.com/webhook"
})
// → 202 pending → webhook`} />
                </div>
              </div>
            </div>

            {/* Flow 4 */}
            <div className="rounded border border-purple-200 bg-purple-50 p-5 space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">4</span>
                <h3 className="font-bold text-purple-800">Flux Wave — Côte d'Ivoire et Sénégal</h3>
              </div>
              <p className="text-sm text-gray-700">
                Pour Wave CI et Wave SN. L'API retourne directement un <IC>wave_url</IC> dans la réponse 202.
                Votre interface doit afficher ce lien (bouton ou QR code) pour que le client l'ouvre dans son application Wave.
                <strong> Pas d'OTP.</strong> Le numéro de téléphone n'est pas requis pour Wave.
              </p>
              <div className="grid lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Requête</p>
                  <CodeBlock language="javascript" code={`// Wave Côte d'Ivoire
const res = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 2000,
    currency: "XOF",
    phone: "0700000000",  // facultatif pour Wave
    operator: "Wave Money",
    country_code: "CI",
    notify_url: "https://monsite.com/webhook"
  })
});

const data = await res.json();
if (data.flow === "wave") {
  window.open(data.wave_url, "_blank");
}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Réponse 202</p>
                  <CodeBlock language="json" code={`{
  "transaction_id": "xyz-789",
  "status": "pending",
  "amount": 2000,
  "credited_amount": 1910,
  "fee_amount": 90,
  "currency": "XOF",
  "operator": "Wave Money",
  "country_code": "CI",
  "flow": "wave",
  "wave_url": "https://pay.wave.com/m/..."
}

// → Afficher wave_url comme bouton "Payer avec Wave"
// → Le client ouvre l'app Wave et confirme
// → Webhook payment.completed envoyé`} />
                </div>
              </div>
            </div>

            <SubH>Comment détecter le bon flux dans votre code</SubH>
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
      // ─── Flux OTP USSD : code USSD à composer ─────────────────
      return { type: "otp_ussd", ussdCode: data.ussd_code, reference: data.reference };
    } else {
      // ─── Flux OTP SMS : SMS envoyé automatiquement ────────────
      return { type: "otp_sms", reference: data.reference };
    }
  }

  throw new Error(data.message);
}`} />

            <AuthSection />
          </section>

          {/* ──── STATUT D'UNE TRANSACTION ──── */}
          <section id="transaction" ref={el => sectionRefs.current.transaction = el}>
            <SectionH>Statut d'une Transaction</SectionH>

            <p className="text-[15px] text-gray-700 leading-relaxed mb-4">
              Consultez le statut d'une transaction à tout moment via le{" "}
              <IC>transaction_id</IC> retourné lors de l'initiation. Utilisez ce endpoint en complément du webhook.
            </p>

            <EndpointRow method="GET" path="/v1/transaction/:id" />

            <div className="grid lg:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Requête</p>
                <CodeBlock language="javascript" code={`fetch(
  "https://ashtechpay.top/v1/transaction/8f3e1c2d-...",
  {
    headers: {
      "Authorization": "Bearer YOUR_API_KEY"
    }
  }
)`} />
                <CodeBlock language="bash" code={`curl https://ashtechpay.top/v1/transaction/8f3e1c2d-... \\
  -H "Authorization: Bearer YOUR_API_KEY"`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Réponse</p>
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

            <SubH>Statuts possibles</SubH>
            <DocTable>
              <DocThead cols={["Statut", "Description", "Final ?"]} />
              <tbody>
                {[
                  { status: "pending", color: "text-yellow-700", desc: "En attente de confirmation de l'opérateur", final: false },
                  { status: "success", color: "text-green-700",  desc: "Paiement confirmé — compte marchand crédité", final: true  },
                  { status: "failed",  color: "text-red-700",    desc: "Paiement refusé, expiré ou annulé",           final: true  },
                ].map(({ status, color, desc, final }) => (
                  <DocTr key={status} cells={[
                    <span className={`font-mono font-semibold text-sm ${color}`}>{status}</span>,
                    desc,
                    final
                      ? <span className="text-green-700 font-semibold text-xs">Oui</span>
                      : <span className="text-gray-400 text-xs">Non</span>,
                  ]} />
                ))}
              </tbody>
            </DocTable>

            <AuthSection />
          </section>

          {/* ──── GRILLE TARIFAIRE ──── */}
          <section id="fees" ref={el => sectionRefs.current.fees = el}>
            <SectionH>Grille Tarifaire</SectionH>

            <p className="text-[15px] text-gray-700 leading-relaxed mb-4">
              Retourne la grille tarifaire en vigueur pour chaque pays actif.
            </p>

            <EndpointRow method="GET" path="/v1/fees" />

            <div className="grid lg:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Requête</p>
                <CodeBlock language="javascript" code={`fetch("https://ashtechpay.top/v1/fees", {
  headers: {
    "Authorization": "Bearer YOUR_API_KEY"
  }
})`} />
                <CodeBlock language="bash" code={`curl https://ashtechpay.top/v1/fees \\
  -H "Authorization: Bearer YOUR_API_KEY"`} />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Réponse</p>
                <CodeBlock language="json" code={`[
  {
    "country_code": "CM",
    "country_name": "Cameroun",
    "currency": "XAF",
    "total_fee_pct": 5.5,
    "ashtech_margin_pct": 2.0,
    "operators": ["MTN Money", "Orange Money"]
  },
  {
    "country_code": "SN",
    "country_name": "Sénégal",
    "currency": "XOF",
    "total_fee_pct": 5.0,
    "ashtech_margin_pct": 2.0,
    "operators": ["E-money", "Free Money", "Orange Money", "Wave Money"]
  }
  // ...un objet par pays actif
]`} />
              </div>
            </div>

            <SubH>Champs de la réponse</SubH>
            <DocTable>
              <DocThead cols={["Champ", "Type", "Description"]} />
              <tbody>
                {[
                  { name: "country_code",       type: "string",   desc: "Code ISO du pays (CM, SN, CI…)" },
                  { name: "country_name",       type: "string",   desc: "Nom complet du pays" },
                  { name: "currency",           type: "string",   desc: "Devise principale (XAF, XOF, CDF…)" },
                  { name: "total_fee_pct",      type: "number",   desc: "Frais totaux en % appliqués au montant (ex: 5.5 = 5,5%)" },
                  { name: "ashtech_margin_pct", type: "number",   desc: "Part Ashtech Pay dans les frais totaux" },
                  { name: "operators",          type: "string[]", desc: "Opérateurs disponibles pour ce pays" },
                ].map(({ name, type, desc }) => (
                  <DocTr key={name} cells={[<IC>{name}</IC>, <IC>{type}</IC>, desc]} />
                ))}
              </tbody>
            </DocTable>

            <SubH>Exemple — calculer le montant net avant d'appeler /v1/collect</SubH>
            <CodeBlock language="javascript" code={`// Récupérer les frais en cache (une fois au démarrage ou toutes les heures)
const fees = await fetch("https://ashtechpay.top/v1/fees", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
}).then(r => r.json());

function getFeeForCountry(countryCode) {
  return fees.find(f => f.country_code === countryCode);
}

function computeNet(grossAmount, countryCode) {
  const fee = getFeeForCountry(countryCode);
  if (!fee) return grossAmount;
  const feeAmount = Math.round(grossAmount * fee.total_fee_pct / 100);
  return {
    gross: grossAmount,
    fee: feeAmount,
    net: grossAmount - feeAmount,
    fee_pct: fee.total_fee_pct,
  };
}

// Exemple :
console.log(computeNet(10000, "CM"));
// → { gross: 10000, fee: 550, net: 9450, fee_pct: 5.5 }`} />

            <AuthSection />
          </section>

          {/* ──── WEBHOOKS ──── */}
          <section id="webhooks" ref={el => sectionRefs.current.webhooks = el}>
            <SectionH>Webhooks</SectionH>

            <p className="text-[15px] text-gray-700 leading-relaxed mb-5">
              Quand une transaction atteint un état final, Ashtech Pay envoie automatiquement une requête{" "}
              <IC>POST</IC> à la <IC>notify_url</IC> que vous avez passée dans votre appel à{" "}
              <IC>/v1/collect</IC>. Le champ <IC>amount</IC> correspond au montant net après frais,
              et <IC>total_amount</IC> au montant brut collecté.
            </p>

            <div className="grid lg:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Payload — paiement réussi</p>
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
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Payload — paiement échoué</p>
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

            <SubH>Événements disponibles</SubH>
            <DocTable>
              <DocThead cols={["Événement", "Déclencheur"]} />
              <tbody>
                {[
                  { event: "payment.completed", desc: "Paiement (dépôt) confirmé avec succès" },
                  { event: "payment.failed",    desc: "Paiement refusé, expiré ou annulé" },
                  { event: "payout.completed",  desc: "Retrait ou virement sortant confirmé" },
                  { event: "payout.failed",     desc: "Retrait ou virement échoué" },
                ].map(({ event, desc }) => (
                  <DocTr key={event} cells={[<IC>{event}</IC>, desc]} />
                ))}
              </tbody>
            </DocTable>

            <SubH>Handler (Node.js / Express)</SubH>
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

            <div className="rounded border border-blue-200 bg-blue-50 p-4 mt-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Bonnes pratiques</p>
              <ul className="space-y-1.5 text-sm text-blue-800">
                {[
                  "Répondez toujours HTTP 200 immédiatement pour accuser réception",
                  "Traitez la logique métier après avoir répondu 200 (asynchrone)",
                  "Vérifiez le transaction_id dans votre base pour éviter les doublons",
                  "Le webhook est complémentaire à GET /v1/transaction/:id — utilisez les deux",
                  "Votre notify_url doit être une URL HTTPS publique (pas localhost)",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-blue-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <AuthSection />
          </section>

          {/* ──── STATUS CODES ──── */}
          <section id="errors" ref={el => sectionRefs.current.errors = el}>
            <SectionH>STATUS CODES</SectionH>

            <p className="text-[15px] text-gray-700 leading-relaxed mb-5">
              Ce tableau présente les différents codes de statut HTTP et leurs messages correspondants
              liés aux résultats des transactions utilisés par <strong>Ashtech Pay</strong>.
              Il indique si une transaction a été traitée avec succès, a échoué ou est toujours en attente,
              ainsi que les raisons spécifiques des échecs.
            </p>

            <DocTable>
              <DocThead cols={["Code", "Status", "Message"]} />
              <tbody>
                {[
                  { code: "200", status: "SUCCESS",  bold: true,  msg: "Transaction successfully processed" },
                  { code: "200", status: "FAILED",   bold: true,  msg: "Transaction Failed" },
                  { code: "200", status: "PENDING",  bold: true,  msg: "Transaction in process" },
                  { code: "400", status: "FAILED",   bold: false, msg: "Bad Request — paramètre manquant ou format invalide" },
                  { code: "400", status: "FAILED",   bold: false, msg: "otp_required — OTP requis, conservez le champ reference" },
                  { code: "400", status: "FAILED",   bold: false, msg: "missing_reference — confirmation OTP sans reference" },
                  { code: "400", status: "FAILED",   bold: false, msg: "otp_expired — session OTP expirée, relancez sans otp" },
                  { code: "401", status: "FAILED",   bold: false, msg: "invalid credentials — clé API manquante ou révoquée" },
                  { code: "403", status: "FAILED",   bold: false, msg: "Unauthorized — transaction n'appartient pas à votre compte" },
                  { code: "404", status: "FAILED",   bold: false, msg: "Not Found — transaction introuvable" },
                  { code: "405", status: "FAILED",   bold: false, msg: "Method Not Allowed" },
                  { code: "408", status: "FAILED",   bold: false, msg: "Request Timeout" },
                  { code: "422", status: "FAILED",   bold: false, msg: "Pays ou opérateur non supporté / devise incorrecte" },
                  { code: "429", status: "FAILED",   bold: false, msg: "Too Many Requests — ralentissez" },
                  { code: "502", status: "FAILED",   bold: false, msg: "gateway_error — réseau de l'opérateur a rejeté le paiement" },
                  { code: "500", status: "FAILED",   bold: false, msg: "server_error — erreur interne, réessayez" },
                ].map((r, i) => (
                  <DocTr key={i} cells={[
                    <span className="font-mono font-semibold text-gray-800">{r.code}</span>,
                    <span className={r.bold ? "font-bold text-gray-900" : "text-gray-700"}>{r.status}</span>,
                    r.msg,
                  ]} />
                ))}
              </tbody>
            </DocTable>

            <CodeBlock language="json" code={`{
  "error": "bad_request",
  "message": "Champs requis : amount, currency, phone, operator, country_code"
}`} />

            <div className="rounded border border-gray-200 bg-gray-50 p-4 mt-4 text-sm text-gray-700">
              Pour toute question technique non résolue par cette documentation, contactez notre équipe via{" "}
              <Link href="/dashboard/support" className="text-primary hover:underline font-medium">le support</Link>.
            </div>
          </section>

          {/* ──── SANDBOX & TESTS ──── */}
          <section id="sandbox" ref={el => sectionRefs.current.sandbox = el}>
            <SectionH>Sandbox &amp; Tests</SectionH>

            <p className="text-[15px] text-gray-700 leading-relaxed mb-5">
              En sandbox, les paiements ne sont pas réels. Utilisez les numéros et codes OTP ci-dessous pour simuler chaque scénario.
              La logique de gestion des flux (OTP USSD, OTP SMS, Wave, USSD Push) est identique en production.
            </p>

            <SubH>Numéros de test — sandbox uniquement</SubH>
            <p className="text-sm text-gray-600 mb-3">
              Envoyez ces numéros <strong>avec le préfixe pays</strong> dans le champ <IC>phone</IC> de <IC>/v1/collect</IC>.
              Le résultat dépend du numéro choisi (SUCCESS / PENDING / FAILED).
            </p>

            <DocTable>
              <DocThead cols={["Pays", "Devise", "Numéro → SUCCESS", "Numéro → PENDING", "Numéro → FAILED"]} />
              <tbody>
                {[
                  { country: "CI — Côte d'Ivoire", cur: "XOF", ok: "2252100000001", pend: "2252100000002", fail: "2252100000003" },
                  { country: "CM — Cameroun",       cur: "XAF", ok: "237660000001",  pend: "237660000002",  fail: "237660000003"  },
                  { country: "SN — Sénégal",        cur: "XOF", ok: "221700000001",  pend: "221700000002",  fail: "221700000003"  },
                  { country: "BF — Burkina Faso",   cur: "XOF", ok: "22660000001",   pend: "22660000002",   fail: "22660000003"   },
                  { country: "CD — RD Congo",       cur: "CDF", ok: "243120000011",  pend: "243120000012",  fail: "243120000013"  },
                  { country: "CD — RD Congo",       cur: "USD", ok: "243120000001",  pend: "243120000002",  fail: "243120000003"  },
                ].map(({ country, cur, ok, pend, fail }, i) => (
                  <DocTr key={i} cells={[
                    country,
                    <IC>{cur}</IC>,
                    <span className="font-mono text-green-700 text-xs">{ok}</span>,
                    <span className="font-mono text-yellow-700 text-xs">{pend}</span>,
                    <span className="font-mono text-red-600 text-xs">{fail}</span>,
                  ]} />
                ))}
              </tbody>
            </DocTable>
            <p className="text-xs text-gray-500 mt-2">
              ⚠️ BJ, GA, ML, NE, TG — utilisez des numéros fictifs commençant par le préfixe pays (ex : <IC>22960000001</IC> pour BJ).
            </p>

            <div className="rounded border border-orange-200 bg-orange-50 p-5 space-y-3 mt-6">
              <p className="text-sm font-semibold text-orange-800">Codes OTP de test (sandbox)</p>
              <p className="text-sm text-orange-800">
                En sandbox, utilisez le code OTP <strong>123456</strong> pour simuler un paiement réussi.
                Tout autre code simule un OTP invalide/refusé.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <CodeBlock language="json" code={`// ✅ OTP valide sandbox → succès garanti
{ "otp": "123456" }

// ❌ OTP invalide sandbox → échec simulé
{ "otp": "000000" }
{ "otp": "111111" }`} />
                <CodeBlock language="javascript" code={`// Exemple complet — OTP USSD Orange CI (sandbox)
// Numéro test CI XOF : 2252100000001 → SUCCESS
const step1 = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
  body: JSON.stringify({
    amount: 5000, currency: "XOF",
    phone: "2252100000001",
    operator: "Orange Money", country_code: "CI",
    notify_url: "https://monsite.com/webhook"
  })
});
// step1 → 400 { error: "otp_required", ussd_code: "#144*82#", reference: "DEP-..." }

const step2 = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
  body: JSON.stringify({
    amount: 5000, currency: "XOF",
    phone: "2252100000001", operator: "Orange Money", country_code: "CI",
    otp: "123456",
    reference: "DEP-...", // ← obligatoire
    notify_url: "https://monsite.com/webhook"
  })
});
// step2 → 202 pending → webhook payment.completed`} />
              </div>
            </div>

            <div className="rounded border border-yellow-200 bg-yellow-50 p-5 space-y-2 mt-4">
              <p className="text-sm font-semibold text-yellow-800">Expiration OTP</p>
              <ul className="space-y-1.5 text-sm text-yellow-800">
                {[
                  "La session OTP est valide 15 minutes après la réponse 400 otp_required",
                  "Si le délai est dépassé, l'API retourne 400 otp_expired — relancez la requête sans otp pour démarrer une nouvelle session",
                  "Un même code OTP ne peut être utilisé qu'une seule fois (protection anti-rejeu)",
                  "Pour Orange BF, le code USSD contient le montant exact : *144*4*6*5000# pour 5000 XOF",
                  "Ne stockez jamais le code OTP côté serveur — il doit être saisi directement par le client",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-yellow-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded border border-purple-200 bg-purple-50 p-5 space-y-2 mt-4">
              <p className="text-sm font-semibold text-purple-800">Test Wave en sandbox</p>
              <p className="text-sm text-purple-800">
                En sandbox, le <IC>wave_url</IC> retourné est une URL Wave de test.
                Ouvrez-la dans un navigateur pour simuler l'approbation ou le refus du paiement.
                Le webhook <IC>payment.completed</IC> ou <IC>payment.failed</IC>{" "}
                est envoyé automatiquement après la simulation.
              </p>
            </div>

            <div className="mt-6">
              <Link href="/docs/test-pay">
                <Button className="gap-2" data-testid="link-test-payment-sandbox">
                  <FlaskConical className="w-4 h-4" />
                  Ouvrir le Sandbox interactif
                </Button>
              </Link>
            </div>
          </section>

          <div className="h-20" />
        </main>
      </div>
    </div>
  );
}
