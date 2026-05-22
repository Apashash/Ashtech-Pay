import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Key, Shield, Globe, Zap, Copy, Eye, EyeOff, CheckCheck, RefreshCw, BookOpen, ChevronRight
} from "lucide-react";
import { useLanguage } from "@/lib/language";

interface HostedPageConfig {
  pkLive: string | null;
  skLive: string | null;
  hpLive: string | null;
  successUrl: string | null;
  cancelUrl: string | null;
  notifyUrl: string | null;
}

function CopyableKey({ label, value }: { label: string; value: string; icon?: React.ReactNode }) {
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
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-lg border px-3 py-2">
          <code className="text-sm font-mono flex-1 truncate text-foreground">
            {visible ? value : masked}
          </code>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setVisible(!visible)}
          data-testid={`toggle-${label.toLowerCase().replace(/\s/g, "-")}`}
          className="h-9 w-9 p-0 shrink-0"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          data-testid={`copy-${label.toLowerCase().replace(/\s/g, "-")}`}
          className="h-9 w-9 p-0 shrink-0"
        >
          {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function HostedPageDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { t } = useLanguage();
  const hp = t.hostedPage;

  const [successUrl, setSuccessUrl] = useState("");
  const [cancelUrl, setCancelUrl] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { data: config, isLoading } = useQuery<HostedPageConfig | null>({
    queryKey: ["/api/hosted-page/config"],
    select: (data) => data,
    refetchOnWindowFocus: false,
  });

  if (config && !initialized) {
    setSuccessUrl(config.successUrl || "");
    setCancelUrl(config.cancelUrl || "");
    setNotifyUrl(config.notifyUrl || "");
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data: { successUrl: string; cancelUrl: string; notifyUrl: string; regenerate?: boolean }) =>
      apiRequest("POST", "/api/hosted-page/config", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hosted-page/config"] });
      toast({ title: hp.configSaved, description: hp.configSavedDesc });
    },
    onError: () => {
      toast({ title: hp.configError, description: hp.configErrorDesc, variant: "destructive" });
    },
  });

  const hasKeys = config?.pkLive && config?.skLive && config?.hpLive;

  const steps = [
    { icon: Key,    label: hp.step1Label, desc: hp.step1Desc },
    { icon: Zap,    label: hp.step2Label, desc: hp.step2Desc },
    { icon: Shield, label: hp.step3Label, desc: hp.step3Desc },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Globe className="h-4 w-4 text-violet-500" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Hosted Payment Page</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">
            {hp.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {steps.map(({ icon: Icon, label, desc }) => (
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
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>{hp.redirectsDesc}</CardDescription>
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
              <p className="text-xs text-muted-foreground">{hp.successUrlDesc}</p>
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
              <p className="text-xs text-muted-foreground">{hp.cancelUrlDesc}</p>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="notify-url" className="flex items-center gap-2">
                Webhook URL (notify_url)
                <span className="text-[10px] bg-violet-500/10 text-violet-500 border border-violet-500/20 px-1.5 py-0.5 rounded font-mono">
                  {hp.recommended}
                </span>
              </Label>
              <Input
                id="notify-url"
                data-testid="input-notify-url"
                placeholder="https://monsite.com/webhooks/ashtechpay"
                value={notifyUrl}
                onChange={(e) => setNotifyUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{hp.notifyUrlDesc}</p>
            </div>

            {hasKeys ? (
              <Button
                variant="outline"
                onClick={() => saveMutation.mutate({ successUrl, cancelUrl, notifyUrl })}
                disabled={saveMutation.isPending}
                data-testid="button-save-urls"
              >
                {saveMutation.isPending ? hp.saving : hp.saveUrls}
              </Button>
            ) : (
              <Button
                onClick={() => saveMutation.mutate({ successUrl, cancelUrl, notifyUrl })}
                disabled={saveMutation.isPending}
                data-testid="button-generate-keys"
                className="w-full sm:w-auto"
              >
                {saveMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {hp.generating}
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

        {hasKeys && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">API Keys</CardTitle>
                  <CardDescription>{hp.keysDesc}</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                  {hp.active}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CopyableKey label="Public Key"      value={config!.pkLive!} />
              <CopyableKey label="Secret Key"      value={config!.skLive!} />
              <CopyableKey label="Hosted Page Key" value={config!.hpLive!} />

              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveMutation.mutate({ successUrl, cancelUrl, notifyUrl, regenerate: true })}
                  disabled={saveMutation.isPending}
                  data-testid="button-regenerate-keys"
                  className="text-destructive hover:text-destructive"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  {hp.regenerate}
                </Button>
                <p className="text-xs text-muted-foreground mt-1.5">{hp.regenerateWarning}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {hasKeys && (
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{hp.docTitle}</p>
                  <p className="text-xs text-muted-foreground">{hp.docDesc}</p>
                </div>
                <Link href="/docs/hosted-page">
                  <Button data-testid="button-documentation" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    Documentation
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
