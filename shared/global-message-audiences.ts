export const GLOBAL_MESSAGE_PUSH_AUDIENCES = [
  {
    value: "all_active",
    label: "Tous les utilisateurs actifs",
    description: "Comptes clients non suspendus; les comptes du personnel sont exclus.",
  },
  {
    value: "kyc_verified",
    label: "KYC validé",
    description: "Clients dont le KYC est vérifié.",
  },
  {
    value: "kyc_not_submitted",
    label: "KYC non soumis",
    description: "Clients qui n'ont pas encore envoyé leurs documents.",
  },
  {
    value: "kyc_pending",
    label: "KYC en attente",
    description: "Clients dont le dossier attend une vérification.",
  },
  {
    value: "kyc_rejected",
    label: "KYC rejeté",
    description: "Clients dont le dossier a été rejeté.",
  },
  {
    value: "direct_api_active",
    label: "API Direct active",
    description: "API activée avec une clé Direct enregistrée.",
  },
  {
    value: "direct_api_disabled",
    label: "API Direct désactivée",
    description: "Clients dont l'accès à l'API Direct est désactivé.",
  },
  {
    value: "has_completed_transaction",
    label: "Au moins une transaction terminée",
    description: "Clients ayant déjà terminé une opération.",
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
    description: "Clients sans activité ni connexion récente.",
  },
  {
    value: "suspended_accounts",
    label: "Comptes suspendus",
    description: "Comptes clients suspendus; à choisir seulement si le message les concerne.",
  },
] as const;

export type GlobalMessagePushAudience =
  (typeof GLOBAL_MESSAGE_PUSH_AUDIENCES)[number]["value"];

export function isGlobalMessagePushAudience(
  value: unknown,
): value is GlobalMessagePushAudience {
  return typeof value === "string"
    && GLOBAL_MESSAGE_PUSH_AUDIENCES.some((audience) => audience.value === value);
}
