import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language";
import { PUBLIC_API_DOCS_URL } from "@/lib/public-links";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  CheckCheck,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
} from "lucide-react";

type ApiKeyResponse = {
  apiKey: string;
};

type WebhookSecretResponse = {
  webhookSecret: string;
};

function maskApiKey(value: string): string {
  if (value.length <= 12) return "•".repeat(value.length);
  return `${value.slice(0, 8)}${"•".repeat(24)}${value.slice(-4)}`;
}

export default function DirectApiPage() {
  const { t } = useLanguage();
  const copy = t.apiKeys;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookSecretVisible, setWebhookSecretVisible] = useState(false);
  const [webhookSecretCopied, setWebhookSecretCopied] = useState(false);

  const { data, isLoading, isError, error: apiKeyQueryError } = useQuery<ApiKeyResponse>({
    queryKey: ["/api/user/api-key"],
    refetchOnWindowFocus: false,
  });

  const {
    data: webhookSecretData,
    isFetching: webhookSecretIsFetching,
    isError: webhookSecretIsError,
    refetch: loadWebhookSecret,
  } = useQuery<WebhookSecretResponse>({
    queryKey: ["/api/user/webhook-secret"],
    enabled: false,
    refetchOnWindowFocus: false,
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/user/api-key/regenerate");
      return response.json() as Promise<ApiKeyResponse>;
    },
    onSuccess: (nextKey) => {
      queryClient.setQueryData(["/api/user/api-key"], nextKey);
      setVisible(true);
      setCopied(false);
      toast({
        title: copy.toastRegenerated,
        description: copy.toastRegeneratedDesc,
      });
    },
    onError: () => {
      toast({
        title: copy.toastError,
        description: copy.toastImpossibleRegen,
        variant: "destructive",
      });
    },
  });

  const regenerateWebhookSecretMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/user/webhook-secret/regenerate");
      return response.json() as Promise<WebhookSecretResponse>;
    },
    onSuccess: (nextSecret) => {
      queryClient.setQueryData(["/api/user/webhook-secret"], nextSecret);
      setWebhookSecretVisible(true);
      setWebhookSecretCopied(false);
      toast({
        title: copy.webhookSecretRegenerated,
        description: copy.webhookSecretRegeneratedDesc,
      });
    },
    onError: () => {
      toast({
        title: copy.toastError,
        description: copy.webhookSecretError,
        variant: "destructive",
      });
    },
  });

  const apiKey = data?.apiKey ?? "";
  const apiKeyErrorCode = (apiKeyQueryError as (Error & { error?: string }) | null)?.error;
  const apiKeyLoadErrorMessage = apiKeyErrorCode === "api_key_unavailable"
    ? copy.sdkKeyUnavailable
    : copy.sdkLoadError;
  const canRegenerateUnavailableKey = apiKeyErrorCode === "api_key_unavailable" ||
    (!isError && !isLoading && !apiKey);
  const webhookSecret = webhookSecretData?.webhookSecret ?? "";

  async function copyApiKey() {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast({
      title: copy.toastApiKeyCopied,
      description: copy.toastApiKeyCopiedDesc,
    });
    window.setTimeout(() => setCopied(false), 2000);
  }

  function regenerateApiKey() {
    if (window.confirm(copy.sdkRegenerateWarning)) {
      regenerateMutation.mutate();
    }
  }

  async function toggleWebhookSecretVisibility() {
    if (webhookSecret) {
      setWebhookSecretVisible((current) => !current);
      return;
    }

    const result = await loadWebhookSecret();
    if (result.data?.webhookSecret) {
      setWebhookSecretVisible(true);
      setWebhookSecretCopied(false);
    }
  }

  async function copyWebhookSecret() {
    if (!webhookSecret) return;
    try {
      await navigator.clipboard.writeText(webhookSecret);
      setWebhookSecretCopied(true);
      toast({
        title: copy.webhookSecretCopied,
        description: copy.webhookSecretCopiedDesc,
      });
      window.setTimeout(() => setWebhookSecretCopied(false), 2000);
    } catch {
      toast({
        title: copy.toastError,
        description: copy.webhookSecretCopyError,
        variant: "destructive",
      });
    }
  }

  function regenerateWebhookSecret() {
    if (window.confirm(copy.webhookSecretRegenerateWarning)) {
      regenerateWebhookSecretMutation.mutate();
    }
  }

  return (
    <DashboardLayout>
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/api-keys">
            <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-blue-500/10 p-1">
            <img src="/api-integration-icon.png" alt="" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Direct API
            </h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" />
              {copy.sdkAuthTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {copy.sdkLoading}
              </div>
            ) : isError || !apiKey ? (
              <div role="alert" className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <p>{isError ? apiKeyLoadErrorMessage : copy.sdkKeyUnavailable}</p>
                {canRegenerateUnavailableKey && (
                  <Button
                    variant="outline"
                    onClick={regenerateApiKey}
                    disabled={regenerateMutation.isPending}
                    className="gap-2 text-destructive hover:text-destructive"
                    data-testid="button-regenerate-unavailable-direct-api-key"
                  >
                    <RefreshCw className={`h-4 w-4 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                    {copy.sdkRegenerate}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                  <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
                    {visible ? apiKey : maskApiKey(apiKey)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVisible((current) => !current)}
                    className="h-9 shrink-0 gap-2"
                    data-testid="button-toggle-direct-api-key"
                  >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="hidden sm:inline">{visible ? copy.sdkHide : copy.sdkShow}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void copyApiKey()}
                    className="h-9 shrink-0 gap-2"
                    data-testid="button-copy-direct-api-key"
                  >
                    {copied ? <CheckCheck className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    <span className="hidden sm:inline">{copy.sdkCopy}</span>
                  </Button>
                </div>

                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {copy.sdkRegenerateWarning}
                  </p>
                  <Button
                    variant="outline"
                    onClick={regenerateApiKey}
                    disabled={regenerateMutation.isPending}
                    className="shrink-0 gap-2 text-destructive hover:text-destructive"
                    data-testid="button-regenerate-direct-api-key"
                  >
                    <RefreshCw className={`h-4 w-4 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                    {copy.sdkRegenerate}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" />
              {copy.webhookSecretTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {webhookSecretIsError && !webhookSecret && (
              <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {copy.webhookSecretLoadError}
              </p>
            )}
            {webhookSecret ? (
              <>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                  <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
                    {webhookSecretVisible ? webhookSecret : maskApiKey(webhookSecret)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWebhookSecretVisible((current) => !current)}
                    className="h-9 shrink-0 gap-2"
                    aria-label={webhookSecretVisible ? copy.sdkHide : copy.sdkShow}
                    data-testid="button-toggle-webhook-secret"
                  >
                    {webhookSecretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="hidden sm:inline">{webhookSecretVisible ? copy.sdkHide : copy.sdkShow}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void copyWebhookSecret()}
                    className="h-9 shrink-0 gap-2"
                    data-testid="button-copy-webhook-secret"
                  >
                    {webhookSecretCopied ? <CheckCheck className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    <span className="hidden sm:inline">{webhookSecretCopied ? copy.webhookSecretCopied : copy.sdkCopy}</span>
                  </Button>
                </div>
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {copy.webhookSecretRotationHint}
                  </p>
                  <Button
                    variant="outline"
                    onClick={regenerateWebhookSecret}
                    disabled={regenerateWebhookSecretMutation.isPending}
                    className="shrink-0 gap-2 text-destructive hover:text-destructive"
                    data-testid="button-regenerate-webhook-secret"
                  >
                    <RefreshCw className={`h-4 w-4 ${regenerateWebhookSecretMutation.isPending ? "animate-spin" : ""}`} />
                    {copy.webhookSecretRegenerate}
                  </Button>
                </div>
              </>
            ) : (
              <Button
                onClick={() => void toggleWebhookSecretVisibility()}
                disabled={webhookSecretIsFetching}
                className="gap-2"
                data-testid="button-show-webhook-secret"
              >
                {webhookSecretIsFetching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {webhookSecretIsFetching ? copy.sdkLoading : copy.webhookSecretShow}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{copy.sdkExampleTitle}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Utilisez votre clé uniquement depuis votre serveur, dans l’en-tête Bearer de vos requêtes.
              </p>
            </div>
            <a href={PUBLIC_API_DOCS_URL} target="_blank" rel="noreferrer">
              <Button variant="outline" className="shrink-0 gap-2" data-testid="button-direct-api-documentation">
                <BookOpen className="h-4 w-4" />
                {copy.sdkDocsButton}
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}