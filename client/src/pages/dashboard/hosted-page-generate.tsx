import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Key, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function HostedPageGenerate() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const hp = t.hostedPage;
  const [name, setName] = useState("");

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hosted-page/keys", { name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosted-page/keys"] });
      toast({ title: hp.keyGenerated, description: hp.keyGeneratedDesc });
      setLocation("/dashboard/hosted-page");
    },
    onError: () => {
      toast({ title: hp.configError, description: hp.keyErrorDesc, variant: "destructive" });
    },
  });

  return (
    <DashboardLayout>
      <div className="w-full max-w-2xl space-y-7">
        <Button variant="ghost" className="-ml-3 gap-2" onClick={() => setLocation("/dashboard/hosted-page")}>
          <ArrowLeft className="h-4 w-4" />
          {hp.backToKeys}
        </Button>

        <div>
          <h1 className="text-2xl font-semibold text-foreground">{hp.generateTitle}</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{hp.generateSubtitle}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{hp.keyNameTitle}</CardTitle>
            <CardDescription>{hp.keyNameDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim()) generateMutation.mutate();
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
                disabled={!name.trim() || generateMutation.isPending}
                className="gap-2"
                data-testid="button-create-checkout-key"
              >
                {generateMutation.isPending ? (
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}