import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, setAuthToken, setAdminOtpToken } from "@/lib/queryClient";
import { Smartphone, Loader2, AlertTriangle, RefreshCw } from "lucide-react";

export default function AdminLoginOtpPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const adminLoginToken =
    typeof window !== "undefined"
      ? sessionStorage.getItem("adminLoginToken")
      : null;

  useEffect(() => {
    if (!adminLoginToken) {
      setLocation("/login");
    }
  }, [adminLoginToken]);

  // Calcule les secondes restantes du code TOTP (période 30s)
  useEffect(() => {
    const update = () => {
      const s = 30 - (Math.floor(Date.now() / 1000) % 30);
      setSecondsLeft(s);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
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
      if (data.adminOtpToken) setAdminOtpToken(data.adminOtpToken);
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
        description: error.message || "Vérifiez le code dans Google Authenticator.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6 || verifyMutation.isPending) return;
    verifyMutation.mutate();
  };

  useEffect(() => {
    if (code.length === 6 && !verifyMutation.isPending) {
      verifyMutation.mutate();
    }
  }, [code]);

  if (!adminLoginToken) return null;

  const progress = ((30 - secondsLeft) / 30) * 100;
  const isExpiringSoon = secondsLeft <= 5;

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.png" alt="AshTech Pay" className="h-24 w-auto" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground mb-1">Google Authenticator</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ouvrez votre application{" "}
              <span className="font-semibold text-foreground">Google Authenticator</span>{" "}
              et entrez le code à 6 chiffres affiché pour <span className="font-semibold text-foreground">AshTech Pay Admin</span>.
            </p>
          </div>

          {/* Countdown ring */}
          <div className="flex flex-col items-center gap-1">
            <div className="relative w-12 h-12">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/30" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
                  strokeDasharray="100"
                  strokeDashoffset={progress}
                  strokeLinecap="round"
                  className={isExpiringSoon ? "text-red-500" : "text-primary"}
                  stroke="currentColor"
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

          {/* Cancel */}
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

        <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed px-2">
          🔒 L'authentification à deux facteurs est obligatoire pour les comptes administrateurs.
        </p>
      </div>
    </div>
  );
}
