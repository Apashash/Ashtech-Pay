import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellRing, Check, Loader2, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPushSupport,
  hasPushSubscription,
  subscribeToPush,
} from "@/lib/push-notifications";

type PromptState = "permission" | "ios-install" | "denied" | "error";

export function PushNotificationPrompt() {
  const { data: user } = useQuery<{ id: string } | null>({
    queryKey: ["/api/user"],
    retry: false,
  });
  const attemptedForUser = useRef<string | null>(null);
  const [state, setState] = useState<PromptState | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!user || attemptedForUser.current === user.id) return;
    attemptedForUser.current = user.id;

    const support = getPushSupport();
    if (!support.supported) {
      if (support.reason === "ios-home-screen") {
        setState("ios-install");
      }
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    if (Notification.permission === "default") {
      try {
        if (sessionStorage.getItem("ashtech_push_prompt_dismissed") === "1") return;
      } catch {
        // sessionStorage can be unavailable in private browsing modes.
      }
      setState("permission");
      return;
    }

    // Permission is already granted: keep push enabled without asking again.
    hasPushSubscription()
      .then((enabled) => {
        if (enabled) return;
        return subscribeToPush();
      })
      .catch((error: Error) => {
        console.warn("[Push] Automatic activation failed:", error.message);
      });
  }, [user]);

  async function enablePush() {
    if (busy) return;
    setBusy(true);
    setErrorMessage("");
    try {
      await subscribeToPush();
      setState(null);
      try {
        sessionStorage.removeItem("ashtech_push_prompt_dismissed");
      } catch {}
    } catch (error: any) {
      setErrorMessage(error?.message || "Impossible d'activer les notifications.");
      const support = getPushSupport();
      setState(support.reason === "ios-home-screen" ? "ios-install" : "error");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setState(null);
    if (state === "permission" || state === "ios-install") {
      try {
        sessionStorage.setItem("ashtech_push_prompt_dismissed", "1");
      } catch {}
    }
  }

  if (!state) return null;

  const isPermissionPrompt = state === "permission";
  const isIosInstallPrompt = state === "ios-install";
  const isDenied = state === "denied";

  return (
    <div
      className="fixed inset-x-3 bottom-4 z-[70] mx-auto max-w-lg rounded-2xl border border-primary/20 bg-background/95 p-4 shadow-2xl backdrop-blur-md sm:inset-x-auto sm:bottom-6 sm:w-[min(92vw, thirtyrem)]"
      role="dialog"
      aria-live="polite"
      aria-label="Notifications AshTech Pay"
      data-testid="push-notification-prompt"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {isIosInstallPrompt ? <Smartphone className="h-5 w-5" /> : isDenied ? <Bell className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {isPermissionPrompt
                ? "Activez vos notifications AshTech Pay"
                : isIosInstallPrompt
                  ? "Installez AshTech Pay sur votre iPhone"
                  : isDenied
                    ? "Notifications bloquées"
                    : "Activation des notifications impossible"}
            </h2>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fermer"
              data-testid="button-dismiss-push-prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isPermissionPrompt
              ? "Recevez immédiatement les confirmations de dépôts, retraits et paiements, même lorsque l'application n'est pas ouverte."
              : isIosInstallPrompt
                ? "Sur iPhone, les notifications fonctionnent après l'ajout d'AshTech Pay à l'écran d'accueil. Ouvrez ensuite l'application depuis son icône."
                : isDenied
                  ? "Les notifications sont bloquées par votre navigateur. Autorisez-les depuis les réglages du site pour recevoir vos alertes."
                  : errorMessage}
          </p>
          {(isPermissionPrompt || isIosInstallPrompt) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={enablePush}
                disabled={busy}
                data-testid="button-enable-push"
              >
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : isIosInstallPrompt ? <Smartphone className="mr-1.5 h-4 w-4" /> : <Bell className="mr-1.5 h-4 w-4" />}
                {isIosInstallPrompt ? "Voir le guide d'installation" : "Activer maintenant"}
              </Button>
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Plus tard
              </button>
            </div>
          )}
          {isDenied && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Check className="h-3.5 w-3.5" />
              Vous pouvez modifier ce choix dans les réglages du navigateur.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}