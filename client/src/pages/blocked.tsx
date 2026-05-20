import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ShieldAlert, Clock } from "lucide-react";

function useCountdown(retryAfter: number | null) {
  const [remaining, setRemaining] = useState(0);
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

  const countdown = useCountdown(until);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  useEffect(() => {
    if (countdown === 0 && until !== null) {
      setLocation("/login");
    }
  }, [countdown, until, setLocation]);

  return (
    <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#1E2329] border border-red-500/20 rounded-2xl p-8 flex flex-col items-center gap-6 shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-white">Accès temporairement bloqué</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Trop de tentatives de connexion incorrectes ont été détectées depuis votre adresse IP.
            </p>
          </div>

          <div className="w-full bg-red-500/5 border border-red-500/20 rounded-xl p-6 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
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
                <span className="text-xs text-gray-500 mt-1 uppercase tracking-wider">min</span>
              </div>
              <span className="text-4xl font-bold text-red-400/60 mb-3">:</span>
              <div className="flex flex-col items-center">
                <span
                  className="text-5xl font-bold text-red-400 tabular-nums leading-none"
                  data-testid="text-blocked-seconds"
                >
                  {String(seconds).padStart(2, "0")}
                </span>
                <span className="text-xs text-gray-500 mt-1 uppercase tracking-wider">sec</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center leading-relaxed">
            Pour votre sécurité, l'accès est bloqué après 4 tentatives incorrectes.
            Vous serez automatiquement redirigé vers la connexion à l'expiration du délai.
          </p>
        </div>
      </div>
    </div>
  );
}
