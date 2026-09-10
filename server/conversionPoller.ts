import { storage } from "./storage";
import { notifyConversionCompleted } from "./telegram";
import { convertCurrency, loadFxRates } from "./walletHelper";

const POLL_INTERVAL = 10_000; // 10 seconds
let conversionProcessing = false;

interface ConversionMeta {
  executeAt?: number;
  txId?: string;
  feeAmount?: string;
  feePercent?: string;
  fromAmount?: string;
  toAmount?: string;
}

function parseMeta(notes: string | null | undefined): ConversionMeta | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object") return parsed as ConversionMeta;
  } catch {}
  return null;
}

export async function processPendingConversions() {
  if (conversionProcessing) return;
  conversionProcessing = true;
  try {
    const pending = await storage.getPendingConversionRequests();
    if (pending.length === 0) return;

    const now = Date.now();

    for (const req of pending) {
      const meta = parseMeta(req.notes);

      // If executeAt is set and not yet due, skip
      if (meta?.executeAt && meta.executeAt > now) continue;

      // If notes can't be parsed at all OR executeAt is missing, the conversion is
      // stuck in pending. Treat it as immediately due.

      try {
        const user = await storage.getUser(req.userId);
        if (!user) {
          console.error(`[ConversionPoller] User ${req.userId} not found for conversion ${req.id} — cancelling`);
          await storage.updateConversionRequest(req.id, { status: "cancelled" });
          const stuckTxId = meta?.txId;
          if (stuckTxId) await storage.updateTransactionStatus(stuckTxId, "failed");
          continue;
        }

        // Determine receivedAmount — prefer meta.toAmount, then req.toAmount, then recalculate
        const metaAmount = parseFloat(String(meta?.toAmount ?? "0"));
        const dbAmount = parseFloat(String(req.toAmount ?? "0"));
        let receivedAmount = metaAmount > 0 ? metaAmount : dbAmount > 0 ? dbAmount : 0;

        if (!isFinite(receivedAmount) || receivedAmount <= 0) {
          // Recalculate using admin FX rates as last resort
          console.warn(`[ConversionPoller] toAmount missing for ${req.id}, recalculating via admin FX rates`);
          try {
            const fxRates = await loadFxRates();
            const fromAmt = parseFloat(req.fromAmount || "0");
            if (isFinite(fromAmt) && fromAmt > 0) {
              receivedAmount = convertCurrency(fromAmt, req.fromCurrency, req.toCurrency, fxRates);
            }
          } catch {}
        }

        if (!isFinite(receivedAmount) || receivedAmount <= 0) {
          // Still invalid — refund source wallet and cancel
          console.error(`[ConversionPoller] Invalid toAmount for conversion ${req.id} — refunding source`);
          const primary2 = user.preferredCurrency || "XAF";
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
          const failTxId = meta?.txId;
          if (failTxId) await storage.updateTransactionStatus(failTxId, "failed");
          continue;
        }

        const userPrimary = user.preferredCurrency || "XAF";

        // Credit the correct wallet
        if (req.toCurrency === userPrimary) {
          await storage.updateUserBalance(req.userId, receivedAmount);
        } else {
          await storage.upsertWallet(req.userId, req.toCurrency, receivedAmount);
        }

        await storage.updateConversionRequest(req.id, {
          status: "completed",
          toAmount: receivedAmount.toFixed(2),
          executedAt: new Date(),
          executedById: req.userId,
        });

        const txId = meta?.txId;
        if (txId) {
          await storage.updateTransactionStatus(txId, "completed");
        }

        await storage.createUserNotification({
          userId: req.userId,
          title: "Conversion réussie ✅",
          message: `Votre conversion de ${req.fromAmount} ${req.fromCurrency} → ${receivedAmount.toFixed(2)} ${req.toCurrency} est terminée.${meta?.feeAmount ? ` Frais: ${meta.feeAmount} ${req.fromCurrency}.` : ""}`,
          transactionId: txId || undefined,
          type: "success",
          isRead: false,
        });

        const startedAt = meta?.executeAt ? meta.executeAt - 15_000 : now - 10_000;
        const elapsedSeconds = Math.round((now - startedAt) / 1000);
        notifyConversionCompleted({
          userName: user.fullName || user.username,
          userEmail: user.email || "",
          fromAmount: req.fromAmount || "0",
          fromCurrency: req.fromCurrency,
          toAmount: receivedAmount.toFixed(2),
          toCurrency: req.toCurrency,
          feeAmount: meta?.feeAmount || "0",
          feePercent: meta?.feePercent || "N/A",
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
  } finally {
    conversionProcessing = false;
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
