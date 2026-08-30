import { storage } from "./storage";
import { checkAfribaPayStatus, checkAfribaPayoutStatus } from "./afribapay";
import { checkPixPayStatus } from "./pixpay";
import { getPawaPayPayout, isPawaPayUuidV4 } from "./pawapay";
import { sendWithdrawalApprovedEmail } from "./email";
import { notifyWithdrawalAutoValidated, notifyWithdrawalFailed } from "./telegram";
import { setFailedCooldown } from "./failedCooldown";

const POLL_INTERVAL  = 6_000; // 6 seconds
// Pas de limite de tentatives : un payout reste suivi indéfiniment jusqu'à ce que
// le fournisseur réponde succès ou échec. Après 30 min, on ralentit simplement la
// cadence (toutes les 2 min) pour ménager les quotas API du fournisseur.
const SLOW_AFTER_ATTEMPTS = 300;  // 300 × 6s = 30 minutes
const SLOW_POLL_EVERY     = 20;   // 20 × 6s = vérification toutes les 2 min

interface PendingPayout {
  transactionId:  string;
  reference:      string;
  userId:         string;
  amount:         string;
  totalDebited:   string;
  attempts:       number;
  provider:       "afribapay" | "pixpay" | "pawapay";
  /** PawaPay UUID; distinct from the internal transaction reference. */
  externalReference?: string;
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
      const configuredProvider = (operator as any)?.paymentProvider as "afribapay" | "pixpay" | "pawapay" | undefined;
      const provider = t.externalReference && isPawaPayUuidV4(t.externalReference) ? "pawapay" : configuredProvider;
      if (provider !== "afribapay" && provider !== "pixpay" && provider !== "pawapay") {
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
        externalReference: (t as any).externalReference || undefined,
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

export async function processPayout(payout: PendingPayout, apiStatus: string) {
  try {
    const transaction = await storage.getTransactionById(payout.transactionId);
    const pawaManual = payout.provider === "pawapay" &&
      !!transaction?.externalReference &&
      isPawaPayUuidV4(transaction.externalReference) &&
      transaction.status === "pending_manual";
    if (!transaction || (transaction.status !== "pending" && transaction.status !== "processing" && !pawaManual)) {
      removePendingPayout(payout.reference);
      return;
    }

    const currency = transaction.currency || "XAF";

    if (apiStatus === "success") {
      const claimed = await storage.claimTransactionStatus(payout.transactionId, "completed", ["pending", "processing", "pending_manual"]);
      if (!claimed) {
        removePendingPayout(payout.reference);
        return;
      }

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
      const claimed = payout.provider === "pawapay"
        ? await storage.claimPawaPayoutFailedAndRefund(payout.transactionId, ["pending", "processing", "pending_manual"])
        : await storage.claimTransactionStatus(payout.transactionId, "failed", ["pending", "processing", "pending_manual"]);
      if (!claimed) {
        removePendingPayout(payout.reference);
        return;
      }
      // Déclenche le cooldown 5min — l'utilisateur doit attendre avant de relancer
      setFailedCooldown(payout.userId);
      const refundAmount = parseFloat(payout.totalDebited || payout.amount);
      // Use walletCurrency (the key actually debited) when available; fall back to txCurrency.
      // walletCurrency may differ from txCurrency when the wallet was stored under a generic code
      // (e.g. "XOF") while the provider needed a country-specific variant (e.g. "XOFB").
      if (payout.provider !== "pawapay") {
        await storage.refundToOriginalWallet(payout.userId, payout.txType, payout.walletCurrency || payout.txCurrency, refundAmount);
      }
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

/** Complete a PawaPay callback using the idempotent payout settlement path. */
export async function processPawaPayPayoutCallback(
  transaction: { id: string; reference: string | null; externalReference: string | null; userId: string; amount: string; totalAmount?: string | null; type: string; currency?: string | null },
  status: "success" | "failed",
): Promise<void> {
  if (!transaction.reference || !transaction.externalReference) return;
  await processPayout({
    transactionId: transaction.id,
    reference: transaction.externalReference,
    externalReference: transaction.externalReference,
    userId: transaction.userId,
    amount: transaction.amount,
    totalDebited: transaction.totalAmount || transaction.amount,
    attempts: 0,
    provider: "pawapay",
    countryCode: (transaction as any).recipientCountry || "CM",
    txType: transaction.type,
    txCurrency: transaction.currency || "XAF",
  }, status);
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
    if (payout.provider === "pawapay") {
      // A timeout or not-found is intentionally pending/manual, never refunded.
      const id = payout.externalReference || payout.reference;
      const result = await getPawaPayPayout(id);
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

        // Suivi infini : aucune limite de tentatives. Après 30 min, on ralentit
        // simplement la cadence à une vérification toutes les 2 min.
        if (payout.attempts > SLOW_AFTER_ATTEMPTS && payout.attempts % SLOW_POLL_EVERY !== 0) {
          continue;
        }

        const { status, shouldRemove } = await checkProviderStatus(payout);

        if (shouldRemove) {
          console.log(`[PayoutPoller] Transaction not found for ${reference} — stopping poll (awaiting admin)`);
          removePendingPayout(reference);
          continue;
        }

        console.log(`[PayoutPoller] ${reference}: status=${status} provider=${payout.provider} (attempt ${payout.attempts}${payout.attempts > SLOW_AFTER_ATTEMPTS ? ", slow-poll 2min" : ""})`);

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
