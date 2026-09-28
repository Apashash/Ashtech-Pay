export type MaintenanceResponseKind = "html" | "json" | null;

const HTML_CHECKOUT_PATH = /^\/(?:pay|hpay|checkout)\/[^/]+\/?$/;
const API_PREFIXES = [
  "/v1",
  "/api/v1",
  "/api/deposits",
  "/api/payment-links/public",
  "/api/public/hosted-session",
  "/api/checkout",
];
const PAYMENT_LINK_ACTION_PATH = /^\/api\/payment-links\/[^/]+\/(?:pay|confirm-otp|crypto\/address)$/;

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getMaintenanceResponseKind(pathname: string): MaintenanceResponseKind {
  if (HTML_CHECKOUT_PATH.test(pathname)) return "html";
  if (API_PREFIXES.some(prefix => matchesPathPrefix(pathname, prefix))) return "json";
  if (PAYMENT_LINK_ACTION_PATH.test(pathname)) return "json";
  return null;
}

export const SERVICE_MAINTENANCE_MESSAGE =
  "Service en maintenance. Veuillez réessayer dans quelques instants.";

export function normalizeServiceMaintenancePayload(body: unknown): {
  error: "service_maintenance";
  code: "SERVICE_MAINTENANCE";
  message: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;
  if (
    payload.error !== "service_maintenance" ||
    payload.code !== "SERVICE_MAINTENANCE"
  ) {
    return null;
  }

  // Return a fixed message rather than trusting arbitrary contents from a
  // response body that happens to use the maintenance error code.
  return {
    error: "service_maintenance",
    code: "SERVICE_MAINTENANCE",
    message: SERVICE_MAINTENANCE_MESSAGE,
  };
}

export const SERVICE_MAINTENANCE_HTML = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Service en maintenance — AshTech Pay</title>
  <style>
    *{box-sizing:border-box}
    body{min-height:100vh;margin:0;padding:24px;display:grid;place-items:center;background:#f5f7fb;color:#182230;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    main{width:min(100%,460px);padding:36px 28px;border:1px solid #e4e9f0;border-radius:18px;background:#fff;text-align:center;box-shadow:0 18px 50px rgba(16,24,40,.08)}
    .mark{width:56px;height:56px;margin:0 auto 18px;border-radius:50%;display:grid;place-items:center;background:#fff5d6;color:#a86d00;font-size:28px}
    h1{margin:0 0 10px;font-size:24px}
    p{margin:0;color:#667085;line-height:1.6}
  </style>
</head>
<body><main><div class="mark" aria-hidden="true">!</div><h1>Service en maintenance</h1><p>${SERVICE_MAINTENANCE_MESSAGE}</p></main></body>
</html>`;