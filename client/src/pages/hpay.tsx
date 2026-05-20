import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelectContent } from "@/components/ui/searchable-select-content";
import { useToast } from "@/hooks/use-toast";
import { Shield, Globe, CheckCircle2, XCircle, Loader2, Phone, AlertCircle } from "lucide-react";

interface HostedSession {
  payment_id: string;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  merchant_name: string;
  expires_at: string | null;
}

interface Country {
  id: string;
  name: string;
  code: string;
  currency: string;
  flag: string;
  operators: { id: string; name: string }[];
}

interface PayResult {
  status: string;
  transaction_id: string;
  flow: string;
  ussd_code: string | null;
  wave_url: string | null;
  otp_info: string | null;
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency === "GNF" ? "GNF" : currency === "CDF" ? "CDF" : currency }).format(amount);
}

type Step = "form" | "initiated" | "success" | "failed" | "expired";

export default function HPayPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("form");
  const [payResult, setPayResult] = useState<PayResult | null>(null);
  const [countryId, setCountryId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [phone, setPhone] = useState("");
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const sessionQuery = useQuery<HostedSession>({
    queryKey: [`/api/public/hosted-session/${id}`],
    refetchOnWindowFocus: false,
    retry: false,
  });

  const countriesQuery = useQuery<Country[]>({
    queryKey: ["/api/public/countries"],
    refetchOnWindowFocus: false,
  });

  const session = sessionQuery.data;
  const countries = countriesQuery.data || [];

  // Filter countries matching session currency
  const matchingCountries = session
    ? countries.filter((c) => c.currency === session.currency || c.operators.length > 0)
    : countries;

  const selectedCountry = matchingCountries.find((c) => c.id === countryId);
  const operators = selectedCountry?.operators || [];

  const payMutation = useMutation({
    mutationFn: async (body: { phone: string; countryId: string; operatorId: string }) => {
      const res = await fetch(`/api/public/hosted-session/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur lors de l'initiation du paiement.");
      return data as PayResult;
    },
    onSuccess: (result) => {
      setPayResult(result);
      if (result.flow === "wave" && result.wave_url) {
        window.location.href = result.wave_url;
        return;
      }
      setStep("initiated");
      startPolling();
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const startPolling = useCallback(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/hosted-session/${id}/status`);
        const data = await res.json();
        if (data.status === "success") {
          clearInterval(interval);
          setStep("success");
          setTimeout(() => {
            if (data.success_url) window.location.href = data.success_url;
          }, 3000);
        } else if (data.status === "failed") {
          clearInterval(interval);
          setStep("failed");
          setTimeout(() => {
            if (data.cancel_url) window.location.href = data.cancel_url;
          }, 3000);
        }
      } catch (_) {}
    }, 3000);
    setPollInterval(interval);
    return interval;
  }, [id]);

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  function handlePay() {
    if (!phone || !countryId || !operatorId) {
      toast({ title: "Champs manquants", description: "Veuillez remplir tous les champs.", variant: "destructive" });
      return;
    }
    payMutation.mutate({ phone, countryId, operatorId });
  }

  // Loading
  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error / not found
  if (sessionQuery.isError || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold">Lien introuvable</h1>
          <p className="text-muted-foreground text-sm">Ce lien de paiement n'existe pas ou a expiré.</p>
        </div>
      </div>
    );
  }

  if (session.status === "expired" || (session.expires_at && new Date() > new Date(session.expires_at))) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold">Lien expiré</h1>
          <p className="text-muted-foreground text-sm">Ce lien de paiement a expiré. Contactez le marchand pour en obtenir un nouveau.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Globe className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">Ashtech Pay</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-green-500" />
            <span>Paiement sécurisé</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          {/* Success */}
          {step === "success" && (
            <div className="text-center space-y-4 py-8">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto animate-in zoom-in duration-300">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-green-600">Paiement réussi !</h2>
                <p className="text-muted-foreground text-sm">Votre paiement a été confirmé. Redirection en cours...</p>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full animate-[progress_3s_linear]" style={{ width: "100%" }} />
              </div>
            </div>
          )}

          {/* Failed */}
          {step === "failed" && (
            <div className="text-center space-y-4 py-8">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-red-600">Paiement échoué</h2>
                <p className="text-muted-foreground text-sm">Le paiement n'a pas pu être complété. Redirection en cours...</p>
              </div>
            </div>
          )}

          {/* Initiated — USSD/OTP instructions */}
          {step === "initiated" && payResult && (
            <div className="space-y-5">
              {/* Amount summary */}
              <div className="rounded-2xl border bg-card p-5 text-center space-y-1">
                <p className="text-xs text-muted-foreground">Montant à payer</p>
                <p className="text-3xl font-bold text-foreground">
                  {new Intl.NumberFormat("fr-FR").format(session.amount)} <span className="text-lg text-muted-foreground">{session.currency}</span>
                </p>
                {session.description && <p className="text-sm text-muted-foreground">{session.description}</p>}
              </div>

              {/* Flow-specific instructions */}
              {payResult.flow === "otp_ussd" && payResult.ussd_code && (
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5 space-y-3">
                  <p className="text-sm font-semibold text-violet-300">Composez ce code USSD sur votre téléphone :</p>
                  <div className="bg-slate-100 border border-border rounded-xl p-3 text-center">
                    <code className="text-2xl font-mono text-violet-700 tracking-wider">{payResult.ussd_code}</code>
                  </div>
                  <p className="text-xs text-muted-foreground">Suivez les instructions sur votre téléphone pour confirmer le paiement.</p>
                </div>
              )}

              {payResult.flow === "otp_sms" && (
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-2">
                  <p className="text-sm font-semibold text-blue-300">Vérifiez votre SMS</p>
                  <p className="text-sm text-muted-foreground">
                    {payResult.otp_info || "Vous allez recevoir un SMS avec un code OTP. Entrez ce code pour confirmer le paiement."}
                  </p>
                </div>
              )}

              {payResult.flow === "ussd_push" && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-2">
                  <p className="text-sm font-semibold text-amber-300">Vérifiez votre téléphone</p>
                  <p className="text-sm text-muted-foreground">
                    Vous allez recevoir une notification USSD sur votre téléphone. Acceptez et entrez votre code PIN pour confirmer le paiement.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>En attente de confirmation...</span>
              </div>
            </div>
          )}

          {/* Form */}
          {step === "form" && (
            <div className="space-y-5">
              {/* Amount card */}
              <div className="rounded-2xl border bg-card p-5 text-center space-y-1">
                <p className="text-xs text-muted-foreground">{session.merchant_name}</p>
                <p className="text-3xl font-bold text-foreground">
                  {new Intl.NumberFormat("fr-FR").format(session.amount)} <span className="text-lg text-muted-foreground">{session.currency}</span>
                </p>
                {session.description && <p className="text-sm text-muted-foreground">{session.description}</p>}
              </div>

              {/* Payment form */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h2 className="font-semibold text-sm">Choisissez votre mode de paiement</h2>

                {countriesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="country">Pays</Label>
                      <Select
                        value={countryId}
                        onValueChange={(v) => { setCountryId(v); setOperatorId(""); }}
                      >
                        <SelectTrigger id="country" data-testid="select-country">
                          <SelectValue placeholder="Sélectionnez votre pays" />
                        </SelectTrigger>
                        <SearchableSelectContent
                          options={matchingCountries.map(c => ({
                            value: c.id,
                            label: c.name,
                            flag: c.flag,
                            testId: `country-option-${c.code}`,
                          }))}
                        />
                      </Select>
                    </div>

                    {countryId && (
                      <div className="space-y-2">
                        <Label htmlFor="operator">Opérateur</Label>
                        <Select value={operatorId} onValueChange={setOperatorId}>
                          <SelectTrigger id="operator" data-testid="select-operator">
                            <SelectValue placeholder="Sélectionnez l'opérateur" />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map((op) => (
                              <SelectItem key={op.id} value={op.id} data-testid={`operator-option-${op.id}`}>
                                {op.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {operatorId && (
                      <div className="space-y-2">
                        <Label htmlFor="phone">Numéro de téléphone</Label>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Input
                            id="phone"
                            data-testid="input-phone"
                            type="tel"
                            placeholder="6XXXXXXXX"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handlePay}
                      disabled={!phone || !countryId || !operatorId || payMutation.isPending}
                      data-testid="button-pay"
                    >
                      {payMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Traitement...
                        </>
                      ) : (
                        `Payer ${new Intl.NumberFormat("fr-FR").format(session.amount)} ${session.currency}`
                      )}
                    </Button>
                  </>
                )}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Paiement sécurisé par{" "}
                <span className="font-semibold text-foreground">Ashtech Pay</span>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
