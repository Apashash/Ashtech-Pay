import { storage } from "./storage";
import { checkAfribaPayStatus, checkAfribaPayoutStatus, isAfribaPayConfigured } from "./afribapay";
import { checkPixPayStatus } from "./pixpay";
import { getPawaPayPayout, isPawaPayUuidV4 } from "./pawapay";
import { getIziPayout, isIziPayConfigured } from "./izichange";
import { getIziPayoutIdForPolling } from "./cryptoPayout";
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
  provider:       "afribapay" | "pixpay" | "pawapay" | "izichange";
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

function providerResponseIndicatesNotFound(raw: unknown): boolean {
  if (!raw) return false;
  const serialized = typeof raw === "string" ? raw : JSON.stringify(raw);
  return /\bnot[_ -]?found\b|\bintrouvable\b|\bdoes not exist\b|\bno (?:such|matching) (?:transaction|payout)\b/i.test(serialized)
    || /"(?:status|status_code|statut_code|providerStatus)"\s*:\s*"?404"?/i.test(serialized);
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
      const metadata = ((t as any).metadata || {}) as Record<string, any>;
      const configuredProvider = (
        metadata.pendingPayoutProvider || (operator as any)?.paymentProvider
      ) as "afribapay" | "pixpay" | "pawapay" | undefined;
      const provider = metadata.paymentProvider === "izichange"
        ? "izichange"
        : t.externalReference && isPawaPayUuidV4(t.externalReference) ? "pawapay" : configuredProvider;
      if (provider !== "afribapay" && provider !== "pixpay" && provider !== "pawapay" && provider !== "izichange") {
        console.warn(`[PayoutPoller] Skipping pending payout ${internalRef}: no supported provider`);
        continue;
      }
      const iziPayoutId = provider === "izichange"
        ? getIziPayoutIdForPolling(t.externalReference, metadata)
        : undefined;
      if (provider === "izichange" && !iziPayoutId) {
        if (
          t.status !== "pending_manual" ||
          metadata.iziRetrySafe === true ||
          !metadata.iziInitiationError
        ) {
          await storage.updateTransaction(t.id, {
            status: "pending_manual",
            metadata: {
              ...metadata,
              iziRetrySafe: false,
              iziInitiationError: metadata.iziInitiationError || "missing_provider_payout_id_manual_review",
            },
          } as any);
        }
        console.warn(`[PayoutPoller] IziChange payout ${internalRef} has no provider ID; awaiting webhook/manual review without resubmitting`);
        continue;
      }
      const countryCode = (t as any).recipientCountry || "CM";

      let pollerRef = provider === "izichange" ? internalRef : (t as any).externalReference || internalRef;
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
        externalReference: provider === "izichange"
          ? iziPayoutId
          : (t as any).externalReference || metadata.iziPayoutId || undefined,
        countryCode,
        txType:        t.type,
        txCurrency:    t.currency || "XAF",
        walletCurrency: ((t as any).metadata || {}).walletCurrency || t.currency || "XAF",
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
    const iziManual = payout.provider === "izichange" &&
      transaction?.status === "pending_manual" &&
      (transaction as any)?.metadata?.paymentProvider === "izichange";
    const afribaManual = payout.provider === "afribapay" &&
      transaction?.status === "pending_manual";
    if (!transaction || (transaction.status !== "pending" && transaction.status !== "processing" && !pawaManual && !iziManual && !afribaManual)) {
      removePendingPayout(payout.reference);
      return;
    }

    const currency = transaction.currency || "XAF";
    const walletCurrency = payout.walletCurrency || ((transaction as any).metadata || {}).walletCurrency || currency;

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
         walletCurrency,
        recipientName: transaction.recipientName || undefined,
        recipientPhone: transaction.recipientPhone || undefined,
        recipientCountry: transaction.recipientCountry || undefined,
        txType: payout.txType,   // "transfer_out" → TRANSFERT CONFIRMÉ
      }).catch(() => {});

    } else {
      // These are definitive terminal provider statuses. Reject the payout
      // and restore the debited amount; ambiguous initiation errors are
      // handled separately as pending_manual by the route.
      const afribaManualRefund = payout.provider === "afribapay" && transaction.status === "pending_manual";
      const claimed = payout.provider === "pawapay"
        ? await storage.claimPawaPayoutFailedAndRefund(payout.transactionId, ["pending", "processing", "pending_manual"])
        : payout.provider === "izichange"
          ? await storage.claimIziPayPayoutFailedAndRefund(payout.transactionId, ["pending", "processing", "pending_manual"])
          : afribaManualRefund
            ? await storage.refundPendingManualPayout(payout.transactionId)
            : await storage.claimTransactionStatus(payout.transactionId, "failed", ["pending", "processing", "pending_manual"]);
      if (!claimed) {
        removePendingPayout(payout.reference);
        return;
      }
      setFailedCooldown(payout.userId);
      const refundAmount = parseFloat(payout.totalDebited || payout.amount);
      if (payout.provider !== "pawapay" && payout.provider !== "izichange" && !afribaManualRefund) {
        await storage.refundToOriginalWallet(payout.userId, payout.txType, payout.walletCurrency || payout.txCurrency, refundAmount);
      }
      await storage.createUserNotification({
        userId:        payout.userId,
        type:          "withdrawal_failed",
        title:         "Retrait rejeté",
        message:       `Votre retrait de ${payout.amount} ${currency} a été rejeté. Le montant a été recrédité.`,
        transactionId: payout.transactionId,
        isRead:        false,
      });
      console.log(`[PayoutPoller] ❌ Payout rejected (${apiStatus}): ${payout.reference} — refunded ${refundAmount} ${currency}`);

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
        walletCurrency,
        recipientName: transaction.recipientName || undefined,
        recipientPhone: transaction.recipientPhone || undefined,
        recipientCountry: transaction.recipientCountry || undefined,
        txType: payout.txType,
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
    walletCurrency: ((transaction as any).metadata || {}).walletCurrency || transaction.currency || "XAF",
  }, status);
}

/** Complete a signed IziChange payout webhook through the idempotent settlement path. */
export async function processIziPayPayoutCallback(
  transaction: { id: string; reference: string | null; externalReference: string | null; userId: string; amount: string; totalAmount?: string | null; type: string; currency?: string | null; recipientCountry?: string | null; metadata?: unknown },
  status: "success" | "failed",
  payoutId?: string,
): Promise<void> {
  const metadata = (transaction.metadata || {}) as Record<string, any>;
  if (metadata.paymentProvider !== "izichange") return;
  if (payoutId && transaction.externalReference && transaction.externalReference !== payoutId) {
    console.warn(`[PayoutPoller] Ignoring mismatched IziChange payout ID for ${transaction.reference || transaction.id}`);
    return;
  }
  await processPayout({
    transactionId: transaction.id,
    reference: transaction.reference || payoutId || transaction.id,
    externalReference: payoutId || transaction.externalReference || undefined,
    userId: transaction.userId,
    amount: transaction.amount,
    totalDebited: transaction.totalAmount || transaction.amount,
    attempts: 0,
    provider: "izichange",
    countryCode: transaction.recipientCountry || "CM",
    txType: transaction.type,
    txCurrency: transaction.currency || "USDT",
    walletCurrency: metadata.walletCurrency || "USDT",
  }, status);
}

async function checkProviderStatus(payout: PendingPayout): Promise<{ status: string; shouldRemove?: boolean }> {
  try {
    if (payout.provider === "afribapay") {
      // Missing credentials are a configuration state, not a provider failure.
      // Leave the payout pending without generating repeated failed requests.
      if (!isAfribaPayConfigured()) return { status: "pending" };
      const result = await checkAfribaPayoutStatus(payout.reference, "order_id");
      if (providerResponseIndicatesNotFound(result.raw)) return { status: "failed" };
      return { status: result.status };
    }

    if (payout.provider === "pixpay") {
      const result = await checkPixPayStatus(payout.reference, payout.countryCode);
      if (providerResponseIndicatesNotFound(result.raw)) return { status: "failed" };
      return { status: result.status };
    }
    if (payout.provider === "pawapay") {
      const id = payout.externalReference || payout.reference;
      const result = await getPawaPayPayout(id);
      if (providerResponseIndicatesNotFound(result.raw)) return { status: "failed" };
      return { status: result.status };
    }

    if (payout.provider === "izichange") {
      if (!isIziPayConfigured()) return { status: "pending" };
      // Never replay a payout POST from the poller. Without a provider ID,
      // the original request may have succeeded while its response was lost.
      if (!payout.externalReference) return { status: "pending" };
      const result = await getIziPayout(payout.externalReference);

      const status = String(result.status || "").toLowerCase();
      if (status === "confirmed") return { status: "success" };
      if (status === "failed" || status === "refunded" || status === "cancelled") return { status: "failed" };
      return { status: "pending" };
    }

    return { status: "pending" };
  } catch (err: any) {
    console.error(`[PayoutPoller] checkProviderStatus error for ${payout.reference}:`, err?.message);
    if (Number(err?.status) === 404 || providerResponseIndicatesNotFound(err?.message)) return { status: "failed" };
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

        const { status } = await checkProviderStatus(payout);

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
