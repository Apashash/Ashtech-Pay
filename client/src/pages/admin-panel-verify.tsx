import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Smartphone, Loader2, RefreshCw, ArrowLeft } from "lucide-react";

export default function AdminPanelVerifyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    const tick = () => setSecondsLeft(30 - (Math.floor(Date.now() / 1000) % 30));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const verifyMutation = useMutation({
    mutationFn: async (otp: string) => {
      const res = await apiRequest("POST", "/api/auth/admin-panel-verify", { code: otp });
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.message || "Erreur"), json);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/otp-status"] });
      setLocation("/admin");
    },
    onError: (err: any) => {
      setCode("");
      toast({
        title: "Code incorrect",
        description: err.message || "Vérifiez Google Authenticator.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (code.length === 6 && !verifyMutation.isPending) {
      verifyMutation.mutate(code);
    }
  }, [code]);

  const isExpiringSoon = secondsLeft <= 5;
  const progress = ((30 - secondsLeft) / 30) * 100;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Back button */}
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </button>

        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground mb-1">Vérification Google Authenticator</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Entrez le code à 6 chiffres affiché dans{" "}
              <span className="font-semibold text-foreground">Google Authenticator</span>{" "}
              pour accéder au panneau admin.
            </p>
          </div>

          {/* Countdown ring */}
          <div className="flex flex-col items-center gap-1">
            <div className="relative w-14 h-14">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/30" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
                  strokeDasharray="100"
                  strokeDashoffset={progress}
                  strokeLinecap="round"
                  stroke="currentColor"
                  className={isExpiringSoon ? "text-red-500" : "text-primary"}
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
                />
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums ${isExpiringSoon ? "text-red-500" : "text-foreground"}`}>
                {secondsLeft}s
              </span>
            </div>
            {isExpiringSoon && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Code bientôt expiré
              </p>
            )}
          </div>

          {/* OTP Input */}
          <div className="flex flex-col items-center gap-4 w-full">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={verifyMutation.isPending}
              autoFocus
              data-testid="input-admin-panel-otp"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>

            <Button
              className="w-full font-bold h-11"
              disabled={code.length < 6 || verifyMutation.isPending}
              onClick={() => verifyMutation.mutate(code)}
              data-testid="button-admin-panel-verify"
            >
              {verifyMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vérification…</>
              ) : (
                "Accéder au panneau admin"
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4 px-2">
          🔒 L'authentification à deux facteurs est obligatoire pour le panneau admin.
        </p>
      </div>
    </div>
  );
}
