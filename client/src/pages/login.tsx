import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { loginSchema } from "@shared/schema";
import { apiRequest, queryClient, setAuthToken } from "@/lib/queryClient";
import { Mail, Lock, Loader2, Eye, EyeOff, Home, Clock, ShieldAlert, WifiOff, MonitorSmartphone } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { TurnstileWidget } from "@/components/ui/turnstile";
import { z } from "zod";

type LoginFormData = z.infer<typeof loginSchema>;

const RATE_LIMIT_KEY = "ashtech_rate_limit_until";

function saveRateLimit(retryAfter: number) {
  try { localStorage.setItem(RATE_LIMIT_KEY, String(retryAfter)); } catch {}
}
function loadRateLimit(): number | null {
  try {
    const v = localStorage.getItem(RATE_LIMIT_KEY);
    if (!v) return null;
    const ts = parseInt(v, 10);
    if (ts > Date.now()) return ts;
    localStorage.removeItem(RATE_LIMIT_KEY);
  } catch {}
  return null;
}
function clearRateLimit() {
  try { localStorage.removeItem(RATE_LIMIT_KEY); } catch {}
}

function useCountdown(retryAfter: number | null) {
  const [remaining, setRemaining] = useState<number>(() => {
    if (!retryAfter) return 0;
    return Math.max(0, Math.ceil((retryAfter - Date.now()) / 1000));
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!retryAfter) { setRemaining(0); return; }
    const tick = () => {
      const diff = Math.max(0, Math.ceil((retryAfter - Date.now()) / 1000));
      setRemaining(diff);
      if (diff <= 0 && intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [retryAfter]);

  return remaining;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [kicked, setKicked] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("kicked") === "1";
    }
    return false;
  });

  const [blockedUntil, setBlockedUntil] = useState<number | null>(() => loadRateLimit());
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);
  const [vpnDetected, setVpnDetected] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("vpn") === "1";
    }
    return false;
  });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [turnstileError, setTurnstileError] = useState(false);

  const countdown = useCountdown(blockedUntil);
  const isBlocked = blockedUntil !== null && countdown > 0;

  const { data: turnstileConfig } = useQuery<{ siteKey: string }>({
    queryKey: ["/api/public/turnstile-key"],
    queryFn: async () => {
      const res = await fetch("/api/public/turnstile-key");
      return res.json();
    },
    staleTime: Infinity,
  });

  const siteKey = turnstileConfig?.siteKey || "";

  useEffect(() => {
    fetch("/api/auth/ip-status")
      .then(r => r.json())
      .then(data => {
        if (data.blocked && data.retryAfter) {
          saveRateLimit(data.retryAfter);
          setLocation(`/blocked?until=${data.retryAfter}`);
          return;
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (countdown === 0 && blockedUntil !== null) {
      clearRateLimit();
      setBlockedUntil(null);
      setAttemptsLeft(null);
    }
  }, [countdown, blockedUntil]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const handleTurnstileError = useCallback(() => {
    setTurnstileError(true);
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const res = await apiRequest("POST", "/api/auth/login", {
        ...data,
        turnstileToken: turnstileToken || undefined,
      });
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.message || "Erreur"), json);
      return json;
    },
    onSuccess: (data) => {
      if (data.token) setAuthToken(data.token);
      if (data.user) queryClient.setQueryData(["/api/user"], data.user);
      toast({ title: t.login.toastSuccess, description: `${t.login.toastSuccessDescPre}${data.user.fullName}!`, duration: 2000, className: "bg-blue-600 text-white border-blue-700" });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      setTurnstileToken(null);
      setTurnstileKey(k => k + 1);
      if (error.vpnDetected) { setVpnDetected(true); return; }
      if (error.blocked && error.retryAfter) {
        saveRateLimit(error.retryAfter);
        setLocation(`/blocked?until=${error.retryAfter}`);
        return;
      } else if (error.attemptsLeft !== undefined) {
        setAttemptsLeft(error.attemptsLeft);
      }
      toast({ title: t.login.toastError, description: error.message || t.login.toastErrorDesc, variant: "destructive" });
    },
  });

  const canSubmit = !siteKey || !!turnstileToken || turnstileError;

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="AshTech Pay" className="h-28 w-auto" />
            </div>
          </Link>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">{t.login.title}</h1>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          {kicked && !checking && !isBlocked && !vpnDetected && (
            <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-3 mb-5">
              <MonitorSmartphone className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-400">Compte connecté sur un autre appareil</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Votre session a été fermée car votre compte vient d'être connecté sur un autre navigateur ou appareil.
                </p>
              </div>
            </div>
          )}

          {checking ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : vpnDetected ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-orange-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-base mb-2">Connexion VPN détectée</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Vous utilisez un VPN ou un proxy. Veuillez le désactiver pour accéder à votre compte.
                </p>
              </div>
              <div className="w-full bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                  Pour votre sécurité et la conformité réglementaire, les connexions via VPN ou proxy ne sont pas autorisées.
                </p>
              </div>
              <Button variant="outline" className="w-full mt-2" onClick={() => setVpnDetected(false)}>
                Réessayer
              </Button>
            </div>
          ) : isBlocked ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-base mb-1">Accès temporairement bloqué</p>
                <p className="text-muted-foreground text-sm mb-4">Trop de tentatives incorrectes. Réessayez dans :</p>
                <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-3">
                  <Clock className="w-5 h-5 text-red-400" />
                  <span className="text-2xl font-bold text-red-400 tabular-nums" data-testid="text-countdown">
                    {formatCountdown(countdown)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Pour votre sécurité, l'accès est bloqué après {4} tentatives incorrectes.
              </p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(loginMutation.mutate)} className="space-y-5">
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {attemptsLeft} tentative(s) restante(s) avant blocage temporaire.
                    </p>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-sm">{t.login.emailLabel}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder={t.login.emailPlaceholder}
                            className="pl-10"
                            data-testid="input-identifier"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-sm">{t.login.passwordLabel}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                            data-testid="input-password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Link href="/forgot-password">
                    <span className="text-sm text-primary hover:underline cursor-pointer font-medium" data-testid="link-forgot-password">
                      {t.login.forgotPassword}
                    </span>
                  </Link>
                </div>

                {siteKey && (
                  <div className="py-1">
                    <TurnstileWidget
                      key={turnstileKey}
                      siteKey={siteKey}
                      onSuccess={handleTurnstileSuccess}
                      onExpire={handleTurnstileExpire}
                      onError={handleTurnstileError}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full font-bold text-base h-11"
                  disabled={loginMutation.isPending || !canSubmit}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.login.submitting}</>
                  ) : t.login.submit}
                </Button>
              </form>
            </Form>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between px-1">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-back-home">
              <Home className="w-3.5 h-3.5" />
              {t.login.home}
            </Button>
          </Link>
          <p className="text-muted-foreground text-sm">
            {t.login.noAccount}{" "}
            <Link href="/register">
              <span className="text-primary hover:underline cursor-pointer font-semibold" data-testid="link-register">
                {t.login.createAccount}
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
