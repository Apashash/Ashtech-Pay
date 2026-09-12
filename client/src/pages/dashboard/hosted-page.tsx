import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Globe, KeyRound, BookOpen, ExternalLink, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/language";
import { PUBLIC_CHECKOUT_DOCS_URL } from "@/lib/public-links";
import { CreateHostedPageKeyDialog } from "./hosted-page-key-dialog";

interface HostedPageConfig {
  successUrl: string | null;
  cancelUrl: string | null;
  notifyUrl: string | null;
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
  const [generateOpen, setGenerateOpen] = useState(false);

  const { data: config, isLoading } = useQuery<HostedPageConfig | null>({
    queryKey: ["/api/hosted-page/config"],
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

  return (
    <DashboardLayout>
      <div className="w-full max-w-4xl space-y-7">
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
          <Button
            variant="outline"
            onClick={() => setLocation("/dashboard/hosted-page/keys")}
            className="gap-2"
            data-testid="button-my-checkout-keys"
          >
            <KeyRound className="h-4 w-4" />
            {hp.myKeys}
          </Button>
        </div>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{hp.configTitle}</CardTitle>
            <CardDescription>{hp.redirectsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
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

                <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    onClick={() => saveMutation.mutate({ successUrl, cancelUrl, notifyUrl })}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-urls"
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saveMutation.isPending ? hp.saving : hp.saveUrls}
                  </Button>
                  <Button
                    onClick={() => setGenerateOpen(true)}
                    className="gap-2"
                    data-testid="button-generate-checkout-key"
                  >
                    <KeyRound className="h-4 w-4" />
                    {hp.generateKey}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{hp.generateBelowUrls}</p>
              </>
            )}
          </CardContent>
        </Card>

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

      <CreateHostedPageKeyDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onViewKeys={() => setLocation("/dashboard/hosted-page/keys")}
      />
    </DashboardLayout>
  );
}