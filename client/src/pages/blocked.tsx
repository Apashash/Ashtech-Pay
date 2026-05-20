import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ShieldAlert, Clock, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const RATE_LIMIT_KEY = "ashtech_rate_limit_until";

function useCountdown(retryAfter: number | null) {
  const [remaining, setRemaining] = useState<number>(() => {
    if (!retryAfter) return 0;
    return Math.max(0, Math.ceil((retryAfter - Date.now()) / 1000));
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!retryAfter) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Math.ceil((retryAfter - Date.now()) / 1000));
      setRemaining(diff);
      if (diff <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [retryAfter]);

  return remaining;
}

export default function BlockedPage() {
  const [, setLocation] = useLocation();

  const until = (() => {
    if (typeof window === "undefined") return null;
    const v = new URLSearchParams(window.location.search).get("until");
    return v ? parseInt(v, 10) : null;
  })();

  // Persist until in localStorage so BlockGuard can intercept future navigations
  useEffect(() => {
    if (until && until > Date.now()) {
      try { localStorage.setItem(RATE_LIMIT_KEY, String(until)); } catch {}
    }
  }, [until]);

  const countdown = useCountdown(until);
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  useEffect(() => {
    if (countdown === 0 && until !== null) {
      try { localStorage.removeItem(RATE_LIMIT_KEY); } catch {}
      setLocation("/login");
    }
  }, [countdown, until, setLocation]);

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="AshTech Pay" className="h-28 w-auto" />
            </div>
          </Link>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-foreground">Accès temporairement bloqué</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Trop de tentatives de connexion incorrectes ont été détectées depuis votre adresse IP.
            </p>
          </div>

          <div className="w-full bg-red-500/5 border border-red-500/20 rounded-xl p-6 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" />
              <span>Réessayez dans</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="text-5xl font-bold text-red-400 tabular-nums leading-none"
                  data-testid="text-blocked-minutes"
                >
                  {String(minutes).padStart(2, "0")}
                </span>
                <span className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">min</span>
              </div>
              <span className="text-4xl font-bold text-red-400/60 mb-3">:</span>
              <div className="flex flex-col items-center">
                <span
                  className="text-5xl font-bold text-red-400 tabular-nums leading-none"
                  data-testid="text-blocked-seconds"
                >
                  {String(seconds).padStart(2, "0")}
                </span>
                <span className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">sec</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Pour votre sécurité, l'accès est bloqué après 4 tentatives incorrectes.
            Vous serez automatiquement redirigé vers la connexion à l'expiration du délai.
          </p>
        </div>

        <div className="mt-5 flex justify-center px-1">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-blocked-home">
              <Home className="w-3.5 h-3.5" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
