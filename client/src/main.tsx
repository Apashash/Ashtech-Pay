import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { clearChunkReloadAttempt } from "./lib/chunk-recovery";

// Remove the one-time cache-busting parameter after a recovery reload so it
// does not remain in copied URLs or affect application route query parameters.
try {
  const recoveryUrl = new URL(window.location.href);
  if (recoveryUrl.searchParams.has("__ashtech_reload")) {
    recoveryUrl.searchParams.delete("__ashtech_reload");
    window.history.replaceState({}, "", `${recoveryUrl.pathname}${recoveryUrl.search}${recoveryUrl.hash}`);
  }
} catch {}

function showFatalError(message: string) {
  const root = document.getElementById("root");
  if (!root || root.children.length > 0) return;
  // Build DOM safely — no innerHTML interpolation of user-controlled strings (XSS prevention)
  const wrap = document.createElement("div");
  wrap.setAttribute("style", "min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;background:#0f172a;color:#f8fafc;font-family:sans-serif;text-align:center;gap:1.5rem");
  wrap.innerHTML = '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  const text = document.createElement("div");
  const h1 = document.createElement("h1");
  h1.setAttribute("style", "font-size:1.25rem;font-weight:700;margin-bottom:.5rem");
  h1.textContent = "Erreur de démarrage";
  const p = document.createElement("p");
  p.setAttribute("style", "color:#94a3b8;max-width:380px;line-height:1.6");
  p.textContent = message; // textContent — never innerHTML for user-supplied strings
  const btn = document.createElement("button");
  btn.setAttribute("style", "padding:.65rem 1.75rem;background:#f59e0b;color:#0f172a;border:none;border-radius:.5rem;font-weight:700;font-size:1rem;cursor:pointer");
  btn.textContent = "Recharger la page";
   btn.addEventListener("click", () => { clearChunkReloadAttempt(); location.reload(); });
  text.appendChild(h1);
  text.appendChild(p);
  wrap.appendChild(text);
  wrap.appendChild(btn);
  root.appendChild(wrap);
}

try {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (e: any) {
  console.error("[main] Fatal render error:", e);
  showFatalError(e?.message || "Erreur inattendue. Rechargez la page.");
}
