import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Code2, Globe, Eye, EyeOff, Copy, RefreshCw, BookOpen,
  CheckCheck, Key, Shield, AlertCircle, LockKeyhole, CheckCircle,
  Terminal, Zap, ArrowRight, FlaskConical,
} from "lucide-react";
import { useLanguage } from "@/lib/language";

type Mode = "hosted" | "sdk";

interface HostedPageConfig {
  id: string;
  userId: string;
  successUrl: string | null;
  cancelUrl: string | null;
  notifyUrl: string | null;
  pkLive: string | null;
  skLive: string | null;
  hpLive: string | null;
}

function KeyRow({
  label,
  value,
  prefix,
  hint,
}: {
  label: string;
  value: string;
  prefix?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const masked = value.slice(0, 10) + "•".repeat(18) + value.slice(-4);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: t.apiKeys.toastKeyCopied, description: label + t.apiKeys.toastKeyCopiedDescSuf });
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">{label}</span>
          {prefix && (
            <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 shrink-0">
              {prefix}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setVisible(v => !v)}
            data-testid={`toggle-${label.toLowerCase().replace(/\s/g, "-")}`}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={copy}
            data-testid={`copy-${label.toLowerCase().replace(/\s/g, "-")}`}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 overflow-hidden">
        <code className="text-xs font-mono text-gray-700 flex-1 min-w-0 truncate select-all">
          {visible ? value : masked}
        </code>
        <button
          onClick={copy}
          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors sm:hidden"
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function ApiKeysPage() {
  const [mode, setMode] = useState<Mode>("hosted");
  const { t } = useLanguage();

  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const [successUrl, setSuccessUrl] = useState("");
  const [cancelUrl, setCancelUrl] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: userLoading } = useQuery<{ isVerified: boolean; apiEnabled: boolean }>({
    queryKey: ["/api/user"],
  });
  const isVerified = currentUser?.isVerified ?? false;
  const apiEnabled = (currentUser as any)?.apiEnabled ?? false;
  const apiAccess = isVerified && apiEnabled;

  const { data: sdkData, isLoading: sdkLoading } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/user/api-key"],
  });

  const regenerateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/user/api-key/regenerate"),
    onSuccess: (data: { apiKey: string }) => {
      queryClient.setQueryData(["/api/user/api-key"], data);
      setShowKey(true);
      toast({ title: t.apiKeys.toastRegenerated, description: t.apiKeys.toastRegeneratedDesc });
    },
    onError: () => {
      toast({ title: t.apiKeys.toastError, description: t.apiKeys.toastImpossibleRegen, variant: "destructive" });
    },
  });

  const apiKey = sdkData?.apiKey ?? "";
  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}${"•".repeat(24)}${apiKey.slice(-4)}` : "";

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: t.apiKeys.toastApiKeyCopied, description: t.apiKeys.toastApiKeyCopiedDesc });
  }

  const { data: hpConfig, isLoading: hpLoading } = useQuery<HostedPageConfig | null>({
    queryKey: ["/api/hosted-page/config"],
    refetchOnWindowFocus: false,
  });

  if (hpConfig && !initialized) {
    setSuccessUrl(hpConfig.successUrl || "");
    setCancelUrl(hpConfig.cancelUrl || "");
    setNotifyUrl(hpConfig.notifyUrl || "");
    setInitialized(true);
  }

  const hpMutation = useMutation({
    mutationFn: (data: { successUrl: string; cancelUrl: string; notifyUrl: string; regenerate?: boolean }) =>
      apiRequest("POST", "/api/hosted-page/config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosted-page/config"] });
      toast({ title: t.apiKeys.toastConfigSaved, description: t.apiKeys.toastConfigSavedDesc });
    },
    onError: () => {
      toast({ title: t.apiKeys.toastError, description: t.apiKeys.toastImpossibleSave, variant: "destructive" });
    },
  });

  const hasHpKeys = hpConfig?.pkLive && hpConfig?.skLive && hpConfig?.hpLive;

  if (userLoading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isVerified) {
    return (
      <DashboardLayout>
        <div className="w-full max-w-2xl space-y-6">
          <PageHeader />
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 flex flex-col items-center text-center gap-5" data-testid="banner-not-verified">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-amber-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-gray-900">{t.apiKeys.notVerifiedTitle}</h2>
              <p className="text-sm text-gray-500 max-w-sm" dangerouslySetInnerHTML={{ __html: t.apiKeys.notVerifiedDesc }} />
            </div>
            <Link href="/dashboard/kyc">
              <Button className="gap-2" data-testid="button-go-kyc">
                <CheckCircle className="h-4 w-4" />
                {t.apiKeys.goKycButton}
              </Button>
            </Link>
            <p className="text-xs text-gray-400">{t.apiKeys.kycStep}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!apiEnabled) {
    return (
      <DashboardLayout>
        <div className="w-full max-w-2xl space-y-6">
          <PageHeader />
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-10 flex flex-col items-center text-center gap-5" data-testid="banner-api-not-enabled">
            <div className="w-14 h-14 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center">
              <LockKeyhole className="h-7 w-7 text-sky-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-gray-900">{t.apiKeys.apiNotEnabledTitle}</h2>
              <p className="text-sm text-gray-500 max-w-sm" dangerouslySetInnerHTML={{ __html: t.apiKeys.apiNotEnabledDesc }} />
            </div>
            <a href="mailto:support@ashtechpay.top">
              <Button className="gap-2" data-testid="button-contact-admin">
                <LockKeyhole className="h-4 w-4" />
                {t.apiKeys.contactAdminButton}
              </Button>
            </a>
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              {t.apiKeys.apiActiveStatus}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full max-w-2xl space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t.apiKeys.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t.apiKeys.subtitle}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs text-green-600 font-medium">API Active</span>
          </div>
        </div>

        {/* ── Mode tabs ── */}
        <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-xl p-1">
          <ModeTab
            active={mode === "hosted"}
            onClick={() => setMode("hosted")}
            icon={<Globe className="w-3.5 h-3.5" />}
            label="Hosted Page"
            endpoint="POST /v1/hosted-payment/create"
            testId="button-mode-hosted"
          />
          <ModeTab
            active={mode === "sdk"}
            onClick={() => setMode("sdk")}
            icon={<Code2 className="w-3.5 h-3.5" />}
            label="SDK Direct"
            endpoint="POST /v1/collect"
            testId="button-mode-sdk"
          />
        </div>

        {/* ── HOSTED PAGE MODE ── */}
        {mode === "hosted" && (
          <div className="space-y-4">

            {/* How it works */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Key, label: t.apiKeys.step1Label, desc: t.apiKeys.step1Desc, color: "text-amber-500", bg: "bg-amber-50 border-amber-200" },
                { icon: Zap, label: t.apiKeys.step2Label, desc: t.apiKeys.step2Desc, color: "text-blue-500", bg: "bg-blue-50 border-blue-200" },
                { icon: Shield, label: t.apiKeys.step3Label, desc: t.apiKeys.step3Desc, color: "text-green-500", bg: "bg-green-50 border-green-200" },
              ].map(({ icon: Icon, label, desc, color, bg }) => (
                <div key={label} className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-2.5">
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{label}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Config URLs */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">{t.apiKeys.configSection}</p>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-gray-400" />
                    {t.apiKeys.configTitle}
                  </h3>
                </div>
                {hasHpKeys && (
                  <Badge className="bg-green-50 text-green-600 border-green-200 text-[10px]">
                    {t.apiKeys.keysActive}
                  </Badge>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Success Redirect URL</Label>
                  <Input
                    id="success-url"
                    data-testid="input-success-url"
                    placeholder="https://monsite.com/payment/success"
                    value={successUrl}
                    onChange={(e) => setSuccessUrl(e.target.value)}
                    className="bg-white border-gray-200 text-sm h-9 focus-visible:ring-primary/30"
                  />
                  <p className="text-[11px] text-gray-400">{t.apiKeys.successUrlDesc}</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Cancel Redirect URL</Label>
                  <Input
                    id="cancel-url"
                    data-testid="input-cancel-url"
                    placeholder="https://monsite.com/payment/cancel"
                    value={cancelUrl}
                    onChange={(e) => setCancelUrl(e.target.value)}
                    className="bg-white border-gray-200 text-sm h-9 focus-visible:ring-primary/30"
                  />
                  <p className="text-[11px] text-gray-400">{t.apiKeys.cancelUrlDesc}</p>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-gray-100">
                  <Label className="text-xs text-gray-600 flex items-center gap-2">
                    {t.apiKeys.webhookLabel}
                    <span className="font-mono text-[10px] bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded">
                      {t.apiKeys.webhookBadge}
                    </span>
                  </Label>
                  <Input
                    id="notify-url"
                    data-testid="input-notify-url"
                    placeholder="https://monsite.com/webhooks/ashtechpay"
                    value={notifyUrl}
                    onChange={(e) => setNotifyUrl(e.target.value)}
                    className="bg-white border-gray-200 text-sm h-9 focus-visible:ring-primary/30"
                  />
                  <p className="text-[11px] text-gray-400">{t.apiKeys.webhookDesc}</p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  {hasHpKeys ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => hpMutation.mutate({ successUrl, cancelUrl, notifyUrl })}
                      disabled={hpMutation.isPending}
                      data-testid="button-save-urls"
                      className="border-gray-200 hover:border-gray-300"
                    >
                      {hpMutation.isPending ? t.apiKeys.savingButton : t.apiKeys.saveUrlsButton}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => hpMutation.mutate({ successUrl, cancelUrl, notifyUrl })}
                      disabled={hpMutation.isPending}
                      data-testid="button-generate-keys"
                    >
                      {hpMutation.isPending ? (
                        <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />{t.apiKeys.generatingButton}</>
                      ) : (
                        <><Key className="h-3.5 w-3.5 mr-2" />Generate API Keys</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* API Keys panel */}
            {hpLoading && (
              <div className="flex justify-center py-6">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {hasHpKeys && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">{t.apiKeys.keysSection}</p>
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Key className="w-3.5 h-3.5 text-gray-400" />
                      API Keys
                    </h3>
                  </div>
                  <Badge className="bg-green-50 text-green-600 border-green-200 text-[10px]">
                    {t.apiKeys.keysActive}
                  </Badge>
                </div>

                <div className="p-5 space-y-5">
                  <KeyRow label="Public Key" value={hpConfig!.pkLive!} prefix="pk_live_" hint="Frontend — identifiant public de votre compte." />
                  <div className="border-t border-gray-100" />
                  <KeyRow label="Secret Key" value={hpConfig!.skLive!} prefix="sk_live_" hint="Backend uniquement — ne jamais exposer côté client." />
                  <div className="border-t border-gray-100" />
                  <KeyRow label="Hosted Page Key" value={hpConfig!.hpLive!} prefix="hp_live_" hint="Crée des sessions de paiement hébergées." />

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-gray-400 flex-1 min-w-0">{t.apiKeys.regenerateWarning}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => hpMutation.mutate({ successUrl, cancelUrl, notifyUrl, regenerate: true })}
                      disabled={hpMutation.isPending}
                      data-testid="button-regenerate-keys"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0 text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1.5" />
                      {t.apiKeys.regenerateKeys}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Action links */}
            {hasHpKeys && (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/docs/hosted-page">
                  <button
                    data-testid="button-documentation"
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 p-4 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{t.apiKeys.docButton}</p>
                      <p className="text-[11px] text-gray-400">Guide d'intégration</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
                  </button>
                </Link>
                <Link href="/docs/test-pay">
                  <button
                    data-testid="button-test-sandbox"
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50 p-4 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                      <FlaskConical className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Tester l'API</p>
                      <p className="text-[11px] text-gray-400">Sandbox interactif</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-500 transition-colors shrink-0" />
                  </button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── SDK DIRECT MODE ── */}
        {mode === "sdk" && (
          <div className="space-y-4">

            {/* API Key panel */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">{t.apiKeys.sdkAuthSection}</p>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-gray-400" />
                  {t.apiKeys.sdkAuthTitle}
                </h3>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-500">{t.apiKeys.sdkAuthDesc}</p>

                {/* Key display */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 overflow-hidden">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 shrink-0">Bearer</span>
                  <div className="w-px h-4 bg-gray-200" />
                  <code
                    className="text-xs font-mono text-gray-700 flex-1 min-w-0 truncate select-all"
                    data-testid="text-api-key"
                  >
                    {sdkLoading ? t.apiKeys.sdkLoading : showKey ? apiKey : maskedKey}
                  </code>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setShowKey(v => !v)}
                      disabled={sdkLoading || !apiKey}
                      data-testid="button-toggle-key-visibility"
                      className="p-1.5 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={copyKey}
                      disabled={sdkLoading || !apiKey}
                      data-testid="button-copy-key"
                      className="p-1.5 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40"
                    >
                      {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Regen row */}
                <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
                  <p className="text-[11px] text-gray-400 flex-1 min-w-0">{t.apiKeys.sdkRegenerateWarning}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => regenerateMutation.mutate()}
                    disabled={regenerateMutation.isPending}
                    data-testid="button-regenerate-key"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0 text-xs"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                    {t.apiKeys.sdkRegenerate}
                  </Button>
                </div>
              </div>
            </div>

            {/* Code example */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-200 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500">{t.apiKeys.sdkExampleTitle}</span>
                <span className="ml-auto text-[10px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">JavaScript</span>
              </div>
              <pre className="text-xs font-mono text-zinc-300 bg-[#0d1117] p-5 overflow-x-auto leading-relaxed">
{`fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${showKey && apiKey ? apiKey : "<VOTRE_CLÉ_API>"}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XAF",
    phone: "670000000",
    operator: "MTN",
    reference: "ORDER-123"
  })
})`}
              </pre>
            </div>

            {/* Action links */}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/docs/api">
                <button
                  data-testid="link-open-docs"
                  className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 p-4 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{t.apiKeys.sdkDocsButton}</p>
                    <p className="text-[11px] text-gray-400">Référence complète</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
                </button>
              </Link>
              <Link href="/docs/test-pay">
                <button
                  data-testid="button-test-sandbox-sdk"
                  className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50 p-4 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <FlaskConical className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">Tester l'API</p>
                    <p className="text-[11px] text-gray-400">Sandbox interactif</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-500 transition-colors shrink-0" />
                </button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

function PageHeader() {
  const { t } = useLanguage();
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">{t.apiKeys.title}</h1>
      <p className="text-sm text-muted-foreground mt-0.5">{t.apiKeys.subtitle}</p>
    </div>
  );
}

function ModeTab({
  active, onClick, icon, label, endpoint, testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  endpoint: string;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-left transition-all focus:outline-none ${
        active
          ? "bg-white border border-gray-200 shadow-sm"
          : "hover:bg-white/60 border border-transparent"
      }`}
    >
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-gray-200 text-gray-500"}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className={`text-xs font-semibold truncate ${active ? "text-gray-900" : "text-gray-500"}`}>{label}</p>
        <p className="text-[10px] font-mono text-gray-400 truncate">{endpoint}</p>
      </div>
    </button>
  );
}
