import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, setAuthToken } from "@/lib/queryClient";
import { ShieldCheck, Loader2, RotateCcw, AlertTriangle } from "lucide-react";

const RESEND_COOLDOWN = 60; // seconds

export default function AdminLoginOtpPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Retrieve the pending token stored by the login page
  const adminLoginToken =
    typeof window !== "undefined"
      ? sessionStorage.getItem("adminLoginToken")
      : null;

  // Redirect back to login if there's no pending token
  useEffect(() => {
    if (!adminLoginToken) {
      setLocation("/login");
    }
  }, [adminLoginToken]);

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    intervalRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/admin-login-otp", {
        adminLoginToken,
        code,
      });
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.message || "Erreur"), json);
      return json;
    },
    onSuccess: (data) => {
      sessionStorage.removeItem("adminLoginToken");
      if (data.token) setAuthToken(data.token);
      if (data.user) queryClient.setQueryData(["/api/user"], data.user);
      toast({
        title: "Connexion réussie",
        description: "Bienvenue dans le panneau d'administration.",
        duration: 2500,
        className: "bg-green-600 text-white border-green-700",
      });
      setLocation("/admin");
    },
    onError: (error: any) => {
      setCode("");
      if (error.ipNotWhitelisted) {
        sessionStorage.removeItem("adminLoginToken");
        window.location.href = "/login?kicked=ip";
        return;
      }
      if (error.expired) {
        sessionStorage.removeItem("adminLoginToken");
        toast({
          title: "Session expirée",
          description: error.message || "Veuillez vous reconnecter.",
          variant: "destructive",
        });
        setLocation("/login");
        return;
      }
      if (error.attemptsLeft !== undefined) setAttemptsLeft(error.attemptsLeft);
      toast({
        title: "Code incorrect",
        description: error.message || "Le code saisi est incorrect.",
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/admin-login-otp/resend", {
        adminLoginToken,
      });
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.message || "Erreur"), json);
      return json;
    },
    onSuccess: () => {
      setCode("");
      setAttemptsLeft(null);
      setResendCooldown(RESEND_COOLDOWN);
      // Restart cooldown
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setResendCooldown((s) => {
          if (s <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      toast({
        title: "Code renvoyé",
        description: "Un nouveau code a été envoyé par email et Telegram.",
        duration: 3000,
        className: "bg-blue-600 text-white border-blue-700",
      });
    },
    onError: (error: any) => {
      if (error.expired) {
        sessionStorage.removeItem("adminLoginToken");
        setLocation("/login");
        return;
      }
      toast({
        title: "Erreur",
        description: error.message || "Impossible de renvoyer le code.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6 || verifyMutation.isPending) return;
    verifyMutation.mutate();
  };

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (code.length === 6 && !verifyMutation.isPending) {
      verifyMutation.mutate();
    }
  }, [code]);

  if (!adminLoginToken) return null;

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.png" alt="AshTech Pay" className="h-24 w-auto" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground mb-1">Vérification requise</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Un code à 6 chiffres a été envoyé à{" "}
              <span className="font-semibold text-foreground">ashtechsarl@gmail.com</span>{" "}
              et sur{" "}
              <span className="font-semibold text-foreground">Telegram</span>.
            </p>
          </div>

          {/* OTP Input */}
          <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 w-full">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={verifyMutation.isPending}
              data-testid="input-admin-otp"
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

            {/* Attempts warning */}
            {attemptsLeft !== null && attemptsLeft <= 3 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 w-full">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {attemptsLeft} tentative(s) restante(s) avant expiration de la session.
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full font-bold h-11"
              disabled={code.length < 6 || verifyMutation.isPending}
              data-testid="button-verify-otp"
            >
              {verifyMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vérification…</>
              ) : (
                "Confirmer le code"
              )}
            </Button>
          </form>

          {/* Resend */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-muted-foreground">Vous n'avez pas reçu le code ?</p>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={resendCooldown > 0 || resendMutation.isPending}
              onClick={() => resendMutation.mutate()}
              data-testid="button-resend-otp"
            >
              {resendMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Envoi…</>
              ) : resendCooldown > 0 ? (
                <><RotateCcw className="w-3.5 h-3.5" />Renvoyer dans {resendCooldown}s</>
              ) : (
                <><RotateCcw className="w-3.5 h-3.5" />Renvoyer le code</>
              )}
            </Button>
          </div>

          {/* Cancel / back to login */}
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            onClick={() => {
              sessionStorage.removeItem("adminLoginToken");
              setLocation("/login");
            }}
            data-testid="button-cancel-otp"
          >
            Annuler et retourner à la connexion
          </button>
        </div>

        {/* Security note */}
        <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed px-2">
          🔒 Cette étape est obligatoire pour les comptes administrateurs et ne peut pas être contournée.
        </p>
      </div>
    </div>
  );
}
