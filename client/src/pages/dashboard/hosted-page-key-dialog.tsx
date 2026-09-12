import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Globe2, Key, Link2, RefreshCw, Save, Webhook } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { CopyableKey, HostedPageKey } from "./hosted-page-key-display";

interface CreateHostedPageKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewKeys: () => void;
  urls?: {
    successUrl: string;
    cancelUrl: string;
    notifyUrl: string;
  };
}

export function CreateHostedPageKeyDialog({
  open,
  onOpenChange,
  onViewKeys,
  urls,
}: CreateHostedPageKeyDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const hp = t.hostedPage;
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<HostedPageKey | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/hosted-page/keys", {
        name: name.trim(),
        successUrl: urls?.successUrl || null,
        cancelUrl: urls?.cancelUrl || null,
        notifyUrl: urls?.notifyUrl || null,
      });
      return response.json() as Promise<HostedPageKey>;
    },
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosted-page/keys"] });
      setCreatedKey(key);
    },
    onError: (error: unknown) => {
      toast({
        title: hp.configError,
        description: error instanceof Error && error.message ? error.message : hp.keyErrorDesc,
        variant: "destructive",
      });
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setCreatedKey(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        {createdKey ? (
          <>
            <DialogHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <DialogTitle>{hp.keyGenerated}</DialogTitle>
              <DialogDescription>{hp.keyGeneratedDesc}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">{hp.keyNameLabel}</p>
                <p className="mt-1 font-medium">{createdKey.name}</p>
              </div>
              <div className="space-y-3">
                <CopyableKey label={hp.publicKey} value={createdKey.pkLive} testId="generated-public" />
                <CopyableKey label={hp.secretKey} value={createdKey.skLive} testId="generated-secret" />
                <CopyableKey label={hp.checkoutKey} value={createdKey.hpLive} testId="generated-checkout" />
              </div>
              <p className="text-xs text-muted-foreground">{hp.generatedKeyWarning}</p>
              <Button
                className="w-full gap-2"
                onClick={() => {
                  handleOpenChange(false);
                  onViewKeys();
                }}
              >
                <Key className="h-4 w-4" />
                {hp.viewMyKeys}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{hp.generateTitle}</DialogTitle>
              <DialogDescription>{hp.generateSubtitle}</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim()) createMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="checkout-key-name">{hp.keyNameLabel}</Label>
                <Input
                  id="checkout-key-name"
                  data-testid="input-checkout-key-name"
                  value={name}
                  maxLength={80}
                  placeholder={hp.keyNamePlaceholder}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">{hp.keyNameLimit}</p>
              </div>
              <Button
                type="submit"
                disabled={!name.trim() || createMutation.isPending}
                className="gap-2"
                data-testid="button-create-checkout-key"
              >
                {createMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {hp.generating}
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    {hp.generateKey}
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditHostedPageUrlsDialogProps {
  keyToEdit: HostedPageKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditHostedPageUrlsDialog({
  keyToEdit,
  open,
  onOpenChange,
}: EditHostedPageUrlsDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const hp = t.hostedPage;
  const [successUrl, setSuccessUrl] = useState("");
  const [cancelUrl, setCancelUrl] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");

  useEffect(() => {
    if (!keyToEdit) return;
    setSuccessUrl(keyToEdit.successUrl || "");
    setCancelUrl(keyToEdit.cancelUrl || "");
    setNotifyUrl(keyToEdit.notifyUrl || "");
  }, [keyToEdit]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/hosted-page/keys/${encodeURIComponent(keyToEdit!.id)}/urls`, {
        successUrl,
        cancelUrl,
        notifyUrl,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosted-page/keys"] });
      toast({ title: hp.urlsUpdated, description: hp.urlsUpdatedDesc });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: hp.configError, description: hp.keyErrorDesc, variant: "destructive" });
    },
  });

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {hp.editUrls}
          </BottomSheetTitle>
          <BottomSheetDescription>
            {hp.selectedKey}
            {keyToEdit ? ` : ${keyToEdit.isLegacy ? hp.defaultKeyName : keyToEdit.name}` : ""}
          </BottomSheetDescription>
        </BottomSheetHeader>

        {keyToEdit && (
          <div className="mb-1 flex items-center gap-3 rounded-xl border bg-muted/30 px-3.5 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Key className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {keyToEdit.isLegacy ? hp.defaultKeyName : keyToEdit.name}
              </p>
            </div>
            {keyToEdit.isLegacy && (
              <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {hp.legacyKey}
              </span>
            )}
          </div>
        )}

        <form
          className="space-y-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (keyToEdit) updateMutation.mutate();
          }}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-success-url" className="flex items-center gap-2 text-sm font-semibold">
                <Globe2 className="h-4 w-4 text-emerald-600" />
                {hp.successUrlLabel}
              </Label>
              <Input
                id="key-success-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={successUrl}
                placeholder="https://monsite.com/payment/success"
                onChange={(event) => setSuccessUrl(event.target.value)}
                className="h-11 rounded-xl bg-muted/20 px-3.5 shadow-sm transition-colors focus-visible:bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-cancel-url" className="flex items-center gap-2 text-sm font-semibold">
                <Globe2 className="h-4 w-4 text-rose-600" />
                {hp.cancelUrlLabel}
              </Label>
              <Input
                id="key-cancel-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={cancelUrl}
                placeholder="https://monsite.com/payment/cancel"
                onChange={(event) => setCancelUrl(event.target.value)}
                className="h-11 rounded-xl bg-muted/20 px-3.5 shadow-sm transition-colors focus-visible:bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-notify-url" className="flex items-center gap-2 text-sm font-semibold">
                <Webhook className="h-4 w-4 text-violet-600" />
                {hp.notifyUrlLabel}
                <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                  {hp.recommended}
                </span>
              </Label>
              <Input
                id="key-notify-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={notifyUrl}
                placeholder="https://monsite.com/webhooks/ashtechpay"
                onChange={(event) => setNotifyUrl(event.target.value)}
                className="h-11 rounded-xl bg-muted/20 px-3.5 shadow-sm transition-colors focus-visible:bg-background"
              />
            </div>
          </div>

          <BottomSheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {hp.cancel}
            </Button>
            <Button type="submit" disabled={!keyToEdit || updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {hp.saving}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {hp.saveUrls}
                </>
              )}
            </Button>
          </BottomSheetFooter>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  );
}