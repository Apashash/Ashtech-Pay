import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

function showFatalError(message: string) {
  const root = document.getElementById("root");
  if (!root || root.children.length > 0) return;
  root.innerHTML = `<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;background:#0f172a;color:#f8fafc;font-family:sans-serif;text-align:center;gap:1.5rem"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><div><h1 style="font-size:1.25rem;font-weight:700;margin-bottom:.5rem">Erreur de démarrage</h1><p style="color:#94a3b8;max-width:380px;line-height:1.6">${message}</p></div><button onclick="sessionStorage.clear();location.reload()" style="padding:.65rem 1.75rem;background:#f59e0b;color:#0f172a;border:none;border-radius:.5rem;font-weight:700;font-size:1rem;cursor:pointer">Recharger la page</button></div>`;
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
