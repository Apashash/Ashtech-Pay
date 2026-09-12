import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Key, RefreshCw } from "lucide-react";
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
import { CopyableKey, HostedPageKey } from "./hosted-page-key-display";

interface CreateHostedPageKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewKeys: () => void;
}

export function CreateHostedPageKeyDialog({
  open,
  onOpenChange,
  onViewKeys,
}: CreateHostedPageKeyDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const hp = t.hostedPage;
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<HostedPageKey | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/hosted-page/keys", { name: name.trim() });
      return response.json() as Promise<HostedPageKey>;
    },
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosted-page/keys"] });
      setCreatedKey(key);
    },
    onError: () => {
      toast({ title: hp.configError, description: hp.keyErrorDesc, variant: "destructive" });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{hp.editUrlsTitle}</DialogTitle>
          <DialogDescription>
            {hp.editUrlsDesc} {keyToEdit ? `« ${keyToEdit.isLegacy ? hp.defaultKeyName : keyToEdit.name} »` : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (keyToEdit) updateMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="key-success-url">{hp.successUrlLabel}</Label>
            <Input
              id="key-success-url"
              value={successUrl}
              placeholder="https://monsite.com/payment/success"
              onChange={(event) => setSuccessUrl(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="key-cancel-url">{hp.cancelUrlLabel}</Label>
            <Input
              id="key-cancel-url"
              value={cancelUrl}
              placeholder="https://monsite.com/payment/cancel"
              onChange={(event) => setCancelUrl(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="key-notify-url">{hp.notifyUrlLabel}</Label>
            <Input
              id="key-notify-url"
              value={notifyUrl}
              placeholder="https://monsite.com/webhooks/ashtechpay"
              onChange={(event) => setNotifyUrl(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={!keyToEdit || updateMutation.isPending} className="w-full gap-2">
            {updateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {hp.saving}
              </>
            ) : (
              hp.saveUrls
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}