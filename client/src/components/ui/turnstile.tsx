import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      execute: (widgetId: string) => void;
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
  appearance?: "always" | "execute" | "interaction-only";
  execution?: "render" | "execute";
}

interface TurnstileWidgetProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  onFallback?: () => void;
  theme?: "light" | "dark" | "auto";
}

const FALLBACK_TIMEOUT_MS = 10000;

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
  script.onerror = () => {
    scriptLoading = false;
    callbacks.forEach(cb => cb());
    callbacks.length = 0;
  };
  document.head.appendChild(script);
}

export function TurnstileWidget({ siteKey, onSuccess, onExpire, onError, onFallback, theme = "auto" }: TurnstileWidgetProps) {
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
    clearFallback();
    onError?.();
  }, [onError, clearFallback]);

  const handleExpire = useCallback(() => {
    resolvedRef.current = false;
    onExpire?.();
  }, [onExpire]);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) {
      if (!resolvedRef.current) onFallback?.();
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
      appearance: "always",
      execution: "render",
      size: "normal",
    });

    fallbackTimerRef.current = setTimeout(() => {
      if (!resolvedRef.current) {
        onFallback?.();
      }
    }, FALLBACK_TIMEOUT_MS);
  }, [siteKey, handleSuccess, handleExpire, handleError, onFallback, theme]);

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
