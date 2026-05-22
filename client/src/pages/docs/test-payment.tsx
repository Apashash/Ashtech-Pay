import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Terminal, Code2, Zap, Eye, EyeOff,
  Copy, CheckCheck, ExternalLink, Loader2,
  CheckCircle2, AlertCircle, BookOpen, FlaskConical,
  Play, RotateCcw, ChevronRight,
} from "lucide-react";

const ALL_COUNTRIES = [
  { code: "BJ", name: "Bénin",              currency: "XOFB", operators: ["Moov Money", "MTN Mobile Money"],                              otpOps: ["Orange Money"] },
  { code: "BF", name: "Burkina Faso",        currency: "XOFF", operators: ["Moov Money", "Orange Money"],                                  otpOps: ["Orange Money"] },
  { code: "CM", name: "Cameroun",            currency: "XAF",  operators: ["MTN Mobile Money", "Orange Money"],                            otpOps: [] },
  { code: "CF", name: "Centrafrique",        currency: "XAF",  operators: ["Orange Money"],                                                otpOps: ["Orange Money"] },
  { code: "CG", name: "Congo",               currency: "XAFC", operators: ["Airtel Money", "MTN Mobile Money"],                           otpOps: [] },
  { code: "CI", name: "Côte d'Ivoire",       currency: "XOFC", operators: ["Moov Money", "MTN Mobile Money", "Orange Money", "Wave"],     otpOps: ["Orange Money"] },
  { code: "GA", name: "Gabon",               currency: "XAFG", operators: ["Airtel Money", "Moov Money"],                                 otpOps: [] },
  { code: "GN", name: "Guinée Conakry",      currency: "GNF",  operators: ["MTN Mobile Money", "Orange Money"],                          otpOps: ["Orange Money"] },
  { code: "GQ", name: "Guinée équatoriale",  currency: "XAF",  operators: ["Orange Money"],                                               otpOps: ["Orange Money"] },
  { code: "GW", name: "Guinée-Bissau",       currency: "XOF",  operators: ["Orange Money"],                                               otpOps: ["Orange Money"] },
  { code: "ML", name: "Mali",                currency: "XOF",  operators: ["Moov Money", "Orange Money"],                                 otpOps: ["Orange Money"] },
  { code: "NE", name: "Niger",               currency: "XOFN", operators: ["Airtel Money"],                                               otpOps: [] },
  { code: "CD", name: "RD Congo",            currency: "CDF",  operators: ["Afrimoney", "Airtel Money", "Orange Money", "Vodacom M-Pesa"],otpOps: ["Orange Money"] },
  { code: "SN", name: "Sénégal",             currency: "XOFS", operators: ["Free Money", "Orange Money", "Wave"],                        otpOps: ["Orange Money"] },
  { code: "TD", name: "Tchad",               currency: "XAF",  operators: ["Airtel Money", "Moov Money"],                                otpOps: [] },
  { code: "TG", name: "Togo",                currency: "XOFT", operators: ["Flooz (Moov)", "T-Money"],                                   otpOps: [] },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function NativeSelect({ value, onChange, disabled, placeholder, children }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
  placeholder: string; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
    >
      <option value="" disabled className="bg-white">{placeholder}</option>
      {children}
    </select>
  );
}

function StatusBadge({ status }: { status: number }) {
  const ok = status >= 200 && status < 300;
  const warn = status === 400;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-md border ${
      ok   ? "text-emerald-600 border-emerald-300 bg-emerald-50" :
      warn ? "text-amber-600 border-amber-300 bg-amber-50" :
             "text-red-600 border-red-300 bg-red-50"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-red-500"}`} />
      {status}
    </span>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-zinc-600" />
          <span className="text-[11px] font-mono text-zinc-400 tracking-wide">RESPONSE</span>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          {copied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed whitespace-pre max-h-80 overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

// ─── SDK Mode ─────────────────────────────────────────────────────────────────
function SDKForm() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [operator, setOperator] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otpRequired, setOtpRequired] = useState(false);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  const selectedCountry = ALL_COUNTRIES.find(c => c.code === countryCode);
  const operators = selectedCountry?.operators ?? [];
  const requiresOtp = selectedCountry?.otpOps.includes(operator) ?? false;

  function reset() {
    setCountryCode(""); setOperator(""); setAmount(""); setPhone("");
    setReference(""); setNotifyUrl(""); setResponse(null); setError(null);
    setOtpRequired(false); setUssdCode(null); setOtp("");
  }

  async function submit(otpValue?: string) {
    if (!apiKey.trim()) { setError("Clé API manquante."); return; }
    if (!countryCode || !operator || !amount || Number(amount) <= 0 || !phone.trim()) {
      setError("Veuillez remplir tous les champs obligatoires."); return;
    }
    const payload: Record<string, unknown> = {
      amount: Number(amount),
      currency: selectedCountry?.currency ?? "",
      phone, operator, country_code: countryCode,
    };
    if (reference.trim()) payload.reference = reference.trim();
    if (notifyUrl.trim()) payload.notify_url = notifyUrl.trim();
    if (otpValue) payload.otp = otpValue;

    setLoading(true); setError(null); setResponse(null);
    try {
      const res = await fetch("/v1/collect", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResponse({ status: res.status, data });
      if (res.status === 400 && (data as any).error === "otp_required") {
        setOtpRequired(true); setUssdCode((data as any).ussd_code ?? null);
      } else {
        setOtpRequired(false);
      }
    } catch (e: any) { setError("Erreur réseau : " + e.message); }
    finally { setLoading(false); }
  }

  async function submitOtp() {
    if (!otp.trim()) return;
    await submit(otp.trim()); setOtp("");
  }

  const isSuccess = response?.status === 202;
  const isWave = isSuccess && (response!.data as any)?.flow === "wave";
  const waveUrl = isWave ? (response!.data as any)?.wave_url : null;

  return (
    <div className="grid lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
      {/* Left: Form */}
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Paramètres</p>
          <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <RotateCcw className="w-3 h-3" /> Réinitialiser
          </button>
        </div>

        <Field label="Clé API" hint="Clé Bearer — utilisée uniquement côté serveur.">
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="ak_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="bg-white border-gray-300 text-gray-900 pr-10 font-mono text-xs placeholder:text-gray-400"
              data-testid="input-sdk-api-key"
            />
            <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </Field>

        <div className="h-px bg-gray-100" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Pays">
            <NativeSelect value={countryCode} onChange={v => { setCountryCode(v); setOperator(""); setResponse(null); setError(null); }} placeholder="Sélectionner…">
              {ALL_COUNTRIES.map(c => (
                <option key={c.code} value={c.code} className="bg-white">{c.name} · {c.currency}</option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Opérateur" hint={requiresOtp ? "⚡ OTP requis" : undefined}>
            <NativeSelect value={operator} onChange={setOperator} disabled={!countryCode} placeholder="Sélectionner…">
              {operators.map(op => <option key={op} value={op} className="bg-white">{op}</option>)}
            </NativeSelect>
          </Field>

          <Field label="Montant" hint={selectedCountry ? selectedCountry.currency : undefined}>
            <Input
              type="number" placeholder="5000"
              value={amount} onChange={e => setAmount(e.target.value)}
              className="bg-white border-gray-300 text-gray-900"
              data-testid="input-sdk-amount"
            />
          </Field>

          <Field label="Téléphone" hint="Sans indicatif pays.">
            <Input
              type="tel" placeholder={countryCode === "CM" ? "670000000" : "77000000"}
              value={phone} onChange={e => setPhone(e.target.value)}
              className="bg-white border-gray-300 text-gray-900"
              data-testid="input-sdk-phone"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Référence (optionnel)">
            <Input placeholder="ORDER-001" value={reference} onChange={e => setReference(e.target.value)}
              className="bg-white border-gray-300 text-gray-900 text-xs" data-testid="input-sdk-reference" />
          </Field>
          <Field label="Webhook URL (optionnel)">
            <Input placeholder="https://…/webhook" value={notifyUrl} onChange={e => setNotifyUrl(e.target.value)}
              className="bg-white border-gray-300 text-gray-900 text-xs" data-testid="input-sdk-notify-url" />
          </Field>
        </div>

        {error && (
          <div className="flex gap-2 items-start rounded-lg border border-red-300 bg-red-50 p-3">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {!otpRequired ? (
          <Button onClick={() => submit()} disabled={loading} className="w-full gap-2" data-testid="button-sdk-submit">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? "Envoi en cours…" : "Envoyer la requête"}
          </Button>
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">!</span>
              <p className="text-xs font-semibold text-amber-700">OTP requis</p>
            </div>
            {ussdCode ? (
              <p className="text-xs text-gray-600">Composez <code className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-mono">{ussdCode}</code> pour recevoir l'OTP.</p>
            ) : (
              <p className="text-xs text-gray-600">Le client a reçu un SMS avec son code OTP.</p>
            )}
            <div className="flex gap-2">
              <Input placeholder="Code OTP" value={otp} onChange={e => setOtp(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitOtp()}
                className="bg-white border-gray-300 text-gray-900 font-mono tracking-widest flex-1 text-sm"
                data-testid="input-sdk-otp" />
              <Button onClick={submitOtp} disabled={loading} className="shrink-0 gap-1.5" data-testid="button-sdk-submit-otp">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Valider"}
              </Button>
            </div>
            <button onClick={() => { setOtpRequired(false); setResponse(null); }} className="text-[11px] text-gray-400 hover:text-gray-600 underline">
              Recommencer
            </button>
          </div>
        )}
      </div>

      {/* Right: Response panel */}
      <div className="p-6 space-y-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Réponse</p>
          {response && <StatusBadge status={response.status} />}
        </div>

        {!response && !loading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
            <div className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xs text-gray-400">Remplissez le formulaire et cliquez sur<br />"Envoyer la requête" pour voir la réponse.</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-gray-500">Connexion à l'API…</p>
          </div>
        )}

        {response && (
          <div className="space-y-3">
            {isWave && waveUrl && (
              <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3">
                <span className="text-lg shrink-0">🌊</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-purple-700">Lien Wave généré</p>
                  <p className="text-[11px] text-gray-500 truncate">{waveUrl}</p>
                </div>
                <a href={waveUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-500 gap-1 text-xs shrink-0" data-testid="button-open-wave-url">
                    Ouvrir <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            )}
            {isSuccess && !isWave && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-700">Paiement initié. Le client valide sur son téléphone.</p>
              </div>
            )}
            <JsonBlock data={response.data} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hosted Page Mode ─────────────────────────────────────────────────────────
function HostedPageForm() {
  const [pkKey, setPkKey] = useState("");
  const [skKey, setSkKey] = useState("");
  const [hpKey, setHpKey] = useState("");
  const [showPk, setShowPk] = useState(false);
  const [showSk, setShowSk] = useState(false);
  const [showHp, setShowHp] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isFixedAmount, setIsFixedAmount] = useState(true);
  const [notifyUrl, setNotifyUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const selectedCountry = ALL_COUNTRIES.find(c => c.code === countryCode);
  const currency = selectedCountry?.currency ?? "";

  function reset() {
    setCountryCode(""); setAmount(""); setDescription(""); setNotifyUrl("");
    setResponse(null); setError(null);
  }

  async function submit() {
    if (!hpKey.trim()) { setError("Clé hp_live_ manquante."); return; }
    if (!currency) { setError("Sélectionnez un pays pour la devise."); return; }
    if (isFixedAmount && (!amount || Number(amount) <= 0)) { setError("Entrez un montant valide."); return; }

    const payload: Record<string, unknown> = { currency, is_fixed_amount: isFixedAmount };
    if (isFixedAmount) payload.amount = Number(amount);
    if (description.trim()) payload.description = description.trim();
    if (notifyUrl.trim()) payload.notify_url = notifyUrl.trim();

    setLoading(true); setError(null); setResponse(null);
    try {
      const res = await fetch("/api/v1/hosted-payment/create", {
        method: "POST",
        headers: { "Authorization": `Bearer ${hpKey.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResponse({ status: res.status, data });
    } catch (e: any) { setError("Erreur réseau : " + e.message); }
    finally { setLoading(false); }
  }

  const isSuccess = response?.status === 200;
  const paymentLink = isSuccess ? (response!.data as any)?.payment_link : null;

  return (
    <div className="grid lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
      {/* Left: Form */}
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Paramètres</p>
          <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <RotateCcw className="w-3 h-3" /> Réinitialiser
          </button>
        </div>

        {/* 3 API Keys */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Vos 3 clés API</p>

          <Field label="Clé Publique (pk_live_)" hint="Frontend JS — identifie votre compte côté client.">
            <div className="relative">
              <Input
                type={showPk ? "text" : "password"}
                placeholder="pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={pkKey}
                onChange={e => setPkKey(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 pr-10 font-mono text-xs placeholder:text-gray-400"
                data-testid="input-hp-pk-key"
              />
              <button type="button" onClick={() => setShowPk(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPk ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </Field>

          <Field label="Clé Secrète (sk_live_)" hint="Backend uniquement — webhooks et remboursements.">
            <div className="relative">
              <Input
                type={showSk ? "text" : "password"}
                placeholder="sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={skKey}
                onChange={e => setSkKey(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 pr-10 font-mono text-xs placeholder:text-gray-400"
                data-testid="input-hp-sk-key"
              />
              <button type="button" onClick={() => setShowSk(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showSk ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </Field>

          <Field label="Clé Hosted Page (hp_live_) ★" hint="Requise pour créer des liens de paiement via API.">
            <div className="relative">
              <Input
                type={showHp ? "text" : "password"}
                placeholder="hp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={hpKey}
                onChange={e => setHpKey(e.target.value)}
                className="bg-white border-primary/40 text-gray-900 pr-10 font-mono text-xs placeholder:text-gray-400 ring-1 ring-primary/20"
                data-testid="input-hp-key"
              />
              <button type="button" onClick={() => setShowHp(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showHp ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </Field>
        </div>

        <div className="h-px bg-gray-100" />

        {/* Fixed / Free toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg border border-gray-200">
          {[
            { val: true,  label: "Prix fixe",  sub: "Vous définissez le montant" },
            { val: false, label: "Prix libre", sub: "Le client choisit" },
          ].map(({ val, label, sub }) => (
            <button key={String(val)} onClick={() => setIsFixedAmount(val)}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                isFixedAmount === val ? "bg-primary text-primary-foreground shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`button-hp-mode-${val ? "fixed" : "free"}`}>
              <span className="block">{label}</span>
              <span className="block text-[10px] font-normal opacity-70">{sub}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Pays" hint={currency ? `Devise : ${currency}` : "Détermine la devise."}>
            <NativeSelect value={countryCode} onChange={setCountryCode} placeholder="Sélectionner…">
              {ALL_COUNTRIES.map(c => (
                <option key={c.code} value={c.code} className="bg-white">{c.name} · {c.currency}</option>
              ))}
            </NativeSelect>
          </Field>

          {isFixedAmount && (
            <Field label="Montant" hint={currency || undefined}>
              <Input type="number" placeholder="5000" value={amount} onChange={e => setAmount(e.target.value)}
                className="bg-white border-gray-300 text-gray-900" data-testid="input-hp-amount" />
            </Field>
          )}
        </div>

        <Field label="Description (optionnel)" hint="Affichée sur la page de checkout.">
          <Input placeholder="ex : Abonnement Premium" value={description} onChange={e => setDescription(e.target.value)}
            className="bg-white border-gray-300 text-gray-900" data-testid="input-hp-description" />
        </Field>

        <Field label="Webhook URL (optionnel)">
          <Input placeholder="https://…/webhook" value={notifyUrl} onChange={e => setNotifyUrl(e.target.value)}
            className="bg-white border-gray-300 text-gray-900 text-xs" data-testid="input-hp-notify-url" />
        </Field>

        {error && (
          <div className="flex gap-2 items-start rounded-lg border border-red-300 bg-red-50 p-3">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <Button onClick={submit} disabled={loading} className="w-full gap-2" data-testid="button-hp-submit">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? "Génération…" : "Générer le lien de paiement"}
        </Button>
      </div>

      {/* Right: Response panel */}
      <div className="p-6 space-y-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Réponse</p>
          {response && <StatusBadge status={response.status} />}
        </div>

        {!response && !loading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
            <div className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xs text-gray-400">Configurez le lien et cliquez sur<br />"Générer le lien de paiement".</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-gray-500">Création du lien…</p>
          </div>
        )}

        {response && (
          <div className="space-y-3">
            {paymentLink && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-sm font-semibold text-primary">Lien créé avec succès</p>
                </div>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 min-w-0">
                  <code className="text-[11px] text-gray-700 truncate flex-1">{paymentLink}</code>
                </div>
                <div className="flex gap-2">
                  <a href={paymentLink} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button size="sm" className="w-full gap-1.5 text-xs" data-testid="button-hp-open-link">
                      <ExternalLink className="w-3.5 h-3.5" /> Ouvrir le checkout
                    </Button>
                  </a>
                  <Button size="sm" variant="outline"
                    className="border-gray-300 text-gray-600 hover:text-gray-900 flex-1 gap-1.5 text-xs"
                    onClick={() => { navigator.clipboard.writeText(paymentLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                    data-testid="button-hp-copy-link">
                    {linkCopied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {linkCopied ? "Copié !" : "Copier"}
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400">Expire dans 30 minutes.</p>
              </div>
            )}
            <JsonBlock data={response.data} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
type Mode = "sdk" | "hosted";

const MODES = [
  { key: "sdk" as Mode,    label: "SDK Direct",  icon: Terminal, endpoint: "POST /v1/collect" },
  { key: "hosted" as Mode, label: "Hosted Page", icon: Code2,    endpoint: "POST /api/v1/hosted-payment/create" },
];

export default function TestPaymentPage() {
  const [mode, setMode] = useState<Mode>("sdk");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 -ml-2 gap-1.5 shrink-0" data-testid="link-back-home">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Accueil</span>
              </Button>
            </Link>
            <div className="h-4 w-px bg-gray-200 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <FlaskConical className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm text-gray-900">Ashtech Pay</span>
              <span className="text-[10px] border border-primary/30 text-primary/80 hidden sm:inline px-1.5 py-0.5 rounded bg-primary/5">Sandbox</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-600 font-medium hidden sm:inline">Live</span>
            </div>
            <Link href="/docs/api">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 text-xs gap-1.5 hidden sm:flex" data-testid="link-sdk-docs">
                <BookOpen className="w-3.5 h-3.5" /> SDK Docs
              </Button>
            </Link>
            <Link href="/docs/hosted-page">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 text-xs gap-1.5 hidden sm:flex" data-testid="link-hp-docs">
                <Code2 className="w-3.5 h-3.5" /> Hosted Docs
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-6">

        {/* Page heading */}
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-gray-900">API Sandbox</h1>
          <p className="text-sm text-gray-500">Testez les deux modes d'intégration Ashtech Pay avec de vraies transactions.</p>
        </div>

        {/* Mode selector */}
        <div className="flex flex-col sm:flex-row gap-3">
          {MODES.map(({ key, label, icon: Icon, endpoint }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                mode === key
                  ? "border-primary/40 bg-primary/5 text-gray-900"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
              data-testid={`tab-mode-${key}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                mode === key ? "bg-primary/15" : "bg-gray-100"
              }`}>
                <Icon className={`w-4 h-4 ${mode === key ? "text-primary" : "text-gray-400"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none mb-1">{label}</p>
                <p className={`text-[11px] font-mono truncate ${mode === key ? "text-primary/70" : "text-gray-400"}`}>{endpoint}</p>
              </div>
              {mode === key && <ChevronRight className="w-4 h-4 text-primary/50 shrink-0 ml-auto" />}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          {mode === "sdk" ? <SDKForm /> : <HostedPageForm />}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap gap-4 pb-4">
          <Link href="/docs/api">
            <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors" data-testid="link-footer-sdk-docs">
              <BookOpen className="w-3.5 h-3.5" /> Documentation SDK <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
          <Link href="/docs/hosted-page">
            <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors" data-testid="link-footer-hp-docs">
              <Code2 className="w-3.5 h-3.5" /> Documentation Hosted Page <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
          <Link href="/dashboard/api-keys">
            <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors" data-testid="link-footer-api-keys">
              <Zap className="w-3.5 h-3.5" /> Mes clés API <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
