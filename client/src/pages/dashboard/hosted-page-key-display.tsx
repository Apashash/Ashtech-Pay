import { useState } from "react";
import { CheckCheck, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language";

export interface HostedPageKey {
  id: string;
  name: string;
  pkLive: string;
  skLive: string;
  hpLive: string;
  createdAt?: string | null;
  isLegacy?: boolean;
}

export function CopyableKey({ label, value, testId }: { label: string; value: string; testId: string }) {
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