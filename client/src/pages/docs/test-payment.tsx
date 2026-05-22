import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Terminal, Code2, Zap, Eye, EyeOff,
  Copy, CheckCheck, ExternalLink, Loader2, ChevronRight,
  CheckCircle2, AlertCircle, Info, BookOpen, FlaskConical,
} from "lucide-react";

// ─── Countries data ────────────────────────────────────────────────────────
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

// ─── Helpers ───────────────────────────────────────────────────────────────
function JsonDisplay({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
        <span className="text-xs font-mono text-zinc-400">JSON</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed whitespace-pre">
        {text}
      </pre>
    </div>
  );
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-zinc-300">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-zinc-600">{hint}</p>}
    </div>
  );
}

function SelectField({
  value, onChange, disabled, placeholder, children,
}: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
  placeholder: string; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
    >
      <option value="" disabled className="bg-[#0d1117]">{placeholder}</option>
      {children}
    </select>
  );
}

// ─── SDK Mode ─────────────────────────────────────────────────────────────
function SDKForm() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [operator, setOperator] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // OTP flow state
  const [otpRequired, setOtpRequired] = useState(false);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);

  const selectedCountry = ALL_COUNTRIES.find(c => c.code === countryCode);
  const operators = selectedCountry?.operators ?? [];
  const requiresOtp = selectedCountry?.otpOps.includes(operator) ?? false;

  function handleCountryChange(code: string) {
    setCountryCode(code);
    setOperator("");
    setOtpRequired(false);
    setResponse(null);
    setError(null);
  }

  function buildPayload(withOtp?: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      amount: Number(amount),
      currency: selectedCountry?.currency ?? "",
      phone,
      operator,
      country_code: countryCode,
    };
    if (reference.trim()) payload.reference = reference.trim();
    if (notifyUrl.trim()) payload.notify_url = notifyUrl.trim();
    if (withOtp) payload.otp = withOtp;
    return payload;
  }

  async function submit(otpValue?: string) {
    if (!apiKey.trim()) { setError("Veuillez entrer votre clé API."); return; }
    if (!countryCode) { setError("Veuillez sélectionner un pays."); return; }
    if (!operator) { setError("Veuillez sélectionner un opérateur."); return; }
    if (!amount || Number(amount) <= 0) { setError("Veuillez entrer un montant valide."); return; }
    if (!phone.trim()) { setError("Veuillez entrer le numéro de téléphone."); return; }

    const payload = buildPayload(otpValue);
    setLastPayload(payload);
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/v1/collect", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResponse({ status: res.status, data });

      if (res.status === 400 && data.error === "otp_required") {
        setOtpRequired(true);
        setUssdCode(data.ussd_code ?? null);
      } else if (res.ok) {
        setOtpRequired(false);
      }
    } catch (e: any) {
      setError("Erreur réseau : " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp() {
    if (!otp.trim()) { setError("Veuillez entrer le code OTP."); return; }
    await submit(otp.trim());
    setOtp("");
  }

  const isSuccess = response && response.status === 202;
  const isWave = isSuccess && (response.data as any)?.flow === "wave";
  const waveUrl = isWave ? (response.data as any)?.wave_url : null;

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="flex gap-3 items-start rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-300 leading-relaxed">
          <strong className="text-blue-200">Paiement direct Mobile Money</strong> — L'API initie immédiatement une requête USSD / OTP / Wave vers le téléphone du payeur. Utilisez votre clé API (<code className="font-mono bg-white/10 px-1 rounded">ak_live_</code>) depuis votre espace <Link href="/dashboard/api-keys"><span className="underline cursor-pointer">Clés API</span></Link>.
        </p>
      </div>

      {/* API Key */}
      <FieldGroup label="Clé API (ak_live_)" hint="Votre clé Bearer — ne partagez pas cette clé.">
        <div className="relative">
          <Input
            type={showKey ? "text" : "password"}
            placeholder="ak_live_xxxxxxxxxxxxxxxx"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600 pr-10"
            data-testid="input-sdk-api-key"
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </FieldGroup>

      <div className="h-px bg-white/5" />

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Name */}
        <FieldGroup label="Nom du payeur" hint="Affiché à titre indicatif uniquement.">
          <Input
            placeholder="ex : Jean Dupont"
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600"
            data-testid="input-sdk-name"
          />
        </FieldGroup>

        {/* Amount */}
        <FieldGroup label="Montant" hint={selectedCountry ? `Devise : ${selectedCountry.currency}` : "Sélectionnez d'abord un pays."}>
          <Input
            type="number"
            placeholder="ex : 5000"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600"
            data-testid="input-sdk-amount"
          />
        </FieldGroup>

        {/* Country */}
        <FieldGroup label="Pays">
          <SelectField value={countryCode} onChange={handleCountryChange} placeholder="— Sélectionner un pays —">
            {ALL_COUNTRIES.map(c => (
              <option key={c.code} value={c.code} className="bg-[#0d1117]">
                {c.name} ({c.code}) — {c.currency}
              </option>
            ))}
          </SelectField>
        </FieldGroup>

        {/* Operator */}
        <FieldGroup label="Opérateur" hint={requiresOtp ? "⚡ Cet opérateur nécessite un OTP — l'API vous demandera le code." : undefined}>
          <SelectField value={operator} onChange={setOperator} disabled={!countryCode} placeholder="— Sélectionner un opérateur —">
            {operators.map(op => (
              <option key={op} value={op} className="bg-[#0d1117]">{op}</option>
            ))}
          </SelectField>
        </FieldGroup>

        {/* Phone */}
        <FieldGroup label="Numéro de téléphone" hint="Format local sans indicatif pays.">
          <Input
            placeholder={countryCode === "CM" ? "ex : 670000000" : countryCode === "CI" ? "ex : 0700000000" : "ex : 77000000"}
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600"
            data-testid="input-sdk-phone"
          />
        </FieldGroup>

        {/* Reference */}
        <FieldGroup label="Référence (optionnel)" hint="Votre référence de commande interne.">
          <Input
            placeholder="ex : ORDER-001"
            value={reference}
            onChange={e => setReference(e.target.value)}
            className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600"
            data-testid="input-sdk-reference"
          />
        </FieldGroup>
      </div>

      {/* Notify URL */}
      <FieldGroup label="Webhook URL (optionnel)" hint="URL appelée par Ashtech Pay quand le paiement est confirmé.">
        <Input
          placeholder="https://monsite.com/webhook/paiement"
          value={notifyUrl}
          onChange={e => setNotifyUrl(e.target.value)}
          className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600"
          data-testid="input-sdk-notify-url"
        />
      </FieldGroup>

      {error && (
        <div className="flex gap-2 items-start rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Submit */}
      {!otpRequired && (
        <Button
          onClick={() => submit()}
          disabled={loading}
          className="w-full"
          data-testid="button-sdk-submit"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
          {loading ? "Envoi en cours…" : "Initier le paiement SDK"}
        </Button>
      )}

      {/* OTP Flow */}
      {otpRequired && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-black shrink-0">!</span>
            <p className="text-sm font-semibold text-yellow-300">OTP requis</p>
          </div>
          {ussdCode ? (
            <p className="text-xs text-zinc-300 leading-relaxed">
              Composez le code USSD suivant depuis le téléphone du payeur pour recevoir l'OTP :{" "}
              <code className="text-yellow-300 bg-white/10 px-2 py-1 rounded font-mono font-bold">{ussdCode}</code>
            </p>
          ) : (
            <p className="text-xs text-zinc-300 leading-relaxed">
              Le client a reçu un <strong className="text-white">SMS</strong> avec son code OTP. Saisissez-le ci-dessous pour finaliser le paiement.
            </p>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Code OTP à 4-6 chiffres"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitOtp()}
              className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600 flex-1 font-mono tracking-widest"
              data-testid="input-sdk-otp"
            />
            <Button onClick={submitOtp} disabled={loading} className="shrink-0" data-testid="button-sdk-submit-otp">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Valider →"}
            </Button>
          </div>
          <button onClick={() => { setOtpRequired(false); setResponse(null); }} className="text-xs text-zinc-600 hover:text-zinc-400 underline">
            Recommencer depuis le début
          </button>
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Réponse du serveur</p>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
              response.status === 202 ? "text-green-400 border-green-500/30 bg-green-500/10" :
              response.status === 400 ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" :
              "text-red-400 border-red-500/30 bg-red-500/10"
            }`}>
              {response.status}
            </span>
          </div>

          {isWave && waveUrl && (
            <div className="flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
              <span className="text-xl">🔗</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-purple-300">Lien Wave généré</p>
                <p className="text-xs text-zinc-500 truncate">{waveUrl}</p>
              </div>
              <a href={waveUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-purple-600 hover:bg-purple-500 shrink-0 gap-1.5" data-testid="button-open-wave-url">
                  Ouvrir <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>
          )}

          {isSuccess && !isWave && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-xs text-green-300">
                Paiement initié avec succès. Le client doit valider sur son téléphone. Attendez le webhook pour confirmation finale.
              </p>
            </div>
          )}

          <JsonDisplay data={response.data} />
        </div>
      )}
    </div>
  );
}

// ─── Hosted Page Mode ─────────────────────────────────────────────────────
function HostedPageForm() {
  const [hpKey, setHpKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isFixedAmount, setIsFixedAmount] = useState(true);
  const [notifyUrl, setNotifyUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCountry = ALL_COUNTRIES.find(c => c.code === countryCode);
  const currency = selectedCountry?.currency ?? "";

  async function submit() {
    if (!hpKey.trim()) { setError("Veuillez entrer votre clé Hosted Page (hp_live_)."); return; }
    if (!currency) { setError("Veuillez sélectionner un pays pour la devise."); return; }
    if (isFixedAmount && (!amount || Number(amount) <= 0)) { setError("Veuillez entrer un montant valide."); return; }

    const payload: Record<string, unknown> = { currency };
    if (isFixedAmount) payload.amount = Number(amount);
    payload.is_fixed_amount = isFixedAmount;
    if (description.trim()) payload.description = description.trim();
    if (notifyUrl.trim()) payload.notify_url = notifyUrl.trim();

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/v1/hosted-payment/create", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hpKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResponse({ status: res.status, data });
    } catch (e: any) {
      setError("Erreur réseau : " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const isSuccess = response?.status === 200;
  const paymentLink = isSuccess ? (response!.data as any)?.payment_link : null;

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="flex gap-3 items-start rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-300 leading-relaxed">
          <strong className="text-blue-200">Page de paiement hébergée</strong> — Génère un lien de paiement unique que vous redirigez vers votre client. Utilisez votre clé <code className="font-mono bg-white/10 px-1 rounded">hp_live_</code> depuis l'onglet <Link href="/dashboard/api-keys"><span className="underline cursor-pointer">Hosted Page</span></Link>.
        </p>
      </div>

      {/* HP Key */}
      <FieldGroup label="Clé Hosted Page (hp_live_)" hint="Votre clé hp_live_ — à garder côté serveur uniquement.">
        <div className="relative">
          <Input
            type={showKey ? "text" : "password"}
            placeholder="hp_live_xxxxxxxxxxxxxxxx"
            value={hpKey}
            onChange={e => setHpKey(e.target.value)}
            className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600 pr-10"
            data-testid="input-hp-key"
          />
          <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </FieldGroup>

      <div className="h-px bg-white/5" />

      {/* Fixed / Free amount toggle */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl w-full sm:w-auto">
        {[
          { val: true,  label: "Prix fixe",  hint: "Vous définissez le montant" },
          { val: false, label: "Prix libre", hint: "Le client choisit" },
        ].map(({ val, label, hint }) => (
          <button
            key={String(val)}
            onClick={() => setIsFixedAmount(val)}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              isFixedAmount === val
                ? "bg-primary text-primary-foreground shadow"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            data-testid={`button-hp-mode-${val ? "fixed" : "free"}`}
          >
            {label}
            <span className="block text-[10px] font-normal opacity-70">{hint}</span>
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Country → currency */}
        <FieldGroup label="Pays (pour la devise)" hint={currency ? `Devise sélectionnée : ${currency}` : "Détermine la devise du lien."}>
          <SelectField value={countryCode} onChange={setCountryCode} placeholder="— Sélectionner un pays —">
            {ALL_COUNTRIES.map(c => (
              <option key={c.code} value={c.code} className="bg-[#0d1117]">
                {c.name} — {c.currency}
              </option>
            ))}
          </SelectField>
        </FieldGroup>

        {/* Amount */}
        {isFixedAmount && (
          <FieldGroup label="Montant" hint={currency ? `En ${currency}` : "Sélectionnez d'abord un pays."}>
            <Input
              type="number"
              placeholder="ex : 5000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600"
              data-testid="input-hp-amount"
            />
          </FieldGroup>
        )}

        {/* Description */}
        <FieldGroup label="Description (optionnel)" hint="Affichée sur la page de paiement.">
          <Input
            placeholder="ex : Abonnement Premium"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600"
            data-testid="input-hp-description"
          />
        </FieldGroup>

        {/* Notify URL */}
        <FieldGroup label="Webhook URL (optionnel)">
          <Input
            placeholder="https://monsite.com/webhook"
            value={notifyUrl}
            onChange={e => setNotifyUrl(e.target.value)}
            className="bg-white/5 border-white/10 text-zinc-200 placeholder:text-zinc-600"
            data-testid="input-hp-notify-url"
          />
        </FieldGroup>
      </div>

      {error && (
        <div className="flex gap-2 items-start rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <Button onClick={submit} disabled={loading} className="w-full" data-testid="button-hp-submit">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Code2 className="w-4 h-4 mr-2" />}
        {loading ? "Génération…" : "Générer le lien de paiement"}
      </Button>

      {/* Response */}
      {response && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Réponse du serveur</p>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
              isSuccess ? "text-green-400 border-green-500/30 bg-green-500/10" :
              "text-red-400 border-red-500/30 bg-red-500/10"
            }`}>
              {response.status}
            </span>
          </div>

          {paymentLink && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm font-semibold text-primary">Lien de paiement créé !</p>
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 min-w-0">
                <code className="text-xs text-zinc-300 truncate flex-1">{paymentLink}</code>
              </div>
              <div className="flex gap-2 flex-wrap">
                <a href={paymentLink} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button size="sm" className="w-full gap-1.5" data-testid="button-hp-open-link">
                    Ouvrir le checkout <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-zinc-300 hover:text-white flex-1 gap-1.5"
                  onClick={() => { navigator.clipboard.writeText(paymentLink); }}
                  data-testid="button-hp-copy-link"
                >
                  <Copy className="w-3.5 h-3.5" /> Copier le lien
                </Button>
              </div>
              <p className="text-[11px] text-zinc-600">Ce lien expire dans 30 minutes si aucun paiement n'est effectué.</p>
            </div>
          )}

          <JsonDisplay data={response.data} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
type Mode = "sdk" | "hosted";

export default function TestPaymentPage() {
  const [mode, setMode] = useState<Mode>("sdk");

  return (
    <div className="min-h-screen bg-[#0a0c10] text-zinc-100 flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0c10]/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white -ml-2 gap-1.5" data-testid="link-back-home">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Accueil</span>
              </Button>
            </Link>
            <div className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <FlaskConical className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm text-white truncate">Ashtech Pay</span>
              <span className="text-[10px] border border-white/20 text-zinc-400 hidden sm:flex px-1.5 py-0.5 rounded">Sandbox</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/docs/api">
              <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white text-xs gap-1.5 hidden sm:flex" data-testid="link-sdk-docs">
                <BookOpen className="w-3.5 h-3.5" />SDK Docs
              </Button>
            </Link>
            <Link href="/docs/hosted-page">
              <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white text-xs gap-1.5 hidden sm:flex" data-testid="link-hp-docs">
                <Code2 className="w-3.5 h-3.5" />Hosted Docs
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10 space-y-8">

        {/* Title */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold text-white">Tester l'API</h1>
          </div>
          <p className="text-zinc-400 text-sm">
            Sandbox interactif — testez directement les deux modes d'intégration Ashtech Pay avec vos vraies clés API.
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl w-full sm:w-auto sm:inline-flex">
          {([
            { key: "sdk" as Mode,    label: "SDK Direct",       icon: Terminal,  hint: "POST /v1/collect" },
            { key: "hosted" as Mode, label: "Hosted Page",      icon: Code2,     hint: "POST /api/v1/hosted-payment/create" },
          ]).map(({ key, label, icon: Icon, hint }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 sm:flex-none flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === key
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              data-testid={`tab-mode-${key}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
              <span className={`text-[10px] font-mono hidden lg:block ${mode === key ? "opacity-70" : "opacity-40"}`}>{hint}</span>
            </button>
          ))}
        </div>

        {/* Active Form */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
          {mode === "sdk" ? <SDKForm /> : <HostedPageForm />}
        </div>

        {/* Footer links */}
        <div className="flex flex-wrap gap-4 pt-2">
          <Link href="/docs/api">
            <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors" data-testid="link-footer-sdk-docs">
              <BookOpen className="w-3.5 h-3.5" />
              Documentation SDK complète <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
          <Link href="/docs/hosted-page">
            <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors" data-testid="link-footer-hp-docs">
              <Code2 className="w-3.5 h-3.5" />
              Documentation Hosted Page <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
          <Link href="/dashboard/api-keys">
            <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors" data-testid="link-footer-api-keys">
              <Zap className="w-3.5 h-3.5" />
              Mes clés API <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
