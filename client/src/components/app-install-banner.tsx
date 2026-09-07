import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  MoreVertical,
  Plus,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { getAdminPath } from "@/lib/adminPath";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const HIDE_INSTALL_BANNER_KEY = "hideAppInstallBannerUntil";
const SNOOZE_INSTALL_BANNER_MS = 2 * 60 * 60 * 1000;
const DISMISS_INSTALL_BANNER_MS = 14 * 24 * 60 * 60 * 1000;

type InstallDevice = "android" | "ios" | "other" | "unknown";
type GuideMode = "ios" | "android" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __ashtechDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function isStandaloneDisplay(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function getInstallDevice(): InstallDevice {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isAppleTablet = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/.test(userAgent) || isAppleTablet) return "ios";
  if (/android/.test(userAgent)) return "android";
  return "other";
}

function getInstallBannerSuppressedUntil(): number {
  try {
    const stored = window.localStorage.getItem(HIDE_INSTALL_BANNER_KEY);
    if (!stored || stored === "true") {
      if (stored === "true") window.localStorage.removeItem(HIDE_INSTALL_BANNER_KEY);
      return 0;
    }

    const until = Number(stored);
    if (!Number.isFinite(until) || until <= Date.now()) {
      window.localStorage.removeItem(HIDE_INSTALL_BANNER_KEY);
      return 0;
    }
    return until;
  } catch {
    return 0;
  }
}

function IosStepIllustration({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="relative mx-auto h-[248px] w-[156px] overflow-hidden rounded-[26px] border-[5px] border-slate-900 bg-slate-100 shadow-[0_18px_45px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-900">
      <div className="absolute left-1/2 top-0 z-10 h-5 w-16 -translate-x-1/2 rounded-b-xl bg-slate-900" />
      <div className="flex h-8 items-center justify-between px-3 pt-1 text-[8px] font-bold text-slate-800 dark:text-slate-200">
        <span>9:41</span>
        <span className="tracking-tight">● ▪︎ ▪︎</span>
      </div>
      <div className="px-3 pt-4">
        <div className="mb-3 flex items-center justify-between text-[8px] font-semibold text-slate-500">
          <span>Safari</span>
          <span className="rounded-full bg-white px-2 py-1 shadow-sm">aA</span>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800">
          <div className="mb-2 flex items-center gap-2">
            <img src="/ashtechpay-icon-192.png" alt="" className="h-7 w-7 rounded-lg" />
            <div>
              <div className="text-[9px] font-bold text-slate-800 dark:text-slate-100">AshTech Pay</div>
              <div className="text-[7px] text-slate-400">ashtechpay.top</div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700" />
          <div className="mt-2 h-2 w-3/4 rounded-full bg-slate-100 dark:bg-slate-700" />
          <div className="mt-4 h-8 rounded-lg bg-amber-400/80" />
        </div>
      </div>
      {step === 1 && (
        <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-amber-400 px-2 py-1 text-[8px] font-bold text-slate-950 shadow-lg ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-100">
          <Share2 className="h-3 w-3" />
          Partager
        </div>
      )}
      {step === 2 && (
        <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border-2 border-amber-400 bg-white px-2 py-1.5 text-[8px] font-bold text-slate-900 shadow-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-100 dark:bg-slate-800 dark:text-white dark:ring-offset-slate-900">
          <Share2 className="h-3 w-3" />
          Sur l’écran d’accueil
        </div>
      )}
      {step === 3 && (
        <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-amber-400 px-2 py-1.5 text-[8px] font-bold text-slate-950 shadow-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-100">
          <Plus className="h-3 w-3" />
          Ajouter
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-amber-400/25 to-transparent" />
    </div>
  );
}

function AndroidGuideIllustration() {
  return (
    <div className="mx-auto flex max-w-xs items-center gap-3 rounded-2xl border border-border bg-muted/50 p-4">
      <div className="flex h-16 w-12 shrink-0 flex-col items-center rounded-xl border-2 border-foreground/70 bg-background pt-2">
        <div className="mb-2 h-1 w-5 rounded-full bg-muted-foreground/40" />
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
          <Download className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="text-left text-xs text-muted-foreground">
        <div className="mb-1 flex items-center gap-1 font-semibold text-foreground">
          <MoreVertical className="h-4 w-4 text-primary" />
          Menu du navigateur
        </div>
        <p>Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».</p>
      </div>
    </div>
  );
}

function AppInstallBanner() {
  const [location] = useLocation();
  const adminPath = getAdminPath();
  const [device, setDevice] = useState<InstallDevice>("unknown");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [visible, setVisible] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [guideMode, setGuideMode] = useState<GuideMode>(null);
  const [iosStep, setIosStep] = useState<1 | 2 | 3>(1);
  const cooldownTimerRef = useRef<number | null>(null);

  const isAdminRoute =
    location === adminPath ||
    location.startsWith(`${adminPath}/`);
  const isEligibleRoute =
    !isAdminRoute &&
    (location === "/" || location === "/dashboard");
  const isIos = device === "ios";
  const isAndroid = device === "android";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateStandalone = () => setIsStandalone(isStandaloneDisplay());
    const adoptStoredPrompt = () => {
      const storedPrompt = window.__ashtechDeferredInstallPrompt;
      if (storedPrompt) setDeferredPrompt(storedPrompt);
    };
    const promptHandler = (event: Event) => {
      event.preventDefault();
      const installPrompt = event as BeforeInstallPromptEvent;
      window.__ashtechDeferredInstallPrompt = installPrompt;
      setDeferredPrompt(installPrompt);
    };
    const installedHandler = () => {
      setIsStandalone(true);
      setVisible(false);
      setDeferredPrompt(null);
      window.__ashtechDeferredInstallPrompt = null;
    };
    const openInstallGuideHandler = () => {
      setVisible(false);
      setIosStep(1);
      setGuideMode(getInstallDevice() === "ios" ? "ios" : "android");
    };
    const sidebarInteractionHandler = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const dashboardLink = target?.closest<HTMLAnchorElement>('a[href^="/dashboard"]');
      const sidebarToggle = target?.closest('[data-sidebar="trigger"], [data-sidebar="rail"]');
      if (dashboardLink || sidebarToggle) setVisible(false);
    };

    setDevice(getInstallDevice());
    updateStandalone();
    setVisible(getInstallBannerSuppressedUntil() <= Date.now());

    window.addEventListener("beforeinstallprompt", promptHandler);
    window.addEventListener("ashtechbeforeinstallprompt", adoptStoredPrompt);
    window.addEventListener("appinstalled", installedHandler);
    window.addEventListener("ashtech-open-install-guide", openInstallGuideHandler);
    document.addEventListener("click", sidebarInteractionHandler, true);
    adoptStoredPrompt();
    const displayMode = window.matchMedia("(display-mode: standalone)");
    displayMode.addEventListener?.("change", updateStandalone);

    return () => {
      window.removeEventListener("beforeinstallprompt", promptHandler);
      window.removeEventListener("ashtechbeforeinstallprompt", adoptStoredPrompt);
      window.removeEventListener("appinstalled", installedHandler);
      window.removeEventListener("ashtech-open-install-guide", openInstallGuideHandler);
      document.removeEventListener("click", sidebarInteractionHandler, true);
      displayMode.removeEventListener?.("change", updateStandalone);
      if (cooldownTimerRef.current !== null) {
        window.clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const deviceCanInstall = useMemo(
    () => isIos || isAndroid || (device === "other" && Boolean(deferredPrompt)),
    [deferredPrompt, device, isAndroid, isIos],
  );

  useEffect(() => {
    if (isStandalone || !deviceCanInstall || !isEligibleRoute) {
      setVisible(false);
      return;
    }
    setVisible(getInstallBannerSuppressedUntil() <= Date.now());
  }, [deviceCanInstall, isEligibleRoute, isStandalone]);

  const shouldShowBanner = visible && !isStandalone && deviceCanInstall && isEligibleRoute;

  const installLabel = "Installer";

  const handleInstall = async () => {
    if (isIos) {
      // Keep the guide open while removing the fixed banner underneath it.
      // The guide is rendered independently from the banner so its "Suivant"
      // button remains available after this state change.
      setVisible(false);
      setIosStep(1);
      setGuideMode("ios");
      return;
    }

    const installPrompt = deferredPrompt ?? window.__ashtechDeferredInstallPrompt;
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setDeferredPrompt(null);
      window.__ashtechDeferredInstallPrompt = null;
      if (choice.outcome === "accepted") setVisible(false);
      return;
    }

    setGuideMode("android");
  };

  const hideBannerFor = (durationMs: number) => {
    const suppressedUntil = Date.now() + durationMs;
    try {
      localStorage.setItem(HIDE_INSTALL_BANNER_KEY, String(suppressedUntil));
    } catch {
      // If storage is unavailable, closing is still allowed for this visit.
    }
    setConfirmCloseOpen(false);
    setVisible(false);

    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
    }
    cooldownTimerRef.current = window.setTimeout(() => {
      cooldownTimerRef.current = null;
      const currentPath = window.location.pathname;
      if (
        !isStandaloneDisplay() &&
        (currentPath === "/" || currentPath === "/dashboard")
      ) {
        setVisible(true);
      }
    }, durationMs);
  };

  return (
    <>
      {shouldShowBanner && (
        <div className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 2xl:hidden">
          <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-primary/20 bg-background/95 px-3 py-2.5 shadow-[0_-12px_36px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:px-4 dark:shadow-[0_-12px_36px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom-4 duration-500">
            <img
              src="/ashtechpay-icon-192.png"
              alt="AshTech Pay"
              className="h-10 w-10 shrink-0 rounded-xl shadow-sm ring-1 ring-black/5"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold tracking-tight text-foreground">📲 Téléchargez notre application</p>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                {isIos
                  ? "Une expérience plus rapide sur votre iPhone"
                  : isAndroid && deferredPrompt
                    ? "Installation native Android disponible"
                    : "Retrouvez AshTech Pay depuis votre écran d’accueil"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleInstall}
              className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] active:scale-95 sm:px-4 sm:text-sm"
              data-testid="button-install-app"
            >
              {isIos ? "Installer" : installLabel}
            </button>
            <button
              type="button"
              onClick={() => setConfirmCloseOpen(true)}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fermer l’invitation à installer l’application"
              data-testid="button-close-install-banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-border p-6">
          <DialogHeader className="pr-5">
            <DialogTitle>Ne plus afficher cette notification&nbsp;?</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              Souhaitez-vous ne plus voir cette invitation à installer l’application&nbsp;?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => hideBannerFor(SNOOZE_INSTALL_BANNER_MS)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Non, continuer à afficher
            </button>
            <button
              type="button"
              onClick={() => hideBannerFor(DISMISS_INSTALL_BANNER_MS)}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              Oui, ne plus afficher
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={guideMode === "ios"} onOpenChange={(open) => !open && setGuideMode(null)}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl border-border p-0">
          <div className="bg-gradient-to-br from-primary/15 via-background to-background px-5 pb-4 pt-6 sm:px-7">
            <DialogHeader className="pr-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Smartphone className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl">Comment installer l’application sur votre iPhone&nbsp;?</DialogTitle>
              <DialogDescription className="pt-2">
                Suivez ces trois étapes simples dans Safari.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 pb-5 pt-4 sm:px-7">
            <div className="mb-4 flex justify-center gap-2" aria-label={`Étape ${iosStep} sur 3`}>
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`h-1.5 rounded-full transition-all duration-300 ${step <= iosStep ? "w-8 bg-primary" : "w-2 bg-muted"}`}
                />
              ))}
            </div>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">
                {iosStep}
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {iosStep === 1 && "Ouvrez le menu Partager"}
                  {iosStep === 2 && "Ajoutez AshTech Pay"}
                  {iosStep === 3 && "Confirmez l’installation"}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {iosStep === 1 && "Appuyez sur le bouton Partager ⎋ en bas de votre écran."}
                  {iosStep === 2 && "Faites défiler le menu puis appuyez sur « Sur l’écran d’accueil »."}
                  {iosStep === 3 && "Appuyez sur « Ajouter » pour installer l’application sur votre écran d’accueil."}
                </p>
              </div>
            </div>
            <IosStepIllustration step={iosStep} />
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIosStep((current) => (current === 1 ? 1 : (current - 1) as 1 | 2 | 3))}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted ${iosStep === 1 ? "invisible" : ""}`}
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>
              {iosStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setIosStep((current) => (current + 1) as 1 | 2 | 3)}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
                >
                  Suivant
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setGuideMode(null)}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
                >
                  <Check className="h-4 w-4" />
                  J’ai compris
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={guideMode === "android"} onOpenChange={(open) => !open && setGuideMode(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border p-6">
          <DialogHeader className="pr-5">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl">Installer AshTech Pay sur Android</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              Ouvrez le menu ⋮ de votre navigateur, puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».
            </DialogDescription>
          </DialogHeader>
          <AndroidGuideIllustration />
          <button
            type="button"
            onClick={() => setGuideMode(null)}
            className="mt-1 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            J’ai compris
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AppInstallBanner;