import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language";
import { PUBLIC_API_DOCS_URL } from "@/lib/public-links";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  const { data, isLoading, isError } = useQuery<ApiKeyResponse>({
    queryKey: ["/api/user/api-key"],
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

  const apiKey = data?.apiKey ?? "";

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
            <h1 className="text-2xl font-semibold leading-8 tracking-tight text-foreground">
              Direct API
            </h1>
            <p className="mt-1 text-[15px] leading-6 text-muted-foreground">
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
            <CardDescription>{copy.sdkAuthDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {copy.sdkLoading}
              </div>
            ) : isError ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                Impossible de charger votre clé API. Veuillez réessayer.
              </p>
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
                  <p className="text-xs leading-5 text-muted-foreground">
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