import { useEffect, useState } from "react";
import { useParams } from "wouter";

export default function CheckoutPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!transactionId) {
      setError("Identifiant de transaction invalide.");
      return;
    }
    fetch(`/api/checkout/${transactionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.paymentLink) {
          window.location.href = data.paymentLink;
        } else if (data.message) {
          setError(data.message);
        } else {
          setError("Lien de paiement introuvable.");
        }
      })
      .catch(() => setError("Impossible de charger les détails de paiement."));
  }, [transactionId]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif",
      padding: "20px",
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "40px 32px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        textAlign: "center",
      }}>
        {error ? (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ color: "#ef4444", marginBottom: "8px" }}>Erreur</h2>
            <p style={{ color: "#64748b" }}>{error}</p>
          </>
        ) : (
          <>
            <div style={{
              width: "48px", height: "48px",
              border: "4px solid #e2e8f0",
              borderTop: "4px solid #3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "#64748b", margin: 0 }}>Redirection vers la page de paiement sécurisée...</p>
          </>
        )}
      </div>
    </div>
  );
}
