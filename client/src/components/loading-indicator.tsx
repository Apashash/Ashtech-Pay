import { useEffect, useState } from "react";

type LoadingIndicatorProps = {
  className?: string;
};

export function LoadingIndicator({ className = "" }: LoadingIndicatorProps) {
  return (
    <img
      src="/loading.gif"
      alt=""
      aria-hidden="true"
      className={`h-20 w-20 object-contain ${className}`}
    />
  );
}

function reloadApplication() {
  try {
    sessionStorage.clear();
  } catch {}

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("__ashtech_reload", String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export function LoadingScreen({ timeoutMs = 15000 }: { timeoutMs?: number }) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [timeoutMs]);

  if (timedOut) {
    return (
      <div
        className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6 text-center"
        role="alert"
      >
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Le chargement prend trop de temps
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            La connexion mobile n&apos;a pas terminé le chargement. Rechargez la page pour réessayer.
          </p>
        </div>
        <button
          type="button"
          onClick={reloadApplication}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Recharger la page
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center"
      role="status"
      aria-label="Chargement"
    >
      <LoadingIndicator />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}