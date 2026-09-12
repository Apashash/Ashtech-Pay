import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, KeyRound, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language";
import { CopyableKey, HostedPageKey } from "./hosted-page-key-display";
import { CreateHostedPageKeyDialog, EditHostedPageUrlsDialog } from "./hosted-page-key-dialog";

export default function HostedPageKeys() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const hp = t.hostedPage;
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<HostedPageKey | null>(null);

  const { data: keys = [], isLoading } = useQuery<HostedPageKey[]>({
    queryKey: ["/api/hosted-page/keys"],
    refetchOnWindowFocus: false,
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

  const deleteMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiRequest("DELETE", `/api/hosted-page/keys/${encodeURIComponent(keyId)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosted-page/keys"] });
      toast({ title: hp.keyDeleted, description: hp.keyDeletedDesc });
    },
    onError: () => {
      toast({ title: hp.configError, description: hp.keyErrorDesc, variant: "destructive" });
    },
  });

  function regenerateKey(key: HostedPageKey) {
    if (window.confirm(hp.regenerateWarning)) regenerateMutation.mutate(key.id);
  }

  function deleteKey(key: HostedPageKey) {
    if (key.isLegacy) return;
    if (window.confirm(hp.deleteWarning)) deleteMutation.mutate(key.id);
  }

  return (
    <DashboardLayout>
      <div className="w-full max-w-5xl space-y-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard/hosted-page")} aria-label={hp.backToCheckout}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <KeyRound className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{hp.myKeys}</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{hp.keysDesc}</p>
            </div>
          </div>
          <Button onClick={() => setGenerateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {hp.generateKey}
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </CardContent>
          </Card>
        ) : keys.length === 0 ? (
          <Card>
            <CardContent className="rounded-xl border border-dashed p-10 text-center">
              <KeyRound className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">{hp.noKeys}</p>
              <p className="mt-1 text-xs text-muted-foreground">{hp.noKeysDesc}</p>
              <Button className="mt-4 gap-2" onClick={() => setGenerateOpen(true)}>
                <Plus className="h-4 w-4" />
                {hp.generateKey}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            {keys.map((key) => (
              <Card key={key.id} className="min-w-0 overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">
                        {key.isLegacy ? hp.defaultKeyName : key.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {key.isLegacy ? hp.defaultKeyDesc : hp.namedKey}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="shrink-0 border-green-500/20 bg-green-500/10 text-green-600">
                      {hp.active}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="min-w-0 space-y-4">
                  <div className="space-y-3">
                    <CopyableKey label={hp.publicKey} value={key.pkLive} testId={`${key.id}-public`} />
                    <CopyableKey label={hp.secretKey} value={key.skLive} testId={`${key.id}-secret`} />
                    <CopyableKey label={hp.checkoutKey} value={key.hpLive} testId={`${key.id}-checkout`} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t pt-4">
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
                    {!key.isLegacy && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteKey(key)}
                        disabled={deleteMutation.isPending}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {hp.deleteKey}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingKey(key)}
                      className="ml-auto gap-2"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {hp.editUrls}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateHostedPageKeyDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onViewKeys={() => setGenerateOpen(false)}
      />
      <EditHostedPageUrlsDialog
        keyToEdit={editingKey}
        open={Boolean(editingKey)}
        onOpenChange={(open) => {
          if (!open) setEditingKey(null);
        }}
      />
    </DashboardLayout>
  );
}