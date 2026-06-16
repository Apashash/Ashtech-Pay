import { db } from "./db";
import { and, lt, inArray, sql } from "drizzle-orm";
import {
  transactions,
  paymentIntents,
  adminLogs,
  auditLogs,
  conversionRequests,
  hostedPaymentSessions,
} from "@shared/schema";

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 heures
const RETENTION_DAYS = 30;

/**
 * Supprime automatiquement toutes les données de transaction
 * de plus de 30 jours (côté utilisateur et côté admin).
 * Les transactions en statut "pending" ou "processing" ne sont
 * jamais supprimées pour éviter de casser un paiement en cours.
 */
export async function cleanupOldTransactions() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const FINAL_STATUSES = ["completed", "failed", "cancelled", "expired"];

    // 1. Transactions utilisateurs (dépôts, retraits, envois, liens de paiement)
    const txResult = await db
      .delete(transactions)
      .where(
        and(
          lt(transactions.createdAt, cutoff),
          inArray(transactions.status, FINAL_STATUSES)
        )
      );
    const txCount = (txResult as any).rowCount ?? 0;
    if (txCount > 0) {
      console.log(`[Cleanup] ${txCount} transaction(s) supprimée(s) (> ${RETENTION_DAYS}j)`);
    }

    // 2. Payment intents (sessions de paiement temporaires)
    const piResult = await db
      .delete(paymentIntents)
      .where(lt(paymentIntents.createdAt, cutoff));
    const piCount = (piResult as any).rowCount ?? 0;
    if (piCount > 0) {
      console.log(`[Cleanup] ${piCount} payment intent(s) supprimé(s) (> ${RETENTION_DAYS}j)`);
    }

    // 3. Sessions de paiement hébergées (Hosted Payment Page)
    const hpsResult = await db
      .delete(hostedPaymentSessions)
      .where(
        and(
          lt(hostedPaymentSessions.createdAt, cutoff),
          inArray(hostedPaymentSessions.status, FINAL_STATUSES)
        )
      );
    const hpsCount = (hpsResult as any).rowCount ?? 0;
    if (hpsCount > 0) {
      console.log(`[Cleanup] ${hpsCount} session(s) hébergée(s) supprimée(s) (> ${RETENTION_DAYS}j)`);
    }

    // 4. Demandes de conversion (côté admin & utilisateur)
    const cvResult = await db
      .delete(conversionRequests)
      .where(
        and(
          lt(conversionRequests.createdAt, cutoff),
          inArray(conversionRequests.status, ["completed", "cancelled"])
        )
      );
    const cvCount = (cvResult as any).rowCount ?? 0;
    if (cvCount > 0) {
      console.log(`[Cleanup] ${cvCount} demande(s) de conversion supprimée(s) (> ${RETENTION_DAYS}j)`);
    }

    // 5. Logs d'activité admin (admin_logs)
    const alResult = await db
      .delete(adminLogs)
      .where(lt(adminLogs.createdAt, cutoff));
    const alCount = (alResult as any).rowCount ?? 0;
    if (alCount > 0) {
      console.log(`[Cleanup] ${alCount} log(s) admin supprimé(s) (> ${RETENTION_DAYS}j)`);
    }

    // 6. Logs d'audit sécurité (audit_logs)
    const auResult = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, cutoff));
    const auCount = (auResult as any).rowCount ?? 0;
    if (auCount > 0) {
      console.log(`[Cleanup] ${auCount} log(s) d'audit supprimé(s) (> ${RETENTION_DAYS}j)`);
    }

    const total = txCount + piCount + hpsCount + cvCount + alCount + auCount;
    if (total === 0) {
      console.log(`[Cleanup] Aucune donnée à supprimer (rétention ${RETENTION_DAYS}j respectée)`);
    }
  } catch (err: any) {
    console.error("[Cleanup] Erreur lors du nettoyage:", err.message);
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupScheduler() {
  if (cleanupInterval) {
    console.log("[Cleanup] Scheduler déjà actif");
    return;
  }

  console.log(`[Cleanup] Démarrage — suppression automatique toutes les 24h (rétention ${RETENTION_DAYS} jours)`);

  // Exécution immédiate au démarrage
  cleanupOldTransactions().catch((err) => {
    console.error("[Cleanup] Nettoyage initial échoué:", err.message);
  });

  // Puis toutes les 24 heures
  cleanupInterval = setInterval(() => {
    cleanupOldTransactions().catch((err) => {
      console.error("[Cleanup] Nettoyage planifié échoué:", err.message);
    });
  }, CLEANUP_INTERVAL);
}

export function stopCleanupScheduler() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("[Cleanup] Scheduler arrêté");
  }
}
