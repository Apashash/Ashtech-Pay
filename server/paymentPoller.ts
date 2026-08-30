import { storage } from "./storage";
import { checkAfribaPayStatus, isAfribaPayCircuitOpen } from "./afribapay";
import { checkPixPayStatus } from "./pixpay";
import { getPawaPayDeposit, isPawaPayUuidV4 } from "./pawapay";
import { creditUserWallet } from "./walletHelper";
import { sendPayerConfirmationEmail } from "./email";
import { notifyDepositConfirmed, notifyDepositFailed } from "./telegram";
import { enqueueMerchantWebhook } from "./merchantWebhook";

// Status endpoints are rate-limited by providers. A 10s base loop plus a
// provider-specific AfribaPay cadence avoids repeatedly asking for the same
// transaction while keeping webhook-less payments reasonably responsive.
const POLL_INTERVAL = 10 * 1000;
const AFRIBAPAY_STATUS_INTERVAL_MS = 30 * 1000;
const CRYPTO_PENDING_TIMEOUT_MS = 15 * 60 * 1000;
const CRYPTO_EXPIRY_CHECK_INTERVAL_MS = 30 * 1000;
// After 30 min, slow down polling to every 2 min to avoid hammering the gateway API.
const SLOW_POLL_THRESHOLD_MS = 30 * 60 * 1000;  // 30 minutes
const SLOW_POLL_INTERVAL_MS  = 2 * 60 * 1000;   // 2 minutes between checks for old payments

interface PendingPayment {
  transactionId: string;
  reference: string;
  externalReference: string;
  attempts: number;
  userId: string;
  type: string;
  amount: string;
  provider?: string;
  paymentIntentId?: string | null;
  payerName?: string | null;
  countryCode?: string; // used for PixPay API key selection
  startedAt: number;
  lastCheckedAt: number; // used for slow-poll throttling
}

const pendingPayments = new Map<string, PendingPayment>();
const cryptoExpiryInFlight = new Set<string>();

export function addPendingPayment(
  payment: Omit<PendingPayment, "attempts" | "startedAt" | "lastCheckedAt"> &
    Partial<Pick<PendingPayment, "attempts">>,
) {
  console.log(`[PaymentPoller] Adding pending payment: ${payment.reference} (provider: ${payment.provider || "unknown"})`);
  const now = Date.now();
  pendingPayments.set(payment.reference, { ...payment, attempts: payment.attempts ?? 0, startedAt: now, lastCheckedAt: 0 });
}

export function removePendingPayment(reference: string) {
  pendingPayments.delete(reference);
}

/**
 * Expire one crypto transaction on demand.
 *
 * This is also used by the public status endpoint so an API client that polls
 * without configuring notify_url receives `failed` immediately after 15 min,
 * even if the background poller has not run its next cycle yet.
 */
export async function expireCryptoPaymentIfNeeded(
  reference: string,
  now = Date.now(),
): Promise<boolean> {
  if (cryptoExpiryInFlight.has(reference)) return false;

  const transaction = await storage.getTransactionByReference(reference);
  if (
    !transaction ||
    transaction.status !== "pending" ||
    transaction.paymentMethod !== "crypto"
  ) {
    return false;
  }

  const createdAt = transaction.createdAt ? new Date(transaction.createdAt).getTime() : now;
  if (now - createdAt < CRYPTO_PENDING_TIMEOUT_MS) return false;

  cryptoExpiryInFlight.add(reference);
  try {
    const payment: PendingPayment = {
      transactionId: transaction.id,
      reference: transaction.reference || reference,
      externalReference: transaction.externalReference || transaction.reference || reference,
      attempts: 0,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount,
      provider: "izichange",
      paymentIntentId: transaction.paymentIntentId,
      payerName: transaction.payerName,
      startedAt: createdAt,
      lastCheckedAt: 0,
    };
    console.log(`[PaymentPoller] Auto-failing crypto payment after 15 minutes: ${payment.reference}`);
    await processPaymentResult(payment, "failed");
    return true;
  } finally {
    cryptoExpiryInFlight.delete(reference);
  }
}

async function checkPaymentStatus(payment: PendingPayment): Promise<"pending" | "completed" | "failed"> {
  try {
    if (payment.provider === "afribapay") {
      // If AfribaPay circuit is open (subscription invalid), don't make any HTTP calls.
      // Return "pending" — the normal timeout logic will auto-fail the transaction after 7 min.
      if (isAfribaPayCircuitOpen()) return "pending";
      // Always query by order_id = our ASHPAY-DEP-... reference (what we sent to AfribaPay as order_id).
      // externalReference = AfribaPay's transaction_id (PIM...) — do NOT use it for status query.
      const result = await checkAfribaPayStatus(payment.reference, "order_id");
      console.log(`[PaymentPoller] AfribaPay status for ${payment.reference}: ${result.status}`, result.raw?.data?.status || "");
      return result.status;
    } else if (payment.provider === "pixpay") {
      const result = await checkPixPayStatus(
        payment.externalReference || payment.reference,
        payment.countryCode || "CM"
      );
      console.log(`[PaymentPoller] PixPay status for ${payment.reference}: ${result.status}`);
      return result.status;
    } else if (payment.provider === "pawapay") {
      // PawaPay's UUID is persisted as externalReference; never query using
      // our merchant-facing reference.
      const result = await getPawaPayDeposit(payment.externalReference);
      console.log(`[PaymentPoller] PawaPay status for ${payment.reference}: ${result.status}`);
      return result.status;
    } else {
      console.error(`[PaymentPoller] Unsupported payment provider for ${payment.reference}`);
      return "failed";
    }
  } catch (error: any) {
    // Log only the message (not the full stack trace) to avoid log flooding
    const msg = error?.message || String(error);
    const isCircuitMsg = msg.includes("circuit open") || msg.includes("Circuit open");
    if (!isCircuitMsg) {
      console.error(`[PaymentPoller] Error checking ${payment.reference}: ${msg}`);
    }
    return "pending";
  }
}

export async function processPaymentResult(payment: PendingPayment, status: "completed" | "failed") {
  try {
    const transaction = await storage.getTransactionByReference(payment.reference);
    if (!transaction) {
      console.error(`[PaymentPoller] Transaction not found: ${payment.reference}`);
      removePendingPayment(payment.reference);
      return;
    }

    if (transaction.status !== "pending") {
      console.log(`[PaymentPoller] Transaction already processed: ${payment.reference}`);
      removePendingPayment(payment.reference);
      return;
    }

    const claimedTransaction = status === "completed" && payment.provider === "pawapay"
      ? await storage.claimPawaIncomingAndCredit(transaction.id, ["pending"])
      : await storage.claimTransactionStatus(transaction.id, status);
    if (!claimedTransaction) {
      console.log(`[PaymentPoller] Transaction already claimed: ${payment.reference}`);
      removePendingPayment(payment.reference);
      return;
    }

    if (status === "completed") {
      const paymentCurrency = transaction.currency || "XAF";
      if (payment.provider !== "pawapay") {
        await creditUserWallet(payment.userId, parseFloat(payment.amount), paymentCurrency);
      }

      const isPaymentLink = payment.type === "payment_link";
      await storage.createUserNotification({
        userId: payment.userId,
        type: isPaymentLink ? "payment_link_received" : "deposit_confirmed",
        title: isPaymentLink ? "payment_link_received" : "deposit_confirmed",
        message: JSON.stringify({ amount: payment.amount, currency: paymentCurrency }),
        transactionId: transaction.id,
        isRead: false,
      });
      console.log(`[PaymentPoller] ✓ Payment COMPLETED for ${payment.reference} (${payment.provider || "unknown"}) → credited ${payment.amount} ${paymentCurrency}`);

      const isLink = payment.type === "payment_link";
      const feeMetadata = ((transaction as any).metadata || {}) as Record<string, any>;
      const walletCurrency = feeMetadata.walletCurrency || paymentCurrency;
      const depositCountry = feeMetadata.countryCode || feeMetadata.pawaCountry || (transaction as any).recipientCountry || undefined;
      const [txUser, txOperator, txIntent, txPaymentLink] = await Promise.all([
        storage.getUser(payment.userId).catch(() => null),
        transaction.operatorId ? storage.getOperator(transaction.operatorId).catch(() => null) : Promise.resolve(null),
        transaction.paymentIntentId ? storage.getPaymentIntentById(transaction.paymentIntentId).catch(() => null) : Promise.resolve(null),
        isLink && transaction.paymentLinkId ? storage.getPaymentLinkById(transaction.paymentLinkId).catch(() => null) : Promise.resolve(null),
      ]);
      notifyDepositConfirmed({
        userName: (txUser as any)?.fullName || (txUser as any)?.username || "Utilisateur",
        userEmail: (txUser as any)?.email || "",
        userPhone: (txUser as any)?.phone || undefined,
        userCountry: (txUser as any)?.country || undefined,
        amount: payment.amount,
        grossAmount: (payment as any).totalAmount || payment.amount,
        currency: paymentCurrency,
        reference: payment.reference,
        provider: payment.provider,
        country: depositCountry,
        depositType: payment.type,
        paymentMethod: transaction.paymentMethod || undefined,
        phone: transaction.recipientPhone || undefined,
        operator: (txOperator as any)?.name || undefined,
        source: (transaction as any).source || undefined,
        providerFeeAmount: feeMetadata.providerFeeAmountUsdt,
        providerFeePercent: feeMetadata.providerFeePercent,
        ashtechFeeAmount: (transaction as any).ashtechFeeAmount || feeMetadata.ashtechFeeAmountUsdt,
        ashtechFeePercent: feeMetadata.ashtechFeePercent,
        totalFeeAmount: transaction.feeAmount || feeMetadata.totalFeeAmountUsdt,
        totalFeePercent: feeMetadata.totalFeePercent,
        ...(isLink && {
          payerName: transaction.payerName || undefined,
          payerEmail: transaction.payerEmail || undefined,
          payerPhone: (txIntent as any)?.payerPhone || undefined,
          beneficiaryUsername: (txUser as any)?.username || undefined,
          beneficiaryPhone: (txUser as any)?.phone || undefined,
          creditedCurrency: walletCurrency,
          walletCurrency,
          linkTitle: (txPaymentLink as any)?.title || undefined,
        }),
      }).catch(() => {});

      if (payment.paymentIntentId) {
        await storage.updatePaymentIntentStatus(payment.paymentIntentId, "completed");
      }

      if (isPaymentLink && transaction.payerEmail && transaction.paymentLinkId) {
        try {
          const paymentLink = await storage.getPaymentLinkById(transaction.paymentLinkId);
          const pdfUrl = (paymentLink?.hasPdfDelivery && paymentLink?.pdfPath) ? paymentLink.pdfPath : null;
          await sendPayerConfirmationEmail(
            transaction.payerEmail,
            transaction.payerName || "Client",
            paymentLink?.title || "Lien de paiement",
            parseFloat(transaction.amount).toFixed(2),
            transaction.currency || "XAF",
            transaction.reference || transaction.id,
            pdfUrl,
          );
        } catch (emailErr: any) {
          console.error("[PaymentPoller] Failed to send payer email:", emailErr.message);
        }
      }
    } else {
      const isPaymentLink = payment.type === "payment_link";
      await storage.createUserNotification({
        userId: payment.userId,
        type: isPaymentLink ? "payment_link_failed" : "deposit_failed",
        title: isPaymentLink ? "payment_link_failed" : "deposit_failed",
        message: "{}",
        transactionId: transaction.id,
        isRead: false,
      });
      if (payment.paymentIntentId) {
        await storage.updatePaymentIntentStatus(payment.paymentIntentId, "failed");
      }
      console.log(`[PaymentPoller] ✗ Payment FAILED/CANCELLED for ${payment.reference} (${payment.provider || "unknown"})`);

      const [txUserFailed, txOperatorFailed] = await Promise.all([
        storage.getUser(payment.userId).catch(() => null),
        transaction.operatorId ? storage.getOperator(transaction.operatorId).catch(() => null) : Promise.resolve(null),
      ]);
      const failedMetadata = ((transaction as any).metadata || {}) as Record<string, any>;
      notifyDepositFailed({
        userName: (txUserFailed as any)?.fullName || (txUserFailed as any)?.username || "Utilisateur",
        userEmail: (txUserFailed as any)?.email || "",
        userPhone: (txUserFailed as any)?.phone || undefined,
        userCountry: (txUserFailed as any)?.country || undefined,
        amount: payment.amount,
        currency: transaction.currency || "XAF",
        reference: payment.reference,
        provider: payment.provider,
        country: failedMetadata.countryCode || failedMetadata.pawaCountry || (transaction as any).recipientCountry || undefined,
        walletCurrency: failedMetadata.walletCurrency || transaction.currency || "XAF",
        depositType: payment.type,
        paymentMethod: transaction.paymentMethod || undefined,
        phone: transaction.recipientPhone || undefined,
        operator: (txOperatorFailed as any)?.name || undefined,
        source: (transaction as any).source || undefined,
      }).catch(() => {});
    }

    // ── Merchant webhook notification (SDK + Hosted Page) ────────────────────
    let notifyUrl: string | null = (transaction as any).notifyUrl || null;
    const txSource = (transaction as any).source;

    // For Hosted Page (payment_link type), look up notify_url from the payment link
    if (!notifyUrl && transaction.paymentLinkId) {
      try {
        const link = await storage.getPaymentLinkById(transaction.paymentLinkId);
        notifyUrl = (link as any)?.notifyUrl || null;
      } catch (_) {}
    }

    if (notifyUrl && (txSource === "api" || txSource === "hosted_page" || transaction.paymentLinkId)) {
      await enqueueMerchantWebhook(transaction, status, notifyUrl).catch((webhookError: any) => {
        console.error(`[PaymentPoller] Webhook enqueue failed for ${payment.reference}:`, webhookError?.message || webhookError);
      });
    }

    removePendingPayment(payment.reference);
  } catch (error) {
    console.error(`[PaymentPoller] Error processing payment result ${payment.reference}:`, error);
  }
}

/** Complete a PawaPay callback through the exact same idempotent wallet path as polling. */
export async function processPawaPayDepositCallback(
  transaction: { id: string; reference: string | null; externalReference: string | null; userId: string; type: string; amount: string; paymentIntentId?: string | null; payerName?: string | null },
  status: "completed" | "failed",
): Promise<void> {
  if (!transaction.reference || !transaction.externalReference) return;
  await processPaymentResult({
    transactionId: transaction.id,
    reference: transaction.reference,
    externalReference: transaction.externalReference,
    attempts: 0,
    userId: transaction.userId,
    type: transaction.type,
    amount: transaction.amount,
    provider: "pawapay",
    paymentIntentId: transaction.paymentIntentId,
    payerName: transaction.payerName,
    startedAt: Date.now(),
    lastCheckedAt: 0,
  }, status);
}

async function pollPendingPayments() {
  try {
    const now = Date.now();
    if (now - lastCryptoExpiryCheckAt >= CRYPTO_EXPIRY_CHECK_INTERVAL_MS) {
      lastCryptoExpiryCheckAt = now;
      await expirePendingCryptoPayments(now);
    }
    const entries = Array.from(pendingPayments.entries());
    for (const [reference, payment] of entries) {
      try {
        const ageMs = now - payment.startedAt;
        const isOld = ageMs >= SLOW_POLL_THRESHOLD_MS;

        // Slow-poll throttle: once a payment is older than 30 min, only check
        // every 2 minutes instead of every 3 seconds to avoid spamming the gateway.
        const minimumInterval = payment.provider === "afribapay"
          ? AFRIBAPAY_STATUS_INTERVAL_MS
          : 0;
        if (minimumInterval > 0 && payment.lastCheckedAt > 0 &&
            now - payment.lastCheckedAt < minimumInterval) {
          continue;
        }
        if (isOld) {
          const timeSinceLastCheck = now - payment.lastCheckedAt;
          if (payment.lastCheckedAt > 0 && timeSinceLastCheck < SLOW_POLL_INTERVAL_MS) {
            continue; // skip this cycle — not yet time to check
          }
        }

        payment.attempts++;
        payment.lastCheckedAt = now;

        const status = await checkPaymentStatus(payment);
        if (status === "completed" || status === "failed") {
          await processPaymentResult(payment, status);
        }
        // "pending" → keep in queue, poll again next cycle (no timeout, no auto-cancel)
      } catch (entryErr: any) {
        console.error(`[PaymentPoller] Unexpected error for ${reference}:`, entryErr?.message);
      }
    }
  } catch (err: any) {
    console.error("[PaymentPoller] Poll loop crashed — recovered:", err?.message);
  }
}

export async function recoverPendingDeposits() {
  console.log("[PaymentPoller] Recovering pending deposit transactions from DB...");
  try {
    const now = Date.now();
    // Expire old crypto transactions before recovery so they cannot be
    // re-queued after a restart. Recent crypto transactions are completed by
    // the provider webhook, not by the Mobile Money poller.
    await expirePendingCryptoPayments(now);
    const pendingTxs = await storage.getPendingDepositTransactions();
    let autoFailed = 0;
    let recovered = 0;

    // Pre-check AfribaPay availability once — if auth fails, skip ALL AfribaPay
    // transactions (mark failed immediately) rather than queuing them into the poller
    // where they'd cause log flooding every 3 seconds.
    let afribaPayBroken = false;
    const hasAfribaTxs = pendingTxs.some((tx: any) => {
      // We'll detect provider below, but do a quick check by peeking operator later
      return true; // resolve fully in loop
    });
    if (hasAfribaTxs) {
      try {
        const { getAfribaPayToken } = await import("./afribapay");
        await getAfribaPayToken();
      } catch {
        afribaPayBroken = isAfribaPayCircuitOpen();
      }
    }

    for (const tx of pendingTxs) {
      const createdAt = tx.createdAt ? new Date(tx.createdAt).getTime() : now;
      const ageMs = now - createdAt;

      if (!tx.reference) continue;
      if (tx.paymentMethod === "crypto") {
        console.log(`[PaymentPoller] Leaving crypto transaction on webhook path: ${tx.reference}`);
        continue;
      }

      // Detect provider early so we can auto-fail broken-provider transactions
      let txProvider: "afribapay" | "pixpay" | "pawapay" | null =
        tx.externalReference && isPawaPayUuidV4(tx.externalReference) ? "pawapay" : null;
      if (!txProvider && tx.operatorId) {
        try {
          const op = await storage.getOperator(tx.operatorId);
          const prov = (op as any)?.depositPaymentProvider || (op as any)?.paymentProvider;
          if (prov === "afribapay" || prov === "pixpay" || prov === "pawapay") txProvider = prov;
        } catch {}
      }

      // Only auto-fail if AfribaPay subscription is broken (service down, not a timeout).
      // Age-based auto-cancel has been removed — transactions stay pending until
      // the gateway explicitly returns completed or failed.
      const isPayoutTx = tx.type === "withdrawal" || tx.type === "transfer_out";

      if (!txProvider) {
        if (isPayoutTx) {
          // Payout déjà débité : ne jamais auto-annuler — passer en revue manuelle.
          console.warn(`[PaymentPoller] No supported provider for pending payout ${tx.reference}; marking pending_manual`);
          await storage.updateTransactionStatus(tx.id, "pending_manual");
        } else {
          console.warn(`[PaymentPoller] No supported provider for pending transaction ${tx.reference}; marking failed`);
          await storage.updateTransactionStatus(tx.id, "failed");
          autoFailed++;
        }
        continue;
      }

      const isAfribaPayBroken = txProvider === "afribapay" && afribaPayBroken;

      if (isAfribaPayBroken) {
        // Indisponibilité du fournisseur ≠ échec du paiement : on laisse la
        // transaction en attente (sans la mettre en file, pour éviter le flood
        // de logs) — elle sera reprise au prochain démarrage/cycle de recovery.
        console.warn(`[PaymentPoller] AfribaPay indisponible — ${tx.reference} laissé en attente (non requeué)`);
        continue;
      }

      {
        // Re-queue all pending transactions regardless of age — no timeout.
        // Old transactions use slow-poll (every 2 min) automatically.
        let recoveredCountryCode: string | undefined;
        if (txProvider === "pixpay" && tx.operatorId) {
          try {
            const op = await storage.getOperator(tx.operatorId);
            if (op?.countryId) {
              const country = await storage.getCountry(op.countryId);
              if (country?.code) recoveredCountryCode = country.code;
            }
          } catch {}
        }

        pendingPayments.set(tx.reference, {
          transactionId: tx.id,
          reference: tx.reference,
          externalReference: tx.externalReference || tx.reference,
          attempts: 0,
          userId: tx.userId,
          type: tx.type,
          amount: tx.amount,
          provider: txProvider,
          countryCode: recoveredCountryCode,
          paymentIntentId: tx.paymentIntentId,
          startedAt: createdAt,
          lastCheckedAt: 0,
        });
        recovered++;
      }
    }

    console.log(`[PaymentPoller] Recovery done — auto-failed: ${autoFailed}, re-queued: ${recovered}`);
  } catch (error) {
    console.error("[PaymentPoller] Recovery error:", error);
  }
}

let pollerInterval: NodeJS.Timeout | null = null;
let lastCryptoExpiryCheckAt = 0;
let cryptoExpiryCheckInProgress = false;

async function expirePendingCryptoPayments(now: number): Promise<void> {
  if (cryptoExpiryCheckInProgress) return;
  cryptoExpiryCheckInProgress = true;
  try {
    const pendingCryptoTransactions = await storage.getPendingCryptoTransactions();
    for (const transaction of pendingCryptoTransactions) {
      if (transaction.reference) {
        await expireCryptoPaymentIfNeeded(transaction.reference, now);
      }
    }
  } catch (error: any) {
    console.error("[PaymentPoller] Crypto expiry check failed:", error?.message);
  } finally {
    cryptoExpiryCheckInProgress = false;
  }
}

export function startPaymentPoller() {
  if (pollerInterval) { console.log("[PaymentPoller] Already running"); return; }
  console.log(`[PaymentPoller] Starting payment poller (every ${POLL_INTERVAL / 1000}s, AfribaPay status every ${AFRIBAPAY_STATUS_INTERVAL_MS / 1000}s, crypto timeout ${CRYPTO_PENDING_TIMEOUT_MS / 60000}min, slow-poll after ${SLOW_POLL_THRESHOLD_MS / 60000}min)`);
  pollerInterval = setInterval(pollPendingPayments, POLL_INTERVAL);
}

export function stopPaymentPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[PaymentPoller] Stopped");
  }
}
