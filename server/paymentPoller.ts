import { storage } from "./storage";
import { verifyPayment } from "./soleaspay";

const POLL_INTERVAL = 5000;
const MAX_POLL_ATTEMPTS = 60;

interface PendingPayment {
  transactionId: string;
  reference: string;
  externalReference: string;
  attempts: number;
  userId: string;
  type: string;
  amount: string;
  paymentIntentId?: string | null;
  payerName?: string | null;
}

const pendingPayments = new Map<string, PendingPayment>();

export function addPendingPayment(payment: PendingPayment) {
  console.log(`[PaymentPoller] Adding pending payment: ${payment.reference}`);
  pendingPayments.set(payment.reference, { ...payment, attempts: 0 });
}

export function removePendingPayment(reference: string) {
  console.log(`[PaymentPoller] Removing pending payment: ${reference}`);
  pendingPayments.delete(reference);
}

async function checkPaymentStatus(payment: PendingPayment): Promise<"pending" | "completed" | "failed"> {
  try {
    const result = await verifyPayment(payment.reference, payment.externalReference);
    
    console.log(`[PaymentPoller] Verification result for ${payment.reference}:`, {
      success: result.success,
      status: result.status,
      message: result.message
    });

    if (result.success && result.status === "SUCCESS") {
      return "completed";
    } else if (result.status === "FAILURE" || result.status === "REFUND") {
      return "failed";
    }
    
    return "pending";
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
      return;
    }

    if (transaction.status !== "pending") {
      console.log(`[PaymentPoller] Transaction already processed: ${payment.reference}`);
      removePendingPayment(payment.reference);
      return;
    }

    await storage.updateTransactionStatus(transaction.id, status);

    if (status === "completed") {
      const user = await storage.getUser(payment.userId);
      if (user) {
        const newBalance = parseFloat(user.balance) + parseFloat(payment.amount);
        await storage.updateUserBalance(payment.userId, newBalance);

        const isPaymentLink = payment.type === "payment_link";
        await storage.createUserNotification({
          userId: payment.userId,
          type: isPaymentLink ? "payment_link_received" : "deposit_confirmed",
          title: isPaymentLink ? "Paiement reçu" : "Dépôt confirmé",
          message: isPaymentLink
            ? `Vous avez reçu un paiement de ${payment.amount} XAF de ${payment.payerName || "un client"}.`
            : `Votre dépôt de ${payment.amount} XAF a été crédité sur votre compte.`,
          transactionId: transaction.id,
        });

        console.log(`[PaymentPoller] Payment completed and balance updated for ${payment.reference}`);
      }

      if (payment.paymentIntentId) {
        await storage.updatePaymentIntentStatus(payment.paymentIntentId, "completed");
      }
    } else {
      const isPaymentLink = payment.type === "payment_link";
      await storage.createUserNotification({
        userId: payment.userId,
        type: isPaymentLink ? "payment_link_failed" : "deposit_failed",
        title: isPaymentLink ? "Paiement échoué" : "Dépôt échoué",
        message: isPaymentLink
          ? `Un paiement a échoué.`
          : `Votre dépôt a échoué.`,
        transactionId: transaction.id,
      });

      if (payment.paymentIntentId) {
        await storage.updatePaymentIntentStatus(payment.paymentIntentId, "failed");
      }

      console.log(`[PaymentPoller] Payment failed for ${payment.reference}`);
    }

    removePendingPayment(payment.reference);
  } catch (error) {
    console.error(`[PaymentPoller] Error processing payment result ${payment.reference}:`, error);
  }
}

async function pollPendingPayments() {
  const entries = Array.from(pendingPayments.entries());
  for (const [reference, payment] of entries) {
    payment.attempts++;

    if (payment.attempts > MAX_POLL_ATTEMPTS) {
      console.log(`[PaymentPoller] Max attempts reached for ${reference}, marking as pending (timeout)`);
      removePendingPayment(reference);
      continue;
    }

    const status = await checkPaymentStatus(payment);

    if (status === "completed" || status === "failed") {
      await processPaymentResult(payment, status);
    } else {
      console.log(`[PaymentPoller] Payment ${reference} still pending (attempt ${payment.attempts}/${MAX_POLL_ATTEMPTS})`);
    }
  }
}

let pollerInterval: NodeJS.Timeout | null = null;

export function startPaymentPoller() {
  if (pollerInterval) {
    console.log("[PaymentPoller] Already running");
    return;
  }

  console.log("[PaymentPoller] Starting payment poller (every 5 seconds)");
  pollerInterval = setInterval(pollPendingPayments, POLL_INTERVAL);
}

export function stopPaymentPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[PaymentPoller] Stopped");
  }
}
