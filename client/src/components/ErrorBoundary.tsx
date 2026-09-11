import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);

    // React.lazy() loads dashboard pages as separate chunks. During a deploy
    // or on a briefly interrupted mobile connection, the old HTML can request
    // a chunk that is no longer available. One automatic reload repairs that
    // stale chunk without forcing the user to press the button manually.
    if (this.isTransientChunkError(error)) {
      const retryKey = "ashtech_chunk_reload_attempt";
      try {
        if (sessionStorage.getItem(retryKey) !== "1") {
          sessionStorage.setItem(retryKey, "1");
          window.setTimeout(() => window.location.reload(), 250);
        } else {
          sessionStorage.removeItem(retryKey);
        }
      } catch {
        // Private browsing can block sessionStorage; leave the visible
        // fallback in place rather than risking a reload loop.
      }
    }
  }

  private isTransientChunkError(error: Error): boolean {
    const message = String(error?.message || error || "").toLowerCase();
    return (
      message.includes("failed to fetch dynamically imported module") ||
      message.includes("error loading dynamically imported module") ||
      message.includes("importing a module script failed") ||
      message.includes("loading chunk") && message.includes("failed")
    );
  }

  handleReload = () => {
    try { sessionStorage.clear(); } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "#0f172a",
        color: "#f8fafc",
        fontFamily: "sans-serif",
        textAlign: "center",
        gap: "1.5rem",
      }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Une erreur inattendue s'est produite
          </h1>
          <p style={{ color: "#94a3b8", maxWidth: "400px", lineHeight: 1.6 }}>
            Rechargez la page pour continuer. Si le problème persiste, videz le cache de votre navigateur.
          </p>
        </div>
        <button
          onClick={this.handleReload}
          style={{
            padding: "0.65rem 1.75rem",
            background: "#f59e0b",
            color: "#0f172a",
            border: "none",
            borderRadius: "0.5rem",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Recharger la page
        </button>
      </div>
    );
  }
}
