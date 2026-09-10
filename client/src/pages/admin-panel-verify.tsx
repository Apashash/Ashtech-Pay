import { getAdminPath } from "@/lib/adminPath";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Smartphone, Loader2, RefreshCw, ArrowLeft } from "lucide-react";

export default function AdminPanelVerifyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"totp" | "pin">("totp");
  const [secondsLeft, setSecondsLeft] = useState(30);

  // Restore the page the admin was on before TOTP expiry; fall back to admin root
  const returnPath = sessionStorage.getItem("admin_verify_return") || getAdminPath();
  const ADMIN_URL = returnPath.startsWith("/admin-panel-verify") ? getAdminPath() : returnPath;

  const { data: otpStatus, isLoading: statusLoading } = useQuery<{
    verified: boolean;
    needsPanelVerify?: boolean;
    needsPanelPin?: boolean;
    totpEnabled?: boolean;
    enforcementEnabled?: boolean;
  }>({
    queryKey: ["/api/admin/otp-status"],
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (statusLoading) return;
    if (!otpStatus) {
      setLocation("/login");
      return;
    }
    if (!otpStatus.totpEnabled) {
      toast({
        title: "Google Authenticator non configuré",
        description: "Vous devez configurer Google Authenticator pour accéder au panneau admin.",
        variant: "destructive",
        duration: 8000,
      });
      setLocation("/dashboard");
      return;
    }
    if (step === "totp" && otpStatus.verified && !otpStatus.needsPanelVerify) {
      if (otpStatus.needsPanelPin) {
        setStep("pin");
      } else {
        setLocation(ADMIN_URL);
      }
    }
  }, [otpStatus, statusLoading, step, ADMIN_URL]);

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
      queryClient.setQueryData(["/api/admin/otp-status"], (old: any) => ({
        ...(old || {}),
        needsPanelVerify: undefined,
        needsPanelPin: undefined,
        verified: true,
      }));
      setCode("");
      setLocation(ADMIN_URL);
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

  const pinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiRequest("POST", "/api/auth/admin-panel-pin-verify", { pin });
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.message || "Erreur"), json);
      return json;
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/admin/otp-status"], (old: any) => ({
        ...(old || {}),
        needsPanelVerify: undefined,
        needsPanelPin: undefined,
        verified: true,
      }));
      sessionStorage.removeItem("admin_verify_return");
      setLocation(ADMIN_URL);
    },
    onError: (err: any) => {
      setCode("");
      if (err.totpRequired) {
        setStep("totp");
      }
      toast({
        title: err.totpRequired ? "Vérification Google Authenticator requise" : "Code PIN incorrect",
        description: err.message || "Vérifiez le code PIN administrateur.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const expectedLength = step === "totp" ? 6 : 4;
    if (code.length === expectedLength && !verifyMutation.isPending && !pinMutation.isPending) {
      if (step === "totp") {
        verifyMutation.mutate(code);
      } else {
        pinMutation.mutate(code);
      }
    }
  }, [code, step]);

  const isExpiringSoon = secondsLeft <= 5;
  const progress = ((30 - secondsLeft) / 30) * 100;
  const isTotpStep = step === "totp";
  const codeLength = isTotpStep ? 6 : 4;
  const isPending = verifyMutation.isPending || pinMutation.isPending;

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </button>

        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>

          <div className="text-center">
              <h1 className="text-xl font-bold text-foreground mb-1">
                {isTotpStep ? "Vérification Google Authenticator" : "Code PIN administrateur"}
              </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
                {isTotpStep ? (
                  <>Entrez le code à 6 chiffres affiché dans{" "}
                    <span className="font-semibold text-foreground">Google Authenticator</span>{" "}
                    pour continuer.</>
                ) : (
                  <>Entrez votre code PIN administrateur à 4 chiffres pour ouvrir le panneau admin.</>
                )}
            </p>
          </div>

            {isTotpStep && (
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
            )}

          <div className="flex flex-col items-center gap-4 w-full">
            <InputOTP
              maxLength={codeLength}
              value={code}
              onChange={setCode}
              disabled={isPending}
              autoFocus
              data-testid={isTotpStep ? "input-admin-panel-otp" : "input-admin-panel-pin"}
            >
              <InputOTPGroup>
                {Array.from({ length: codeLength }, (_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>

            <Button
              className="w-full font-bold h-11"
              disabled={code.length < codeLength || isPending}
              onClick={() => isTotpStep ? verifyMutation.mutate(code) : pinMutation.mutate(code)}
              data-testid={isTotpStep ? "button-admin-panel-verify" : "button-admin-panel-pin"}
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vérification…</>
              ) : (
                isTotpStep ? "Valider Google Authenticator" : "Accéder au panneau admin"
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
