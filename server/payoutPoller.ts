import { storage } from "./storage";
import { checkSwychrPayoutStatus } from "./swychrPayout";

const POLL_INTERVAL  = 30_000; // 30 seconds
const MAX_ATTEMPTS   = 120;    // 120 × 30s = 60 minutes max

interface PendingPayout {
  transactionId:  string; // DB transaction.id
  reference:      string; // our internal ref (used for Swychr lookup)
  userId:         string;
  amount:         string;
  totalDebited:   string;
  attempts:       number;
}

const pendingPayouts = new Map<string, PendingPayout>();

export function addPendingPayout(payout: Omit<PendingPayout, "attempts">) {
  console.log(`[PayoutPoller] Tracking payout: ${payout.reference}`);
  pendingPayouts.set(payout.reference, { ...payout, attempts: 0 });
}

export function removePendingPayout(reference: string) {
  pendingPayouts.delete(reference);
}

async function processPayout(payout: PendingPayout, apiStatus: string) {
  try {
    const transaction = await storage.getTransactionById(payout.transactionId);
    if (!transaction || transaction.status !== "pending") {
      removePendingPayout(payout.reference);
      return;
    }

    if (apiStatus === "success") {
      await storage.updateTransactionStatus(payout.transactionId, "completed");
      await storage.createUserNotification({
        userId:        payout.userId,
        type:          "withdrawal_confirmed",
        title:         "Retrait confirmé",
        message:       `Votre retrait de ${payout.amount} XAF a été envoyé avec succès.`,
        transactionId: payout.transactionId,
        isRead:        false,
      });
      console.log(`[PayoutPoller] ✅ Payout success: ${payout.reference}`);

    } else {
      // failed / refunded / cancelled → refund user
      await storage.updateTransactionStatus(payout.transactionId, "failed");
      const refundAmount = parseFloat(payout.totalDebited || payout.amount);
      await storage.updateUserBalance(payout.userId, refundAmount);
      await storage.createUserNotification({
        userId:        payout.userId,
        type:          "withdrawal_failed",
        title:         "Retrait échoué",
        message:       `Votre retrait de ${payout.amount} XAF a échoué. Le montant a été recrédité sur votre compte.`,
        transactionId: payout.transactionId,
        isRead:        false,
      });
      console.log(`[PayoutPoller] ❌ Payout failed (${apiStatus}): ${payout.reference} — refunded ${refundAmount}`);
    }

    removePendingPayout(payout.reference);
  } catch (err: any) {
    console.error(`[PayoutPoller] Error processing payout ${payout.reference}:`, err.message);
  }
}

async function pollPendingPayouts() {
  const entries = Array.from(pendingPayouts.entries());
  for (const [reference, payout] of entries) {
    payout.attempts++;

    if (payout.attempts > MAX_ATTEMPTS) {
      console.log(`[PayoutPoller] Timeout for ${reference} — marking failed`);
      await processPayout(payout, "failed");
      continue;
    }

    const result = await checkSwychrPayoutStatus(reference);
    if (!result.success) {
      console.log(`[PayoutPoller] Status check error for ${reference}: ${result.message}`);
      continue;
    }

    const status = result.status;
    console.log(`[PayoutPoller] ${reference}: status=${status} (attempt ${payout.attempts}/${MAX_ATTEMPTS})`);

    if (status === "success") {
      await processPayout(payout, "success");
    } else if (status === "failed" || status === "refunded" || status === "cancelled") {
      await processPayout(payout, status);
    }
    // pending / processing → keep polling
  }
}

let pollerInterval: NodeJS.Timeout | null = null;

export function startPayoutPoller() {
  if (pollerInterval) { console.log("[PayoutPoller] Already running"); return; }
  console.log("[PayoutPoller] Starting payout poller (every 30 seconds)");
  pollerInterval = setInterval(pollPendingPayouts, POLL_INTERVAL);
}

export function stopPayoutPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[PayoutPoller] Stopped");
  }
}
