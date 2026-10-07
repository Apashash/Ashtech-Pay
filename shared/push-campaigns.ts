export const ADMIN_PUSH_CAMPAIGN_SEGMENTS = [
  {
    value: "all_active",
    label: "Tous les utilisateurs actifs",
    description: "Tous les comptes clients non suspendus. Les comptes du personnel sont exclus.",
  },
  {
    value: "kyc_verified",
    label: "KYC validé",
    description: "Clients dont le KYC est marqué comme validé.",
  },
  {
    value: "kyc_not_submitted",
    label: "KYC non soumis",
    description: "Clients qui n'ont pas encore envoyé leurs documents KYC.",
  },
  {
    value: "kyc_pending",
    label: "KYC en attente",
    description: "Clients dont le dossier KYC attend une vérification.",
  },
  {
    value: "kyc_rejected",
    label: "KYC rejeté",
    description: "Clients dont le dernier statut KYC est rejeté.",
  },
  {
    value: "kyc_verified_no_transactions",
    label: "KYC validé, sans transaction terminée",
    description: "Clients vérifiés qui n'ont encore aucune transaction terminée.",
  },
  {
    value: "direct_api_active",
    label: "Clé API Direct active",
    description: "Clients avec l'API activée et une clé Direct enregistrée.",
  },
  {
    value: "direct_api_enabled_no_key",
    label: "API activée, sans clé enregistrée",
    description: "Comptes dont l'accès API est activé mais sans clé enregistrée.",
  },
  {
    value: "direct_api_disabled",
    label: "API Direct désactivée",
    description: "Clients dont l'accès à l'API Direct est désactivé.",
  },
  {
    value: "has_completed_transaction",
    label: "Au moins une transaction terminée",
    description: "Clients ayant déjà effectué une opération terminée.",
  },
  {
    value: "no_completed_transaction",
    label: "Aucune transaction terminée",
    description: "Clients sans opération terminée à ce jour.",
  },
  {
    value: "frequent_transactions",
    label: "Utilisateurs très actifs (10+ transactions)",
    description: "Clients ayant terminé au moins 10 opérations.",
  },
  {
    value: "new_accounts_30_days",
    label: "Nouveaux comptes (30 derniers jours)",
    description: "Clients inscrits au cours des 30 derniers jours.",
  },
  {
    value: "recently_active_30_days",
    label: "Actifs récemment (30 derniers jours)",
    description: "Clients connectés ou actifs au cours des 30 derniers jours.",
  },
  {
    value: "inactive_30_days",
    label: "Inactifs depuis 30 jours ou plus",
    description: "Clients sans activité ni connexion depuis au moins 30 jours.",
  },
  {
    value: "suspended_accounts",
    label: "Comptes suspendus",
    description: "Comptes clients suspendus; à utiliser seulement pour un message pertinent.",
  },
] as const;

export type AdminPushCampaignSegment =
  (typeof ADMIN_PUSH_CAMPAIGN_SEGMENTS)[number]["value"];

export function isAdminPushCampaignSegment(
  value: unknown,
): value is AdminPushCampaignSegment {
  return typeof value === "string"
    && ADMIN_PUSH_CAMPAIGN_SEGMENTS.some((segment) => segment.value === value);
}

export const ADMIN_PUSH_TITLE_MAX_LENGTH = 80;
export const ADMIN_PUSH_BODY_MAX_LENGTH = 240;
export const ADMIN_PUSH_URL_MAX_LENGTH = 512;

/**
 * Push links must remain on the AshTech Pay site. Empty links open the
 * notification center by default.
 */
export function normalizeAdminPushUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return "/dashboard/notifications";
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return "/dashboard/notifications";
  if (
    trimmed.length > ADMIN_PUSH_URL_MAX_LENGTH
    || !trimmed.startsWith("/")
    || trimmed.startsWith("//")
    || trimmed.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "https://ashtechpay.invalid");
    if (parsed.origin !== "https://ashtechpay.invalid") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
