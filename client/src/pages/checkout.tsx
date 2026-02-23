import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";

declare global {
  interface Window {
    sendPaymentInfos: (
      transactionId: string,
      agencyCode: string,
      secretKey: string,
      web: string,
      successUrl: string,
      failedUrl: string,
      amount: number,
      city: string,
      email: string,
      firstName: string,
      lastName: string,
      mobile: string
    ) => void;
  }
}

interface PaymentDetails {
  transactionId: string;
  agencyCode: string;
  secretKey: string;
  web: string;
  netPayable: number;
  currency: string;
  description: string;
  name: string;
  email: string;
  mobile: string;
  adminName: string;
  adminLogo: string;
  adminEmail: string;
}

export default function CheckoutPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [, navigate] = useLocation();
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const paymentStatus = searchParams.get("status");

  useEffect(() => {
    if (!transactionId) {
      setError("Identifiant de transaction invalide.");
      setLoading(false);
      return;
    }
    fetch(`/api/checkout/${transactionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.message && !data.transactionId) {
          setError(data.message);
        } else {
          setDetails(data);
        }
      })
      .catch(() => setError("Impossible de charger les détails de paiement."))
      .finally(() => setLoading(false));
  }, [transactionId]);

  useEffect(() => {
    const existing = document.getElementById("touchpay-sdk");
    if (existing) {
      setSdkReady(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "touchpay-sdk";
    script.src = "https://touchpay.gutouch.net/touchpayv2/script/touchpaynr/prod_touchpay-0.0.1.js";
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => console.error("Échec du chargement du SDK TouchPay");
    document.head.appendChild(script);
    return () => {
    };
  }, []);

  const handlePay = () => {
    if (!details || !sdkReady) return;
    if (!window.sendPaymentInfos) {
      setError("Le module de paiement n'est pas encore prêt. Veuillez patienter un instant.");
      return;
    }
    setPaying(true);
    const origin = window.location.origin;
    const successUrl = `${origin}/checkout/${transactionId}?status=success`;
    const failedUrl = `${origin}/checkout/${transactionId}?status=failed`;
    const nameParts = details.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "";
    try {
      window.sendPaymentInfos(
        details.transactionId,
        details.agencyCode,
        details.secretKey,
        details.web,
        successUrl,
        failedUrl,
        Math.round(details.netPayable),
        "Dakar",
        details.email,
        firstName,
        lastName,
        details.mobile || ""
      );
    } catch (e: any) {
      setError("Erreur lors du lancement du paiement : " + e.message);
      setPaying(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount) + " " + currency;
  };

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
        padding: "32px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{
              width: "48px", height: "48px",
              border: "4px solid #e2e8f0",
              borderTop: "4px solid #3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "#64748b", margin: 0 }}>Chargement des détails...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ color: "#dc2626", marginBottom: "12px" }}>Erreur</h2>
            <p style={{ color: "#64748b" }}>{error}</p>
            <button
              onClick={() => window.history.back()}
              style={{
                marginTop: "16px",
                padding: "10px 24px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Retour
            </button>
          </div>
        ) : paymentStatus === "success" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: "72px", height: "72px",
              background: "#dcfce7",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "36px",
            }}>✅</div>
            <h2 style={{ color: "#16a34a", marginBottom: "8px" }}>Paiement réussi !</h2>
            <p style={{ color: "#64748b", marginBottom: "24px" }}>
              Votre paiement de {details ? formatAmount(details.netPayable, details.currency) : ""} a été effectué avec succès.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                padding: "12px 32px",
                background: "#16a34a",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
              }}
            >
              Voir mon compte
            </button>
          </div>
        ) : paymentStatus === "failed" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: "72px", height: "72px",
              background: "#fee2e2",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "36px",
            }}>❌</div>
            <h2 style={{ color: "#dc2626", marginBottom: "8px" }}>Paiement échoué</h2>
            <p style={{ color: "#64748b", marginBottom: "24px" }}>
              Le paiement n'a pas pu être traité. Veuillez réessayer.
            </p>
            <button
              onClick={() => navigate(`/checkout/${transactionId}`)}
              style={{
                padding: "12px 32px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                marginRight: "12px",
              }}
            >
              Réessayer
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                padding: "12px 32px",
                background: "#e2e8f0",
                color: "#334155",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
              }}
            >
              Annuler
            </button>
          </div>
        ) : details ? (
          <>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              {details.adminLogo && (
                <img
                  src={details.adminLogo}
                  alt={details.adminName}
                  style={{ height: "48px", marginBottom: "12px", objectFit: "contain" }}
                />
              )}
              <h1 style={{ fontSize: "20px", fontWeight: "700", color: "#1e293b", margin: "0 0 4px" }}>
                {details.adminName}
              </h1>
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>Paiement sécurisé</p>
            </div>

            <div style={{
              background: "#f8fafc",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "24px",
            }}>
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Montant à payer
                </p>
                <p style={{ fontSize: "36px", fontWeight: "700", color: "#1e293b", margin: 0 }}>
                  {formatAmount(details.netPayable, details.currency)}
                </p>
              </div>

              {details.description && (
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginBottom: "12px" }}>
                  <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 4px", textTransform: "uppercase" }}>Description</p>
                  <p style={{ color: "#334155", fontSize: "14px", margin: 0 }}>{details.description}</p>
                </div>
              )}

              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 4px", textTransform: "uppercase" }}>Client</p>
                <p style={{ color: "#334155", fontSize: "14px", margin: "0 0 2px", fontWeight: "500" }}>{details.name}</p>
                <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>{details.email}</p>
              </div>
            </div>

            <div style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}>
              <span style={{ fontSize: "16px" }}>🔐</span>
              <p style={{ color: "#92400e", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>
                En cliquant sur "Payer maintenant", une fenêtre de paiement sécurisée s'ouvrira. Suivez les instructions pour approuver le paiement depuis votre téléphone.
              </p>
            </div>

            {error && (
              <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                {error}
              </p>
            )}

            <button
              onClick={handlePay}
              disabled={paying || !sdkReady}
              style={{
                width: "100%",
                padding: "16px",
                background: paying || !sdkReady ? "#94a3b8" : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                cursor: paying || !sdkReady ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: "700",
                letterSpacing: "0.5px",
                transition: "opacity 0.2s",
              }}
            >
              {!sdkReady ? "Préparation..." : paying ? "Traitement en cours..." : "Payer maintenant"}
            </button>

            <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "12px", marginTop: "16px", marginBottom: 0 }}>
              Paiement sécurisé via Mobile Money · TouchPay
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
