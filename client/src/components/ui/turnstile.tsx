import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      execute: (widgetId: string, options?: { callback?: (token: string) => void }) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
  language?: string;
  execution?: "render" | "execute";
  appearance?: "always" | "execute" | "interaction-only";
}

interface TurnstileWidgetProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: "light" | "dark" | "auto";
}

const FALLBACK_TIMEOUT_MS = 8000;

let scriptLoaded = false;
let scriptLoading = false;
const callbacks: Array<() => void> = [];

function loadTurnstileScript(onLoad: () => void) {
  if (scriptLoaded) {
    onLoad();
    return;
  }
  callbacks.push(onLoad);
  if (scriptLoading) return;
  scriptLoading = true;
  window.onTurnstileLoad = () => {
    scriptLoaded = true;
    callbacks.forEach(cb => cb());
    callbacks.length = 0;
  };
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
  script.async = true;
  script.defer = true;
  // If the script fails to load (network error, blocked, etc.), trigger fallback
  script.onerror = () => {
    scriptLoading = false;
    callbacks.forEach(cb => cb());
    callbacks.length = 0;
  };
  document.head.appendChild(script);
}

export function TurnstileWidget({ siteKey, onSuccess, onExpire, onError, theme = "auto" }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const resolvedRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const handleSuccess = useCallback((token: string) => {
    resolvedRef.current = true;
    clearFallback();
    onSuccess(token);
  }, [onSuccess, clearFallback]);

  const handleError = useCallback(() => {
    resolvedRef.current = true;
    clearFallback();
    onError?.();
  }, [onError, clearFallback]);

  const handleExpire = useCallback(() => {
    resolvedRef.current = false;
    onExpire?.();
  }, [onExpire]);

  const renderWidget = useCallback(() => {
    if (!containerRef.current) {
      // Script loaded but container gone — treat as error to unblock form
      if (!resolvedRef.current) handleError();
      return;
    }
    if (!window.turnstile) {
      // Script failed to load
      if (!resolvedRef.current) handleError();
      return;
    }

    if (widgetIdRef.current) {
      try { window.turnstile.remove(widgetIdRef.current); } catch {}
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: handleSuccess,
      "expired-callback": handleExpire,
      "error-callback": handleError,
      theme,
      language: "fr",
      execution: "render",
    });

    // For invisible widgets, explicitly call execute()
    if (widgetIdRef.current && window.turnstile.execute) {
      try { window.turnstile.execute(widgetIdRef.current); } catch {}
    }

    // Fallback: if neither success nor error fires within timeout, unblock the form
    fallbackTimerRef.current = setTimeout(() => {
      if (!resolvedRef.current) {
        handleError();
      }
    }, FALLBACK_TIMEOUT_MS);
  }, [siteKey, handleSuccess, handleExpire, handleError, theme]);

  useEffect(() => {
    resolvedRef.current = false;
    loadTurnstileScript(renderWidget);
    return () => {
      clearFallback();
      if (widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget, clearFallback]);

  return <div ref={containerRef} className="flex justify-center" />;
}
