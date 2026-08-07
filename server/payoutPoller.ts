import { storage } from "./storage";
import { checkAfribaPayStatus, checkAfribaPayoutStatus } from "./afribapay";
import { checkPixPayStatus } from "./pixpay";
import { sendWithdrawalApprovedEmail } from "./email";
import { notifyWithdrawalAutoValidated, notifyWithdrawalFailed } from "./telegram";
import { setFailedCooldown } from "./failedCooldown";

const POLL_INTERVAL  = 6_000; // 6 seconds
const MAX_ATTEMPTS   = 600;    // 600 × 6s = 60 minutes max

interface PendingPayout {
  transactionId:  string;
  reference:      string;
  userId:         string;
  amount:         string;
  totalDebited:   string;
  attempts:       number;
  provider:       "afribapay" | "pixpay";
  countryCode:    string;
  txType:         string;
  txCurrency:     string;
  /** The wallet key that was actually debited (may differ from txCurrency, e.g. "XOF" vs "XOFB"). Used for refunds. */
  walletCurrency?: string;
}

const pendingPayouts = new Map<string, PendingPayout>();

export function addPendingPayout(payout: Omit<PendingPayout, "attempts">) {
  console.log(`[PayoutPoller] Tracking payout: ${payout.reference} (provider=${payout.provider}, country=${payout.countryCode})`);
  pendingPayouts.set(payout.reference, { ...payout, attempts: 0 });
}

export function removePendingPayout(reference: string) {
  pendingPayouts.delete(reference);
}

// ─── Recover pending payouts from DB on startup ───────────────────────────
export async function recoverPendingPayouts() {
  try {
    // Use targeted query — avoids loading ALL transactions into memory on every restart
    const pending = await storage.getPendingPayoutTransactions();
    if (pending.length === 0) {
      console.log("[PayoutPoller] No pending payouts to recover");
      return;
    }
    console.log(`[PayoutPoller] Recovering ${pending.length} pending payout(s) from DB`);
    for (const t of pending) {
      const internalRef = t.reference ?? "";
      if (!internalRef) continue;
      const operator = t.operatorId ? await storage.getOperator(t.operatorId).catch(() => null) : null;
      const provider = (operator as any)?.paymentProvider as "afribapay" | "pixpay" | undefined;
      if (provider !== "afribapay" && provider !== "pixpay") {
        console.warn(`[PayoutPoller] Skipping pending payout ${internalRef}: no supported provider`);
        continue;
      }
      const countryCode = (t as any).recipientCountry || "CM";

      let pollerRef = (t as any).externalReference || internalRef;
      if (provider === "afribapay") {
        // For retries, externalReference holds the submitted order_id (retry ref).
        // For original submissions without an externalReference, fall back to internalRef.
        pollerRef = (t as any).externalReference || internalRef;
      } else if (provider === "pixpay") {
        pollerRef = (t as any).externalReference || internalRef;
      }

      if (!pollerRef || pendingPayouts.has(pollerRef)) continue;

      pendingPayouts.set(pollerRef, {
        transactionId: t.id,
        reference:     pollerRef,
        userId:        t.userId,
        amount:        t.amount ?? "0",
        totalDebited:  t.totalAmount ?? t.amount ?? "0",
        attempts:      0,
        provider,
        countryCode,
        txType:        t.type,
        txCurrency:    t.currency || "XAF",
      });
      console.log(`[PayoutPoller] Recovered: ${pollerRef} (${t.type}, provider=${provider})`);
    }
  } catch (err: any) {
    console.error("[PayoutPoller] Recovery error:", err.message);
  }
}

async function processPayout(payout: PendingPayout, apiStatus: string) {
  try {
    const transaction = await storage.getTransactionById(payout.transactionId);
    if (!transaction || (transaction.status !== "pending" && transaction.status !== "processing")) {
      removePendingPayout(payout.reference);
      return;
    }

    const currency = transaction.currency || "XAF";

    if (apiStatus === "success") {
      await storage.updateTransactionStatus(payout.transactionId, "completed");

      const txUser = await storage.getUser(payout.userId).catch(() => null);
      if (txUser?.email) {
        sendWithdrawalApprovedEmail(
          txUser.email,
          txUser.fullName || txUser.username,
          payout.amount,
          currency,
          transaction.reference || undefined,
          (transaction as any).operator || undefined
        ).catch((err: any) => console.error("[PayoutPoller] Email error:", err.message));
      }

      await storage.createUserNotification({
        userId:        payout.userId,
        type:          "withdrawal_confirmed",
        title:         "withdrawal_confirmed",
        message:       JSON.stringify({ amount: payout.amount, currency }),
        transactionId: payout.transactionId,
        isRead:        false,
      });
      console.log(`[PayoutPoller] ✅ Payout success: ${payout.reference} (${payout.provider})`);

      notifyWithdrawalAutoValidated({
        userName: (txUser as any)?.fullName || (txUser as any)?.username || "Utilisateur",
        userEmail: (txUser as any)?.email || "",
        userPhone: (txUser as any)?.phone || undefined,
        senderCountry: (txUser as any)?.country || undefined,
        amount: payout.amount,
        grossAmount: payout.totalDebited || payout.amount,
        currency,
        reference: (transaction as any).reference || payout.reference,
        externalReference: (transaction as any).externalReference || undefined,
        provider: payout.provider,
        recipientName: transaction.recipientName || undefined,
        recipientPhone: transaction.recipientPhone || undefined,
        recipientCountry: transaction.recipientCountry || undefined,
        txType: payout.txType,   // "transfer_out" → TRANSFERT CONFIRMÉ
      }).catch(() => {});

    } else {
      await storage.updateTransactionStatus(payout.transactionId, "failed");
      // Déclenche le cooldown 5min — l'utilisateur doit attendre avant de relancer
      setFailedCooldown(payout.userId);
      const refundAmount = parseFloat(payout.totalDebited || payout.amount);
      // Use walletCurrency (the key actually debited) when available; fall back to txCurrency.
      // walletCurrency may differ from txCurrency when the wallet was stored under a generic code
      // (e.g. "XOF") while the provider needed a country-specific variant (e.g. "XOFB").
      await storage.refundToOriginalWallet(payout.userId, payout.txType, payout.walletCurrency || payout.txCurrency, refundAmount);
      await storage.createUserNotification({
        userId:        payout.userId,
        type:          "withdrawal_failed",
        title:         "withdrawal_failed",
        message:       JSON.stringify({ amount: payout.amount, currency }),
        transactionId: payout.transactionId,
        isRead:        false,
      });
      console.log(`[PayoutPoller] ❌ Payout failed (${apiStatus}): ${payout.reference} — refunded ${refundAmount} ${currency}`);

      const failedUser = await storage.getUser(payout.userId).catch(() => null);
      notifyWithdrawalFailed({
        userName: (failedUser as any)?.fullName || (failedUser as any)?.username || "Utilisateur",
        userEmail: (failedUser as any)?.email || "",
        userPhone: (failedUser as any)?.phone || undefined,
        senderCountry: (failedUser as any)?.country || undefined,
        amount: payout.amount,
        grossAmount: payout.totalDebited || payout.amount,
        currency,
        reference: (transaction as any).reference || payout.reference,
        externalReference: (transaction as any).externalReference || undefined,
        reason: apiStatus,
        provider: payout.provider,
        recipientName: transaction.recipientName || undefined,
        recipientPhone: transaction.recipientPhone || undefined,
        recipientCountry: transaction.recipientCountry || undefined,
        txType: payout.txType,   // "transfer_out" → TRANSFERT ÉCHOUÉ
      }).catch(() => {});
    }

    removePendingPayout(payout.reference);
  } catch (err: any) {
    console.error(`[PayoutPoller] Error processing payout ${payout.reference}:`, err.message);
  }
}

async function checkProviderStatus(payout: PendingPayout): Promise<{ status: string; shouldRemove?: boolean }> {
  try {
    if (payout.provider === "afribapay") {
      const result = await checkAfribaPayoutStatus(payout.reference, "order_id");
      return { status: result.status };
    }

    if (payout.provider === "pixpay") {
      const result = await checkPixPayStatus(payout.reference, payout.countryCode);
      return { status: result.status };
    }

    return { status: "pending" };
  } catch (err: any) {
    console.error(`[PayoutPoller] checkProviderStatus error for ${payout.reference}:`, err?.message);
    return { status: "pending" };
  }
}

async function pollPendingPayouts() {
  try {
    const entries = Array.from(pendingPayouts.entries());
    for (const [reference, payout] of entries) {
      try {
        payout.attempts++;

        if (payout.attempts > MAX_ATTEMPTS) {
          // Ne jamais auto-annuler/rembourser sur simple timeout : le fournisseur
          // dit toujours PENDING. On passe en revue manuelle (sans remboursement)
          // et on arrête le polling rapide — seul un statut explicite du
          // fournisseur (via admin/retry) ou une décision manuelle tranchera.
          console.log(`[PayoutPoller] ${reference} toujours PENDING après ${MAX_ATTEMPTS} tentatives — passage en pending_manual (aucun remboursement)`);
          await storage.updateTransactionStatus(payout.transactionId, "pending_manual");
          await storage.createUserNotification({
            userId:        payout.userId,
            type:          payout.txType === "withdrawal" ? "withdrawal_pending" : "transfer_pending",
            title:         payout.txType === "withdrawal" ? "Retrait en attente" : "Transfert en attente",
            message:       JSON.stringify({ amount: payout.amount, currency: payout.txCurrency }),
            transactionId: payout.transactionId,
            isRead:        false,
          }).catch(() => {});
          removePendingPayout(reference);
          continue;
        }

        const { status, shouldRemove } = await checkProviderStatus(payout);

        if (shouldRemove) {
          console.log(`[PayoutPoller] Transaction not found for ${reference} — stopping poll (awaiting admin)`);
          removePendingPayout(reference);
          continue;
        }

        console.log(`[PayoutPoller] ${reference}: status=${status} provider=${payout.provider} (attempt ${payout.attempts}/${MAX_ATTEMPTS})`);

        if (status === "completed" || status === "success") {
          await processPayout(payout, "success");
        } else if (status === "failed" || status === "refunded" || status === "cancelled") {
          await processPayout(payout, status);
        }
      } catch (entryErr: any) {
        console.error(`[PayoutPoller] Unexpected error for ${reference}:`, entryErr?.message);
      }
    }
  } catch (err: any) {
    console.error("[PayoutPoller] Poll loop crashed — recovered:", err?.message);
  }
}

let pollerInterval: NodeJS.Timeout | null = null;

export function startPayoutPoller() {
  if (pollerInterval) { console.log("[PayoutPoller] Already running"); return; }
  console.log("[PayoutPoller] Starting payout poller (every 6 seconds)");
  pollerInterval = setInterval(pollPendingPayouts, POLL_INTERVAL);
}

export function stopPayoutPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[PayoutPoller] Stopped");
  }
}
