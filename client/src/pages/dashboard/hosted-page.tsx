import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Globe,
  Copy,
  Eye,
  EyeOff,
  CheckCheck,
  RefreshCw,
  BookOpen,
  ExternalLink,
  Plus,
} from "lucide-react";
import { useLanguage } from "@/lib/language";
import { PUBLIC_CHECKOUT_DOCS_URL } from "@/lib/public-links";

interface HostedPageConfig {
  successUrl: string | null;
  cancelUrl: string | null;
  notifyUrl: string | null;
}

interface HostedPageKey {
  id: string;
  name: string;
  pkLive: string;
  skLive: string;
  hpLive: string;
  createdAt?: string | null;
  isLegacy?: boolean;
}

function CopyableKey({ label, value, testId }: { label: string; value: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const hp = t.hostedPage;

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: hp.keyCopied, description: `${label} ${hp.keyCopiedDesc}` });
  }

  const masked = value.slice(0, 12) + "•".repeat(20) + value.slice(-4);

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="flex min-w-0 max-w-full items-center gap-2">
        <div className="flex min-w-0 max-w-full flex-1 items-center overflow-hidden rounded-lg border bg-muted/50 px-3 py-2">
          <code
            className={`min-w-0 max-w-full flex-1 font-mono text-sm text-foreground ${
              visible ? "break-all whitespace-normal" : "truncate whitespace-nowrap"
            }`}
          >
            {visible ? value : masked}
          </code>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setVisible((current) => !current)}
          data-testid={`toggle-${testId}`}
          className="h-9 w-9 shrink-0 p-0"
          aria-label={visible ? hp.hideKey : hp.showKey}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          data-testid={`copy-${testId}`}
          className="h-9 w-9 shrink-0 p-0"
          aria-label={hp.copyKey}
        >
          {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function HostedPageDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const hp = t.hostedPage;

  const [successUrl, setSuccessUrl] = useState("");
  const [cancelUrl, setCancelUrl] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery<HostedPageConfig | null>({
    queryKey: ["/api/hosted-page/config"],
    refetchOnWindowFocus: false,
  });
  const { data: keys = [], isLoading: keysLoading } = useQuery<HostedPageKey[]>({
    queryKey: ["/api/hosted-page/keys"],
    refetchOnWindowFocus: false,
  });

  if (config && !initialized) {
    setSuccessUrl(config.successUrl || "");
    setCancelUrl(config.cancelUrl || "");
    setNotifyUrl(config.notifyUrl || "");
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data: { successUrl: string; cancelUrl: string; notifyUrl: string }) =>
      apiRequest("POST", "/api/hosted-page/config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosted-page/config"] });
      toast({ title: hp.configSaved, description: hp.configSavedDesc });
    },
    onError: () => {
      toast({ title: hp.configError, description: hp.configErrorDesc, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiRequest("POST", `/api/hosted-page/keys/${encodeURIComponent(keyId)}/regenerate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosted-page/keys"] });
      toast({ title: hp.keyRegenerated, description: hp.keyRegeneratedDesc });
    },
    onError: () => {
      toast({ title: hp.configError, description: hp.keyErrorDesc, variant: "destructive" });
    },
  });

  function regenerateKey(key: HostedPageKey) {
    if (window.confirm(hp.regenerateWarning)) {
      regenerateMutation.mutate(key.id);
    }
  }

  return (
    <DashboardLayout>
      <div className="w-full max-w-5xl space-y-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <Globe className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{hp.title}</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{hp.subtitle}</p>
            </div>
          </div>
          <Button onClick={() => setLocation("/dashboard/hosted-page/generate")} className="gap-2">
            <Plus className="h-4 w-4" />
            {hp.generateKey}
          </Button>
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{hp.configTitle}</CardTitle>
              <CardDescription>{hp.redirectsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="success-url">{hp.successUrlLabel}</Label>
                <Input
                  className="min-w-0 max-w-full truncate"
                  id="success-url"
                  data-testid="input-success-url"
                  placeholder="https://monsite.com/payment/success"
                  value={successUrl}
                  onChange={(event) => setSuccessUrl(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cancel-url">{hp.cancelUrlLabel}</Label>
                <Input
                  className="min-w-0 max-w-full truncate"
                  id="cancel-url"
                  data-testid="input-cancel-url"
                  placeholder="https://monsite.com/payment/cancel"
                  value={cancelUrl}
                  onChange={(event) => setCancelUrl(event.target.value)}
                />
              </div>
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="notify-url" className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate">{hp.notifyUrlLabel}</span>
                  <span className="shrink-0 rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-500">
                    {hp.recommended}
                  </span>
                </Label>
                <Input
                  className="min-w-0 max-w-full truncate"
                  id="notify-url"
                  data-testid="input-notify-url"
                  placeholder="https://monsite.com/webhooks/ashtechpay"
                  value={notifyUrl}
                  onChange={(event) => setNotifyUrl(event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => saveMutation.mutate({ successUrl, cancelUrl, notifyUrl })}
                disabled={saveMutation.isPending}
                data-testid="button-save-urls"
              >
                {saveMutation.isPending ? hp.saving : hp.saveUrls}
              </Button>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{hp.keysTitle}</CardTitle>
              <CardDescription>{hp.keysDesc}</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              {keysLoading || configLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : keys.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <Key className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">{hp.noKeys}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{hp.noKeysDesc}</p>
                  <Button size="sm" className="mt-4 gap-2" onClick={() => setLocation("/dashboard/hosted-page/generate")}>
                    <Plus className="h-4 w-4" />
                    {hp.generateKey}
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {keys.map((key) => (
                    <div key={key.id} className="min-w-0 space-y-4 rounded-xl border p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {key.isLegacy ? hp.defaultKeyName : key.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {key.isLegacy ? hp.defaultKeyDesc : hp.namedKey}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 border-green-500/20 bg-green-500/10 text-green-600">
                          {hp.active}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <CopyableKey label={hp.publicKey} value={key.pkLive} testId={`${key.id}-public`} />
                        <CopyableKey label={hp.secretKey} value={key.skLive} testId={`${key.id}-secret`} />
                        <CopyableKey label={hp.checkoutKey} value={key.hpLive} testId={`${key.id}-checkout`} />
                      </div>
                      <div className="border-t pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => regenerateKey(key)}
                          disabled={regenerateMutation.isPending}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                          {hp.regenerateKey}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-foreground">{hp.docTitle}</p>
            <a href={PUBLIC_CHECKOUT_DOCS_URL} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto" data-testid="button-documentation">
                <BookOpen className="h-4 w-4" />
                {hp.documentation}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}