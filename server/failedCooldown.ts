/**
 * failedCooldown.ts — Cooldown de 5 minutes après rejet d'un retrait ou envoi.
 * Stockage en mémoire : léger, se réinitialise au redémarrage (acceptable pour un cooldown).
 */

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// userId → timestamp (ms) du dernier échec
const cooldownMap = new Map<string, number>();

/** Déclenche le cooldown pour un utilisateur (appeler à chaque rejet de retrait/transfert). */
export function setFailedCooldown(userId: string): void {
  cooldownMap.set(userId, Date.now());
  // Auto-nettoyage après expiration
  setTimeout(() => {
    const ts = cooldownMap.get(userId);
    if (ts && Date.now() - ts >= COOLDOWN_MS) cooldownMap.delete(userId);
  }, COOLDOWN_MS + 2000);
}

/** Vérifie si un utilisateur est en cooldown. */
export function getFailedCooldown(userId: string): {
  active: boolean;
  waitUntilMs: number;
  remainingMs: number;
} {
  const failedAt = cooldownMap.get(userId);
  if (!failedAt) return { active: false, waitUntilMs: 0, remainingMs: 0 };
  const waitUntilMs = failedAt + COOLDOWN_MS;
  const remainingMs = waitUntilMs - Date.now();
  if (remainingMs <= 0) {
    cooldownMap.delete(userId);
    return { active: false, waitUntilMs: 0, remainingMs: 0 };
  }
  return { active: true, waitUntilMs, remainingMs };
}
