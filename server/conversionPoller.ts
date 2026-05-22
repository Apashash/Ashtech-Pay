import { storage } from "./storage";
import { notifyConversionCompleted } from "./telegram";

const POLL_INTERVAL = 10_000; // 10 seconds

interface ConversionMeta {
  executeAt: number;
  txId: string;
  feeAmount: string;
  feePercent: string;
  fromAmount: string;
  toAmount: string;
}

function parseMeta(notes: string | null | undefined): ConversionMeta | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed.executeAt && parsed.txId) return parsed as ConversionMeta;
  } catch {}
  return null;
}

async function processPendingConversions() {
  try {
    const pending = await storage.getPendingConversionRequests();
    if (pending.length === 0) return;

    const now = Date.now();

    for (const req of pending) {
      const meta = parseMeta(req.notes);
      if (!meta) continue;
      if (meta.executeAt > now) continue;

      try {
        const user = await storage.getUser(req.userId);
        if (!user) {
          console.error(`[ConversionPoller] User ${req.userId} not found for conversion ${req.id} — cancelling`);
          await storage.updateConversionRequest(req.id, { status: "cancelled" });
          if (meta.txId) await storage.updateTransactionStatus(meta.txId, "failed");
          continue;
        }

        // Parse receivedAmount — prefer meta.toAmount (computed at conversion creation time)
        // over req.toAmount from DB which can be stored as "0.00" (truthy but numerically 0)
        // causing false cancellation. Use whichever is a valid positive number.
        const metaAmount = parseFloat(String(meta.toAmount ?? "0"));
        const dbAmount = parseFloat(String(req.toAmount ?? "0"));
        const receivedAmount = metaAmount > 0 ? metaAmount : dbAmount;

        if (!isFinite(receivedAmount) || receivedAmount <= 0) {
          // toAmount invalide — refund source wallet and cancel
          console.error(`[ConversionPoller] Invalid toAmount (meta=${meta.toAmount}, db=${req.toAmount}) for conversion ${req.id} — refunding source`);
          const user2 = await storage.getUser(req.userId);
          const primary2 = user2?.preferredCurrency || "XAF";
          const refundAmount = parseFloat(req.fromAmount || "0");
          if (isFinite(refundAmount) && refundAmount > 0) {
            if (req.fromCurrency === primary2) {
              await storage.updateUserBalance(req.userId, refundAmount);
            } else {
              await storage.upsertWallet(req.userId, req.fromCurrency, refundAmount);
            }
            console.log(`[ConversionPoller] Refunded ${refundAmount} ${req.fromCurrency} to user ${req.userId}`);
          }
          await storage.updateConversionRequest(req.id, { status: "cancelled" });
          if (meta.txId) await storage.updateTransactionStatus(meta.txId, "failed");
          continue;
        }

        const userPrimary = user.preferredCurrency || "XAF";

        // Credit the correct wallet: exact match → primary balance, any other → secondary wallet
        if (req.toCurrency === userPrimary) {
          await storage.updateUserBalance(req.userId, receivedAmount);
        } else {
          await storage.upsertWallet(req.userId, req.toCurrency, receivedAmount);
        }

        await storage.updateConversionRequest(req.id, {
          status: "completed",
          executedAt: new Date(),
          executedById: req.userId,
        });

        if (meta.txId) {
          await storage.updateTransactionStatus(meta.txId, "completed");
        }

        await storage.createUserNotification({
          userId: req.userId,
          title: "Conversion réussie ✅",
          message: `Votre conversion de ${req.fromAmount} ${req.fromCurrency} → ${receivedAmount.toFixed(2)} ${req.toCurrency} est terminée. Frais: ${meta.feeAmount} ${req.fromCurrency}.`,
          transactionId: meta.txId || undefined,
          type: "success",
        });

        const elapsedSeconds = Math.round((now - (meta.executeAt - 45_000)) / 1000);
        notifyConversionCompleted({
          userName: user.fullName || user.username,
          userEmail: user.email || "",
          fromAmount: req.fromAmount || "0",
          fromCurrency: req.fromCurrency,
          toAmount: receivedAmount.toFixed(2),
          toCurrency: req.toCurrency,
          feeAmount: meta.feeAmount,
          feePercent: meta.feePercent,
          reference: req.id,
          userCountry: user.country || "",
          elapsedSeconds,
        }).catch(() => {});

        console.log(`[ConversionPoller] ✅ ${req.id}: ${req.fromAmount} ${req.fromCurrency} → ${receivedAmount.toFixed(2)} ${req.toCurrency} (user=${req.userId})`);
      } catch (err: any) {
        console.error(`[ConversionPoller] Error processing conversion ${req.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[ConversionPoller] Poll error:", err.message);
  }
}

let pollerInterval: NodeJS.Timeout | null = null;

export function startConversionPoller() {
  if (pollerInterval) {
    console.log("[ConversionPoller] Already running");
    return;
  }
  processPendingConversions().catch(() => {});
  pollerInterval = setInterval(processPendingConversions, POLL_INTERVAL);
  console.log("[ConversionPoller] Started (every 10 seconds)");
}

export function stopConversionPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[ConversionPoller] Stopped");
  }
}
