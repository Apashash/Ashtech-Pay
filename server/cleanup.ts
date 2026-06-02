import { db, pool } from "./db";
import { and, lt, eq } from "drizzle-orm";
import { transactions, paymentIntents } from "@shared/schema";

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_DAYS = 30;

/**
 * Clean up expired payment intents only — transactions are kept indefinitely
 */
export async function cleanupOldTransactions() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // Only delete old payment intents (temporary checkout sessions, not financial records)
    const piResult = await db
      .delete(paymentIntents)
      .where(
        lt(paymentIntents.createdAt, cutoffDate)
      );

    const piCount = piResult.rowCount || 0;
    if (piCount > 0) {
      console.log(`[Cleanup] Deleted ${piCount} expired payment intents older than ${RETENTION_DAYS} days`);
    }
  } catch (err: any) {
    console.error("[Cleanup] Error during cleanup:", err.message);
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
