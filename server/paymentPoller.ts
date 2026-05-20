import { storage } from "./storage";
import { checkSwychrPaymentStatus } from "./swychr";
import { checkAfribaPayStatus } from "./afribapay";
import { checkPixPayStatus } from "./pixpay";
import { creditUserWallet } from "./walletHelper";
import { sendPayerConfirmationEmail } from "./email";
import { notifyDepositConfirmed, notifyDepositFailed } from "./telegram";

const POLL_INTERVAL = 3000;
const MAX_POLL_DURATION_MS = 7 * 60 * 1000; // 7 minutes — auto-reject if no success/failure received
const MAX_POLL_ATTEMPTS = Math.ceil(MAX_POLL_DURATION_MS / POLL_INTERVAL);

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
}

const pendingPayments = new Map<string, PendingPayment>();

export function addPendingPayment(payment: Omit<PendingPayment, "attempts" | "startedAt">) {
  console.log(`[PaymentPoller] Adding pending payment: ${payment.reference} (provider: ${payment.provider || "swychr"})`);
  pendingPayments.set(payment.reference, { ...payment, attempts: 0, startedAt: Date.now() });
}

export function removePendingPayment(reference: string) {
  pendingPayments.delete(reference);
}

async function checkPaymentStatus(payment: PendingPayment): Promise<"pending" | "completed" | "failed"> {
  try {
    if (payment.provider === "afribapay") {
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
    } else {
      const result = await checkSwychrPaymentStatus(payment.externalReference || payment.reference);
      console.log(`[PaymentPoller] Swychr status for ${payment.reference}:`, result.status, result.rawStatus);
      if (result.success && result.status === "completed") return "completed";
      if (result.success && result.status === "failed") return "failed";
      return "pending";
    }
  } catch (error) {
    console.error(`[PaymentPoller] Error checking payment ${payment.reference}:`, error);
    return "pending";
  }
}

async function processPaymentResult(payment: PendingPayment, status: "completed" | "failed") {
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

    await storage.updateTransactionStatus(transaction.id, status);

    if (status === "completed") {
      const paymentCurrency = transaction.currency || "XAF";
      await creditUserWallet(payment.userId, parseFloat(payment.amount), paymentCurrency);

      const isPaymentLink = payment.type === "payment_link";
      await storage.createUserNotification({
        userId: payment.userId,
        type: isPaymentLink ? "payment_link_received" : "deposit_confirmed",
        title: isPaymentLink ? "payment_link_received" : "deposit_confirmed",
        message: JSON.stringify({ amount: payment.amount, currency: paymentCurrency }),
        transactionId: transaction.id,
        isRead: false,
      });
      console.log(`[PaymentPoller] ✓ Payment COMPLETED for ${payment.reference} (${payment.provider || "swychr"}) → credited ${payment.amount} ${paymentCurrency}`);

      const txUser = await storage.getUser(payment.userId).catch(() => null);
      notifyDepositConfirmed({
        userName: (txUser as any)?.fullName || (txUser as any)?.username || "Utilisateur",
        userEmail: (txUser as any)?.email || "",
        amount: payment.amount,
        currency: paymentCurrency,
        reference: payment.reference,
        provider: payment.provider,
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
            transaction.reference,
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
      console.log(`[PaymentPoller] ✗ Payment FAILED/CANCELLED for ${payment.reference} (${payment.provider || "swychr"})`);

      const txUserFailed = await storage.getUser(payment.userId).catch(() => null);
      notifyDepositFailed({
        userName: (txUserFailed as any)?.fullName || (txUserFailed as any)?.username || "Utilisateur",
        userEmail: (txUserFailed as any)?.email || "",
        amount: payment.amount,
        currency: transaction.currency || "XAF",
        reference: payment.reference,
        provider: payment.provider,
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
      try {
        const payload = {
          event: status === "completed" ? "payment.success" : "payment.failed",
          transaction_id: transaction.id,
          reference: transaction.reference,
          status: status === "completed" ? "success" : "failed",
          source: txSource || "payment_link",
          amount: parseFloat(transaction.totalAmount || transaction.amount),
          credited_amount: parseFloat(transaction.amount),
          fee_amount: parseFloat(transaction.feeAmount || "0"),
          currency: transaction.currency,
          phone: transaction.recipientPhone,
          payment_link_id: transaction.paymentLinkId || null,
          confirmed_at: status === "completed" ? new Date().toISOString() : null,
        };
        const wRes = await fetch(notifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        console.log(`[PaymentPoller] Webhook [${txSource}] → ${notifyUrl} : HTTP ${wRes.status}`);
      } catch (whErr: any) {
        console.error(`[PaymentPoller] Webhook failed for ${payment.reference}:`, whErr.message);
      }
    }

    removePendingPayment(payment.reference);
  } catch (error) {
    console.error(`[PaymentPoller] Error processing payment result ${payment.reference}:`, error);
  }
}

async function pollPendingPayments() {
  const now = Date.now();
  const entries = Array.from(pendingPayments.entries());
  for (const [reference, payment] of entries) {
    payment.attempts++;

    const ageMs = now - payment.startedAt;
    const timedOut = ageMs >= MAX_POLL_DURATION_MS || payment.attempts > MAX_POLL_ATTEMPTS;

    if (timedOut) {
      console.log(`[PaymentPoller] Timeout for ${reference}, marking as failed`);
      await processPaymentResult(payment, "failed");
      continue;
    }

    const status = await checkPaymentStatus(payment);
    if (status === "completed" || status === "failed") {
      await processPaymentResult(payment, status);
    }
  }
}

export async function recoverPendingDeposits() {
  console.log("[PaymentPoller] Recovering pending deposit transactions from DB...");
  try {
    const pendingTxs = await storage.getPendingDepositTransactions();
    const now = Date.now();
    let autoFailed = 0;
    let recovered = 0;

    for (const tx of pendingTxs) {
      const createdAt = tx.createdAt ? new Date(tx.createdAt).getTime() : now;
      const ageMs = now - createdAt;

      if (!tx.reference) continue;

      if (ageMs >= MAX_POLL_DURATION_MS) {
        console.log(`[PaymentPoller] Auto-failing stale transaction: ${tx.reference}`);
        await storage.updateTransactionStatus(tx.id, "failed");
        if (tx.userId) {
          const isPaymentLink = tx.type === "payment_link";
          await storage.createUserNotification({
            userId: tx.userId,
            type: isPaymentLink ? "payment_link_failed" : "deposit_failed",
            title: isPaymentLink ? "payment_link_failed" : "deposit_failed",
            message: "{}",
            transactionId: tx.id,
            isRead: false,
          });
        }
        autoFailed++;
      } else {
        // Detect provider and countryCode from the operator record
        let provider = "swychr";
        let recoveredCountryCode: string | undefined;
        if (tx.operatorId) {
          try {
            const op = await storage.getOperator(tx.operatorId);
            const prov = (op as any)?.paymentProvider;
            if (prov === "afribapay" || prov === "pixpay") provider = prov;
            if (prov === "pixpay" && op?.countryId) {
              try {
                const country = await storage.getCountry(op.countryId);
                if (country?.code) recoveredCountryCode = country.code;
              } catch {}
            }
          } catch {}
        }

        const elapsedAttempts = Math.floor(ageMs / POLL_INTERVAL);
        pendingPayments.set(tx.reference, {
          transactionId: tx.id,
          reference: tx.reference,
          externalReference: tx.externalReference || tx.reference,
          attempts: elapsedAttempts,
          userId: tx.userId,
          type: tx.type,
          amount: tx.amount,
          provider,
          countryCode: recoveredCountryCode,
          paymentIntentId: tx.paymentIntentId,
          startedAt: createdAt,
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

export function startPaymentPoller() {
  if (pollerInterval) { console.log("[PaymentPoller] Already running"); return; }
  console.log(`[PaymentPoller] Starting payment poller (every ${POLL_INTERVAL / 1000}s, timeout: 7min)`);
  pollerInterval = setInterval(pollPendingPayments, POLL_INTERVAL);
}

export function stopPaymentPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[PaymentPoller] Stopped");
  }
}
