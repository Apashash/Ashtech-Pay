import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cryptoQrPayload } from "@/lib/crypto-qr";
import {
  AlertCircle,
  ArrowLeft,
  Bitcoin,
  CheckCheck,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
} from "lucide-react";

type CryptoAsset = {
  asset_code: string;
  coin: string;
  name: string;
  network: string;
  network_label: string;
  memo_required: boolean;
  memo_type: string | null;
  currency: string;
};

type ApiResponse = {
  status: number;
  data: unknown;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
        <span className="text-[11px] font-mono text-zinc-400 tracking-wide">RESPONSE</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          {copied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed whitespace-pre max-h-96 overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  const ok = status >= 200 && status < 300;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-md border ${
      ok
        ? "text-emerald-600 border-emerald-300 bg-emerald-50"
        : "text-red-600 border-red-300 bg-red-50"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
      {status}
    </span>
  );
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{label}</p>
      <div className="flex items-start gap-2">
        <code className="text-xs font-mono text-gray-800 break-all flex-1">{value}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 text-gray-400 hover:text-gray-700"
          aria-label={`Copier ${label}`}
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

export default function TestCryptoPage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [assetCode, setAssetCode] = useState("");
  const [currency, setCurrency] = useState("USDT");
  const [amount, setAmount] = useState("1");
  const [reference, setReference] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [refundAddress, setRefundAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAsset = assets.find(asset => asset.asset_code === assetCode);
  const responseData = response?.data as Record<string, unknown> | undefined;
  const isSuccess = response?.status === 202;
  const responseAddress = typeof responseData?.address === "string" ? responseData.address : "";
  const responseMemo = typeof responseData?.memo === "string" ? responseData.memo : "";
  const responseMemoType = typeof responseData?.memo_type === "string" ? responseData.memo_type : null;
  const responseQrPayload = responseAddress
    ? cryptoQrPayload(assetCode, responseAddress, responseMemo || null, responseMemoType)
    : "";

  const groupedAssets = useMemo(() => {
    return assets.reduce<Record<string, CryptoAsset[]>>((groups, asset) => {
      (groups[asset.coin] ??= []).push(asset);
      return groups;
    }, {});
  }, [assets]);

  function reset() {
    setAssets([]);
    setAssetsError(null);
    setAssetCode("");
    setCurrency("USDT");
    setAmount("1");
    setReference("");
    setNotifyUrl("");
    setEmail("");
    setFirstName("");
    setLastName("");
    setRefundAddress("");
    setResponse(null);
    setError(null);
  }

  async function readJson(res: Response): Promise<unknown> {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { message: text || res.statusText };
    }
  }

  async function loadAssets() {
    if (!apiKey.trim()) {
      setAssetsError("Saisissez une clé API ak_… avant de charger les réseaux.");
      return;
    }

    setAssetsLoading(true);
    setAssetsError(null);
    try {
      const res = await fetch("/v1/crypto/assets", {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });
      const data = await readJson(res) as { assets?: CryptoAsset[]; message?: string };
      if (!res.ok) throw new Error(data.message || `Erreur HTTP ${res.status}`);
      const nextAssets = Array.isArray(data.assets) ? data.assets : [];
      setAssets(nextAssets);
      setAssetCode(current => nextAssets.some(asset => asset.asset_code === current)
        ? current
        : nextAssets[0]?.asset_code ?? "");
      if (nextAssets.length === 0) setAssetsError("Aucun réseau crypto actif n'est disponible pour cette clé.");
    } catch (e: any) {
      setAssets([]);
      setAssetCode("");
      setAssetsError(e?.message || "Impossible de charger le catalogue crypto.");
    } finally {
      setAssetsLoading(false);
    }
  }

  useEffect(() => {
    if (apiKey.trim()) {
      const timer = setTimeout(() => { void loadAssets(); }, 350);
      return () => clearTimeout(timer);
    }
    setAssets([]);
    setAssetCode("");
    setAssetsError(null);
    return undefined;
  }, [apiKey]);

  async function submit() {
    if (!apiKey.trim()) return setError("Clé API manquante.");
    if (!assetCode) return setError("Chargez le catalogue puis sélectionnez un réseau crypto.");
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Entrez un montant positif.");

    const payload: Record<string, unknown> = {
      amount: numericAmount,
      currency,
      asset_code: assetCode,
    };
    if (reference.trim()) payload.reference = reference.trim();
    if (notifyUrl.trim()) payload.notify_url = notifyUrl.trim();
    if (email.trim() || firstName.trim() || lastName.trim()) {
      payload.customer = {
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
      };
    }
    if (refundAddress.trim()) payload.refund_address = refundAddress.trim();

    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch("/v1/crypto/collect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      setResponse({ status: res.status, data });
    } catch (e: any) {
      setError(`Erreur réseau : ${e?.message || "requête impossible"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/docs/api">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 -ml-2 gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Documentation SDK</span>
              </Button>
            </Link>
            <div className="h-4 w-px bg-gray-200 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Bitcoin className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm text-gray-900">Test API crypto</span>
              <span className="text-[10px] border border-amber-300 text-amber-700 px-1.5 py-0.5 rounded bg-amber-50 hidden sm:inline">
                Direct SDK
              </span>
            </div>
          </div>
          <Link href="/docs/api#crypto">
            <Button variant="ghost" size="sm" className="text-xs text-gray-500 gap-1.5">
              <Terminal className="w-3.5 h-3.5" /> Voir la documentation
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-gray-900">Tester le Pay-In Crypto</h1>
          <p className="text-sm text-gray-500 max-w-3xl">
            Cette page utilise les endpoints Direct SDK documentés. Elle charge d'abord les réseaux actifs avec
            <code className="font-mono text-blue-600 mx-1">GET /v1/crypto/assets</code>, puis crée une adresse avec
            <code className="font-mono text-blue-600 mx-1">POST /v1/crypto/collect</code>.
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          La clé est envoyée uniquement depuis votre navigateur vers l'API avec l'en-tête Bearer. Elle n'est pas incluse
          dans l'URL et n'est pas enregistrée par cette page.
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="grid lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
            <div className="p-4 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Paramètres</p>
                <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
                  <RotateCcw className="w-3 h-3" /> Réinitialiser
                </button>
              </div>

              <Field label="Clé API" hint="Clé Bearer ak_… avec accès API activé.">
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder="ak_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="bg-white border-gray-300 text-gray-900 pr-10 font-mono text-xs"
                    data-testid="input-crypto-api-key"
                  />
                  <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </Field>

              <div className="flex gap-2">
                <Button onClick={() => void loadAssets()} disabled={assetsLoading || !apiKey.trim()} variant="outline" className="gap-2 flex-1">
                  {assetsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bitcoin className="w-4 h-4" />}
                  {assetsLoading ? "Chargement…" : "Charger les réseaux actifs"}
                </Button>
              </div>

              {assetsError && (
                <div className="flex gap-2 items-start rounded-lg border border-red-300 bg-red-50 p-3">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{assetsError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Réseau crypto" hint={selectedAsset?.memo_required ? `Memo/tag requis (${selectedAsset.memo_type})` : "Adresse sans memo/tag"}>
                  <select
                    value={assetCode}
                    onChange={e => setAssetCode(e.target.value)}
                    disabled={assetsLoading || assets.length === 0}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    data-testid="select-crypto-asset"
                  >
                    <option value="" disabled>Sélectionner un réseau…</option>
                    {Object.entries(groupedAssets).map(([coin, coinAssets]) => (
                      <optgroup key={coin} label={coin}>
                        {coinAssets.map(asset => (
                          <option key={asset.asset_code} value={asset.asset_code}>
                            {asset.network_label} · {asset.asset_code}{asset.memo_required ? ` · ${asset.memo_type}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <Field label="Devise du montant" hint="USDT ou devise fiat supportée">
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    data-testid="select-crypto-currency"
                  >
                    {["USDT", "XAF", "XOF", "GNF", "CDF", "USD"].map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </Field>
                <Field label="Montant" hint={currency === "USDT" ? "Minimum : 1 USDT brut" : "Le serveur convertit le minimum en USDT"}>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="bg-white border-gray-300 text-gray-900"
                    data-testid="input-crypto-amount"
                  />
                </Field>
                <Field label="Référence (optionnel)">
                  <Input placeholder="ORDER-CRYPTO-001" value={reference} onChange={e => setReference(e.target.value)} className="bg-white border-gray-300 text-gray-900 text-xs" />
                </Field>
              </div>

              <Field label="Webhook URL (optionnel)" hint="Recevez payment.completed ou payment.failed après confirmation.">
                <Input placeholder="https://monsite.com/webhook" value={notifyUrl} onChange={e => setNotifyUrl(e.target.value)} className="bg-white border-gray-300 text-gray-900 text-xs" data-testid="input-crypto-notify-url" />
              </Field>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Client (optionnel)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Prénom"><Input placeholder="Ada" value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-white border-gray-300 text-gray-900 text-xs" /></Field>
                  <Field label="Nom"><Input placeholder="Lovelace" value={lastName} onChange={e => setLastName(e.target.value)} className="bg-white border-gray-300 text-gray-900 text-xs" /></Field>
                  <Field label="Email"><Input type="email" placeholder="ada@example.com" value={email} onChange={e => setEmail(e.target.value)} className="bg-white border-gray-300 text-gray-900 text-xs" /></Field>
                  <Field label="Adresse de remboursement"><Input placeholder="Optionnel" value={refundAddress} onChange={e => setRefundAddress(e.target.value)} className="bg-white border-gray-300 text-gray-900 text-xs" /></Field>
                </div>
              </div>

              {error && (
                <div className="flex gap-2 items-start rounded-lg border border-red-300 bg-red-50 p-3">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <Button onClick={() => void submit()} disabled={loading || assetsLoading || assets.length === 0} className="w-full gap-2" data-testid="button-test-crypto-api">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {loading ? "Création de l'adresse…" : "Tester POST /v1/crypto/collect"}
              </Button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Réponse API</p>
                {response && <StatusBadge status={response.status} />}
              </div>

              {!response && !loading && (
                <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
                  <div className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center">
                    <Terminal className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-400">Chargez les réseaux, remplissez le formulaire,<br />puis lancez la requête crypto.</p>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs text-gray-500">Connexion à /v1/crypto/collect…</p>
                </div>
              )}

              {response && (
                <div className="space-y-3">
                  {isSuccess && (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <CheckCheck className="w-3.5 h-3.5 text-white" />
                      </div>
                      <p className="text-xs text-emerald-700">
                        Adresse générée. Affichez l'adresse et le memo/tag séparément au payeur, puis attendez le webhook.
                      </p>
                    </div>
                  )}
                  {!isSuccess && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
                      <p className="font-semibold">La requête n’a pas été acceptée.</p>
                      <p>
                        Le code HTTP et le message indiquent la cause. Conservez le champ{" "}
                        <code className="font-mono">request_id</code> pour le support.
                      </p>
                      {typeof responseData?.error === "string" && (
                        <p>Erreur : <code className="font-mono">{String(responseData.error)}</code></p>
                      )}
                      {typeof responseData?.message === "string" && <p>Message : {String(responseData.message)}</p>}
                      {typeof responseData?.stage === "string" && (
                        <p>Étape : <code className="font-mono">{String(responseData.stage)}</code></p>
                      )}
                      {typeof responseData?.request_id === "string" && (
                        <p>Request ID : <code className="font-mono">{String(responseData.request_id)}</code></p>
                      )}
                      {typeof responseData?.provider_status === "number" && (
                        <p>Réponse du service crypto : HTTP {String(responseData.provider_status)}</p>
                      )}
                    </div>
                  )}
                  {isSuccess && <CopyValue label="Adresse de dépôt" value={responseAddress} />}
                  {isSuccess && responseQrPayload && (
                    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">QR de paiement</p>
                      <div className="flex justify-center">
                        <div className="rounded-xl border border-gray-200 bg-white p-3">
                          <QRCodeSVG
                            value={responseQrPayload}
                            size={190}
                            level="M"
                            includeMargin
                            aria-label="QR code de paiement crypto"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-center text-gray-500">
                        Scannez ce QR avec votre portefeuille. Le memo/tag reste affiché séparément lorsqu'il est requis.
                      </p>
                    </div>
                  )}
                  {isSuccess && responseMemo && <CopyValue label={String(responseData?.memo_type || "Memo / tag")} value={responseMemo} />}
                  {isSuccess && !responseMemo && selectedAsset?.memo_required && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      Ce réseau exige un memo/tag, mais la réponse n'en contient pas.
                    </div>
                  )}
                  {isSuccess && typeof responseData?.expires_at === "string" && (
                    <p className="text-[11px] text-gray-500">Expiration : {String(responseData.expires_at)}</p>
                  )}
                  <JsonBlock data={response.data} />
                  {isSuccess && typeof responseData?.reference === "string" && (
                    <a href={`/dashboard/transactions`} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                      Référence : <code className="font-mono">{String(responseData.reference)}</code>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}