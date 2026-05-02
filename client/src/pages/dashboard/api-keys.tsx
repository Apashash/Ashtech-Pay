import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Code2, Globe, Eye, EyeOff, Copy, RefreshCw, BookOpen,
  CheckCircle2, Terminal, Shield, CheckCheck, ChevronRight, Key, Zap,
  AlertCircle, LockKeyhole, CheckCircle,
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

function CopyableKey({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: t.apiKeys.toastKeyCopied, description: label + t.apiKeys.toastKeyCopiedDescSuf });
  }

  const masked = value.slice(0, 12) + "•".repeat(20) + value.slice(-4);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-muted/50 rounded-lg border px-3 py-2">
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
          <code className="text-sm font-mono flex-1 min-w-0 truncate text-foreground">
            {visible ? value : masked}
          </code>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setVisible(!visible)}
          data-testid={`toggle-${label.toLowerCase().replace(/\s/g, "-")}`}
          className="h-9 w-9 shrink-0"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={copy}
          data-testid={`copy-${label.toLowerCase().replace(/\s/g, "-")}`}
          className="h-9 w-9 shrink-0"
        >
          {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-key"] });
      setShowKey(false);
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
        <div className="w-full max-w-3xl min-w-0 flex items-center justify-center py-24">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isVerified) {
    return (
      <DashboardLayout>
        <div className="w-full max-w-3xl min-w-0 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t.apiKeys.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t.apiKeys.subtitle}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30 p-8 flex flex-col items-center text-center gap-5" data-testid="banner-not-verified">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">{t.apiKeys.notVerifiedTitle}</h2>
              <p className="text-sm text-amber-700 dark:text-amber-300 max-w-md"
                dangerouslySetInnerHTML={{ __html: t.apiKeys.notVerifiedDesc }}
              />
            </div>
            <Link href="/dashboard/kyc">
              <Button className="gap-2" data-testid="button-go-kyc">
                <CheckCircle className="h-4 w-4" />
                {t.apiKeys.goKycButton}
              </Button>
            </Link>
            <p className="text-xs text-amber-600 dark:text-amber-500">{t.apiKeys.kycStep}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!apiEnabled) {
    return (
      <DashboardLayout>
        <div className="w-full max-w-3xl min-w-0 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t.apiKeys.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t.apiKeys.subtitle}</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 dark:border-sky-800/40 dark:bg-sky-950/30 p-8 flex flex-col items-center text-center gap-5" data-testid="banner-api-not-enabled">
            <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
              <LockKeyhole className="h-8 w-8 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-200">{t.apiKeys.apiNotEnabledTitle}</h2>
              <p className="text-sm text-sky-700 dark:text-sky-300 max-w-md"
                dangerouslySetInnerHTML={{ __html: t.apiKeys.apiNotEnabledDesc }}
              />
            </div>
            <a href="mailto:support@ashtechpay.top">
              <Button className="gap-2" data-testid="button-contact-admin">
                <LockKeyhole className="h-4 w-4" />
                {t.apiKeys.contactAdminButton}
              </Button>
            </a>
            <div className="flex items-center gap-2 text-xs text-sky-600 dark:text-sky-500">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              {t.apiKeys.apiActiveStatus}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full max-w-3xl min-w-0">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.apiKeys.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t.apiKeys.subtitle}</p>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10 px-4 py-3.5" data-testid="banner-api-active">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">{t.apiKeys.apiBannerTitle}</p>
            <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">{t.apiKeys.apiBannerDesc}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMode("hosted")}
            data-testid="button-mode-hosted"
            className={`rounded-xl border-2 p-5 text-left transition-all focus:outline-none ${
              mode === "hosted"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${mode === "hosted" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-sm">Hosted Page</span>
                  {mode === "hosted" && <Badge className="text-[10px] px-1.5 py-0">{t.apiKeys.modeActive}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t.apiKeys.hostedPageDesc}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode("sdk")}
            data-testid="button-mode-sdk"
            className={`rounded-xl border-2 p-5 text-left transition-all focus:outline-none ${
              mode === "sdk"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${mode === "sdk" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Code2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-sm">SDK Direct API</span>
                  {mode === "sdk" && <Badge className="text-[10px] px-1.5 py-0">{t.apiKeys.modeActive}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t.apiKeys.sdkDesc}</p>
              </div>
            </div>
          </button>
        </div>

        {mode === "hosted" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Key, label: t.apiKeys.step1Label, desc: t.apiKeys.step1Desc },
                { icon: Zap, label: t.apiKeys.step2Label, desc: t.apiKeys.step2Desc },
                { icon: Shield, label: t.apiKeys.step3Label, desc: t.apiKeys.step3Desc },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.apiKeys.configSection}</p>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  {t.apiKeys.configTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="success-url">Success Redirect URL</Label>
                  <Input
                    id="success-url"
                    data-testid="input-success-url"
                    placeholder="https://monsite.com/payment/success"
                    value={successUrl}
                    onChange={(e) => setSuccessUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t.apiKeys.successUrlDesc}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancel-url">Cancel Redirect URL</Label>
                  <Input
                    id="cancel-url"
                    data-testid="input-cancel-url"
                    placeholder="https://monsite.com/payment/cancel"
                    value={cancelUrl}
                    onChange={(e) => setCancelUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t.apiKeys.cancelUrlDesc}</p>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="notify-url" className="flex items-center gap-2">
                    {t.apiKeys.webhookLabel}
                    <span className="text-[10px] bg-violet-500/10 text-violet-500 border border-violet-500/20 px-1.5 py-0.5 rounded font-mono">{t.apiKeys.webhookBadge}</span>
                  </Label>
                  <Input
                    id="notify-url"
                    data-testid="input-notify-url"
                    placeholder="https://monsite.com/webhooks/ashtechpay"
                    value={notifyUrl}
                    onChange={(e) => setNotifyUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t.apiKeys.webhookDesc}</p>
                </div>

                {hasHpKeys ? (
                  <Button
                    variant="outline"
                    onClick={() => hpMutation.mutate({ successUrl, cancelUrl, notifyUrl })}
                    disabled={hpMutation.isPending}
                    data-testid="button-save-urls"
                  >
                    {hpMutation.isPending ? t.apiKeys.savingButton : t.apiKeys.saveUrlsButton}
                  </Button>
                ) : (
                  <Button
                    onClick={() => hpMutation.mutate({ successUrl, cancelUrl, notifyUrl })}
                    disabled={hpMutation.isPending}
                    data-testid="button-generate-keys"
                    className="w-full sm:w-auto"
                  >
                    {hpMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        {t.apiKeys.generatingButton}
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-2" />
                        Generate API Keys
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            {hasHpKeys && (
              <Card>
                <CardHeader className="pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.apiKeys.keysSection}</p>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      API Keys
                    </CardTitle>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                      {t.apiKeys.keysActive}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CopyableKey
                    label="Public Key"
                    value={hpConfig!.pkLive!}
                    icon={<Key className="h-3.5 w-3.5" />}
                  />
                  <CopyableKey
                    label="Secret Key"
                    value={hpConfig!.skLive!}
                    icon={<Shield className="h-3.5 w-3.5" />}
                  />
                  <CopyableKey
                    label="Hosted Page Key"
                    value={hpConfig!.hpLive!}
                    icon={<Globe className="h-3.5 w-3.5" />}
                  />

                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => hpMutation.mutate({ successUrl, cancelUrl, notifyUrl, regenerate: true })}
                      disabled={hpMutation.isPending}
                      data-testid="button-regenerate-keys"
                      className="text-destructive hover:text-destructive"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-2" />
                      {t.apiKeys.regenerateKeys}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1.5">{t.apiKeys.regenerateWarning}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {hasHpKeys && (
              <Link href="/dashboard/hosted-page/docs">
                <Button className="w-full" data-testid="button-documentation">
                  <BookOpen className="h-4 w-4 mr-2" />
                  {t.apiKeys.docButton}
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            )}

            {hpLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {mode === "sdk" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.apiKeys.sdkAuthSection}</p>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  {t.apiKeys.sdkAuthTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{t.apiKeys.sdkAuthDesc}</p>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <code
                      className="text-sm font-mono text-foreground flex-1 min-w-0 break-all select-all"
                      data-testid="text-api-key"
                    >
                      {sdkLoading ? t.apiKeys.sdkLoading : showKey ? apiKey : maskedKey}
                    </code>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowKey((v) => !v)}
                        disabled={sdkLoading || !apiKey}
                        data-testid="button-toggle-key-visibility"
                        title={showKey ? t.apiKeys.sdkHide : t.apiKeys.sdkShow}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={copyKey}
                        disabled={sdkLoading || !apiKey}
                        data-testid="button-copy-key"
                        title={t.apiKeys.sdkCopy}
                      >
                        {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t.apiKeys.sdkRegenerateWarning}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerateMutation.mutate()}
                    disabled={regenerateMutation.isPending}
                    data-testid="button-regenerate-key"
                    className="shrink-0 ml-4"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                    {t.apiKeys.sdkRegenerate}
                  </Button>
                </div>

                <Link href="/dashboard/developer">
                  <Button className="w-full mt-2" data-testid="link-open-docs">
                    <BookOpen className="w-4 h-4 mr-2" />
                    {t.apiKeys.sdkDocsButton}
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  {t.apiKeys.sdkExampleTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted/60 rounded-lg p-4 overflow-x-auto max-w-full text-foreground/90 leading-relaxed">
{`fetch("https://api.ashtechpay.top/v1/collect", {
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
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
