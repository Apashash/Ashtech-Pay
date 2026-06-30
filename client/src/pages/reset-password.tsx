import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { resetPasswordSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Lock, Loader2, ArrowLeft, Eye, EyeOff, CheckCircle, ShieldCheck } from "lucide-react";
import { z } from "zod";

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "Très faible", color: "#ef4444" };
  if (score === 2) return { score, label: "Faible", color: "#f97316" };
  if (score === 3) return { score, label: "Moyen", color: "#eab308" };
  if (score === 4) return { score, label: "Fort", color: "#22c55e" };
  return { score, label: "Très fort", color: "#10b981" };
}

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const token = searchParams.get("token") || "";

  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormData) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      return res.json();
    },
    onSuccess: () => {
      setResetSuccess(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de réinitialiser le mot de passe",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordFormData) => {
    resetPasswordMutation.mutate({ ...data, token });
  };

  const strength = getPasswordStrength(passwordValue);

  /* ── Token invalide ── */
  if (!token) {
    return (
      <PageShell>
        <div className="text-center space-y-6">
          <Logo />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Lien invalide</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Ce lien de réinitialisation est invalide ou a expiré.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <Link href="/forgot-password">
              <button
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                data-testid="button-request-new"
              >
                Demander un nouveau lien
              </button>
            </Link>
            <Link href="/login">
              <button className="w-full h-12 rounded-xl border border-border text-muted-foreground text-sm hover:text-foreground hover:border-foreground/30 transition-colors" data-testid="link-back-login">
                Retour à la connexion
              </button>
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ── Succès ── */
  if (resetSuccess) {
    return (
      <PageShell>
        <div className="text-center space-y-6">
          <Logo />
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Mot de passe mis à jour !</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Votre mot de passe a été changé avec succès. Vous pouvez maintenant vous connecter.
            </p>
          </div>
          <Link href="/login">
            <button
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors mt-2"
              data-testid="button-go-login"
            >
              Se connecter
            </button>
          </Link>
        </div>
      </PageShell>
    );
  }

  /* ── Formulaire principal ── */
  return (
    <PageShell>
      {/* Back */}
      <Link href="/login">
        <button
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
      </Link>

      {/* Header */}
      <div className="text-center space-y-4 mb-8">
        <Logo />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Nouveau mot de passe</h1>
          <p className="text-muted-foreground text-sm">
            Créez un mot de passe sécurisé pour votre compte
          </p>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Nouveau mot de passe</label>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full h-12 bg-card border border-border rounded-xl pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      data-testid="input-password"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setPasswordValue(e.target.value);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormControl>
                {/* Strength bar */}
                {passwordValue && (
                  <div className="space-y-1 pt-0.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="flex-1 h-1 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: i <= strength.score ? strength.color : "hsl(var(--border))",
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: strength.color }}>
                      {strength.label}
                    </p>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Confirm password */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Confirmer le mot de passe</label>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full h-12 bg-card border border-border rounded-xl pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      data-testid="input-confirm-password"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-confirm-password"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Security hint */}
          <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/15 rounded-xl p-3.5">
            <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Utilisez au moins 8 caractères avec des majuscules, chiffres et symboles pour un mot de passe fort.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={resetPasswordMutation.isPending}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            data-testid="button-submit"
          >
            {resetPasswordMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Réinitialisation…
              </>
            ) : (
              "Réinitialiser le mot de passe"
            )}
          </button>
        </form>
      </Form>
    </PageShell>
  );
}

/* ── Shared layout shell ── */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl shadow-black/40">
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Ashtech Pay — Paiements sécurisés
        </p>
      </div>
    </div>
  );
}

/* ── Logo sans fond sombre ── */
function Logo() {
  return (
    <Link href="/">
      <div className="flex items-center justify-center cursor-pointer">
        <img src="/logo.png" alt="Ashtech Pay" className="h-14 w-auto" />
      </div>
    </Link>
  );
}
