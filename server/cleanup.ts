import { db } from "./db";
import { and, lt, eq } from "drizzle-orm";
import { transactions, paymentIntents } from "@shared/schema";

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_DAYS = 30;

/**
 * Delete completed/failed transactions older than RETENTION_DAYS
 */
export async function cleanupOldTransactions() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // Delete old completed transactions
    const completedResult = await db
      .delete(transactions)
      .where(
        and(
          lt(transactions.createdAt, cutoffDate),
          eq(transactions.status, "completed")
        )
      );

    const completedCount = completedResult.rowCount || 0;
    if (completedCount > 0) {
      console.log(`[Cleanup] Deleted ${completedCount} completed transactions older than ${RETENTION_DAYS} days`);
    }

    // Delete old failed transactions
    const failedResult = await db
      .delete(transactions)
      .where(
        and(
          lt(transactions.createdAt, cutoffDate),
          eq(transactions.status, "failed")
        )
      );

    const failedCount = failedResult.rowCount || 0;
    if (failedCount > 0) {
      console.log(`[Cleanup] Deleted ${failedCount} failed transactions older than ${RETENTION_DAYS} days`);
    }

    // Delete old payment intents
    const piResult = await db
      .delete(paymentIntents)
      .where(
        lt(paymentIntents.createdAt, cutoffDate)
      );

    const piCount = piResult.rowCount || 0;
    if (piCount > 0) {
      console.log(`[Cleanup] Deleted ${piCount} payment intents older than ${RETENTION_DAYS} days`);
    }

    const totalDeleted = completedCount + failedCount + piCount;
    if (totalDeleted > 0) {
      console.log(`[Cleanup] Total cleaned up: ${totalDeleted} records`);
    }
  } catch (err: any) {
    console.error("[Cleanup] Error cleaning up old transactions:", err.message);
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupScheduler() {
  if (cleanupInterval) {
    console.log("[Cleanup] Scheduler already running");
    return;
  }

  console.log("[Cleanup] Starting cleanup scheduler (every 24 hours, retention: 30 days)");

  // Run cleanup immediately on startup
  cleanupOldTransactions().catch(err => {
    console.error("[Cleanup] Initial cleanup failed:", err.message);
  });

  // Then run every 24 hours
  cleanupInterval = setInterval(() => {
    cleanupOldTransactions().catch(err => {
      console.error("[Cleanup] Scheduled cleanup failed:", err.message);
    });
  }, CLEANUP_INTERVAL);
}

export function stopCleanupScheduler() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("[Cleanup] Scheduler stopped");
  }
}
