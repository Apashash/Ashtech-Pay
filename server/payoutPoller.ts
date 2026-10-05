import { storage } from "./storage";
import { checkAfribaPayStatus, checkAfribaPayoutStatus, isAfribaPayConfigured } from "./afribapay";
import { checkPixPayStatus } from "./pixpay";
import { getPawaPayPayout, isPawaPayUuidV4 } from "./pawapay";
import { getIziPayout, isIziPayConfigured } from "./izichange";
import { getIziPayoutIdForPolling } from "./cryptoPayout";
import { sendWithdrawalApprovedEmail } from "./email";
import { notifyWithdrawalAutoValidated, notifyWithdrawalFailed } from "./telegram";
import { setFailedCooldown } from "./failedCooldown";
import {
  canRetryPayoutWithProvider,
  isPixPayManualPayoutProcessable,
  normalizePayoutStatusProvider,
  resolvePayoutStatusLookupReference,
  type PayoutStatusProvider,
} from "./providerStatusReferences";
import {
  isProviderStatusPollDue,
  recoveredStatusPollLastCheckedAt,
} from "./providerStatusPolicy";
import { enqueueMerchantWebhook } from "./merchantWebhook";

const POLL_INTERVAL = 10_000; // scheduler tick; provider lookups use progressive backoff

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
  startedAt?: number;
  lastCheckedAt?: number;
  countryCode:    string;
  txType:         string;
  txCurrency:     string;
  /** The wallet key that was actually debited (may differ from txCurrency, e.g. "XOF" vs "XOFB"). Used for refunds. */
  walletCurrency?: string;
}

const pendingPayouts = new Map<string, PendingPayout>();
const pendingPayoutStatusChecks = new Set<string>();

export function addPendingPayout(
  payout: Omit<PendingPayout, "attempts" | "startedAt" | "lastCheckedAt"> &
    Partial<Pick<PendingPayout, "startedAt" | "lastCheckedAt">>,
) {
  console.log(`[PayoutPoller] Tracking payout: ${payout.reference} (provider=${payout.provider}, country=${payout.countryCode})`);
  const existing = pendingPayouts.get(payout.reference);
  pendingPayouts.set(payout.reference, {
    ...existing,
    ...payout,
    attempts: existing?.attempts ?? 0,
    startedAt: existing?.startedAt ?? payout.startedAt ?? Date.now(),
    lastCheckedAt: existing?.lastCheckedAt ?? payout.lastCheckedAt ?? 0,
  });
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
      const payoutStartedAt = t.createdAt ? new Date(t.createdAt).getTime() : Date.now();
      const operator = t.operatorId ? await storage.getOperator(t.operatorId).catch(() => null) : null;
      const metadata = ((t as any).metadata || {}) as Record<string, any>;
      const configuredProvider = normalizePayoutStatusProvider(
        metadata.paymentProvider ||
        metadata.pendingPayoutProvider ||
        (operator as any)?.paymentProvider,
      );
      // Trust the transaction's recorded provider first. UUID-looking
      // references are a PawaPay fallback only for legacy rows without one.
      const provider = configuredProvider ||
        (t.externalReference && isPawaPayUuidV4(t.externalReference) ? "pawapay" : undefined);
      if (provider !== "afribapay" && provider !== "pixpay" && provider !== "pawapay" && provider !== "izichange") {
        console.warn(`[PayoutPoller] Skipping pending payout ${internalRef}: no supported provider`);
        continue;
      }
      if (canRetryPayoutWithProvider(metadata, provider)) {
        if (t.status === "pending" || t.status === "processing") {
          await storage.claimTransactionStatus(t.id, "pending_manual", [t.status]);
        }
        console.log(`[PayoutPoller] ${internalRef} has a confirmed safe-to-retry rejection; awaiting same-provider admin retry`);
        continue;
      }
      if (provider === "pawapay" && !isPawaPayUuidV4((t as any).externalReference)) {
        console.warn(`[PayoutPoller] Skipping status lookup for ${internalRef}: missing valid PawaPay payout UUID`);
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
        startedAt:     payoutStartedAt,
        lastCheckedAt: recoveredStatusPollLastCheckedAt(pollerRef, payoutStartedAt),
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
    if (!transaction) {
      removePendingPayout(payout.reference);
      return;
    }
    const providerFinalStatus =
      apiStatus === "success" || apiStatus === "completed"
        ? "completed"
        : ["failed", "refunded", "cancelled"].includes(apiStatus)
          ? "failed"
          : null;
    if (
      providerFinalStatus &&
      ["completed", "failed", "cancelled"].includes(transaction.status) &&
      providerFinalStatus !== transaction.status
    ) {
      console.error(
        `[PayoutPoller] Late provider status conflict for ${transaction.reference || transaction.id}: provider=${providerFinalStatus}, stored=${transaction.status}; keeping the stored status and wallet balance.`,
      );
    }
    const transactionMetadata = ((transaction as any).metadata || {}) as Record<string, unknown>;
    const pawaManual = payout.provider === "pawapay" &&
      !!transaction?.externalReference &&
      isPawaPayUuidV4(transaction.externalReference) &&
      transaction.status === "pending_manual";
    const iziManual = payout.provider === "izichange" &&
      transaction?.status === "pending_manual" &&
      (transaction as any)?.metadata?.paymentProvider === "izichange";
    const afribaManual = payout.provider === "afribapay" &&
      transaction?.status === "pending_manual";
    const pixpayManual = isPixPayManualPayoutProcessable(
      payout.provider,
      transaction.status,
      transactionMetadata,
    );
    if (transaction.status !== "pending" && transaction.status !== "processing" && !pawaManual && !iziManual && !afribaManual && !pixpayManual) {
      removePendingPayout(payout.reference);
      return;
    }

    const currency = transaction.currency || "XAF";
    const walletCurrency = payout.walletCurrency || String(transactionMetadata.walletCurrency || currency);

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
      const claimed = payout.provider === "pawapay"
        ? await storage.claimPawaPayoutFailedAndRefund(payout.transactionId, ["pending", "processing", "pending_manual"])
        : payout.provider === "izichange"
          ? await storage.claimIziPayPayoutFailedAndRefund(payout.transactionId, ["pending", "processing", "pending_manual"])
          : payout.provider === "afribapay"
            ? await storage.claimPayoutFailedAndRefund(payout.transactionId, ["pending", "processing", "pending_manual"])
            : await storage.claimTransactionStatus(payout.transactionId, "failed", ["pending", "processing", "pending_manual"]);
      if (!claimed) {
        removePendingPayout(payout.reference);
        return;
      }
      setFailedCooldown(payout.userId);
      const refundAmount = parseFloat(payout.totalDebited || payout.amount);
      if (payout.provider !== "pawapay" && payout.provider !== "izichange" && payout.provider !== "afribapay") {
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

    const settledTransaction = await storage.getTransactionById(payout.transactionId).catch(() => undefined);
    if (
      settledTransaction?.source === "api" &&
      (settledTransaction.status === "completed" || settledTransaction.status === "failed")
    ) {
      await enqueueMerchantWebhook(settledTransaction, settledTransaction.status).catch((error) => {
        console.error("[PayoutPoller] Merchant webhook enqueue failed:", error instanceof Error ? error.message : "unknown error");
      });
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

async function checkProviderStatus(
  payout: PendingPayout,
  lookupReference = payout.reference,
): Promise<{ status: string; shouldRemove?: boolean }> {
  try {
    if (payout.provider === "afribapay") {
      // Missing credentials are a configuration state, not a provider failure.
      // Leave the payout pending without generating repeated failed requests.
      if (!isAfribaPayConfigured()) return { status: "pending" };
      if (!lookupReference.trim()) return { status: "pending" };
      const result = await checkAfribaPayoutStatus(lookupReference, "order_id");
      return { status: result.status };
    }

    if (payout.provider === "pixpay") {
      if (!lookupReference.trim()) return { status: "pending" };
      const result = await checkPixPayStatus(lookupReference, payout.countryCode);
      return { status: result.status };
    }
    if (payout.provider === "pawapay") {
      const id = payout.externalReference;
      if (!id || !isPawaPayUuidV4(id)) return { status: "pending" };
      const result = await getPawaPayPayout(id);
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
    return { status: "pending" };
  }
}

export interface AdminPayoutReconciliationResult {
  supported: boolean;
  provider?: PayoutStatusProvider;
  providerStatus: "completed" | "failed" | "pending" | "unsupported";
  transactionStatus: string;
  message?: string;
}

/**
 * Check an existing payout attempt and apply only a definitive provider result.
 * Provider-authoritative reconciliation for flows that explicitly require it.
 * Manual admin status overrides intentionally bypass this helper.
 */
export async function reconcilePayoutAttemptForAdmin(
  transactionId: string,
): Promise<AdminPayoutReconciliationResult> {
  const transaction = await storage.getTransactionById(transactionId);
  if (!transaction) {
    return {
      supported: false,
      providerStatus: "unsupported",
      transactionStatus: "not_found",
      message: "Transaction non trouvée.",
    };
  }
  if (
    (transaction.type !== "withdrawal" && transaction.type !== "transfer_out") ||
    !["pending", "pending_manual", "processing"].includes(transaction.status)
  ) {
    return {
      supported: false,
      providerStatus: "unsupported",
      transactionStatus: transaction.status,
      message: "Seuls les retraits et envois en attente peuvent être rapprochés.",
    };
  }

  const metadata = ((transaction as any).metadata || {}) as Record<string, any>;
  const operator = transaction.operatorId
    ? await storage.getOperator(transaction.operatorId).catch(() => null)
    : null;
  let provider: PayoutStatusProvider | null =
    transaction.externalReference && isPawaPayUuidV4(transaction.externalReference)
      ? "pawapay"
      : null;
  if (!provider) {
    for (const candidate of [
      metadata.pendingPayoutProvider,
      metadata.paymentProvider,
      (operator as any)?.paymentProvider,
      (operator as any)?.depositPaymentProvider,
    ]) {
      provider = normalizePayoutStatusProvider(candidate);
      if (provider) break;
    }
  }
  if (!provider) {
    return {
      supported: false,
      providerStatus: "unsupported",
      transactionStatus: transaction.status,
      message: "Le fournisseur de cette tentative n'est pas identifié. Aucune modification n'a été effectuée.",
    };
  }

  let countryCode = typeof transaction.recipientCountry === "string"
    ? transaction.recipientCountry.trim().toUpperCase()
    : "";
  if (!/^[A-Z]{2}$/.test(countryCode) && operator?.countryId) {
    const operatorCountry = await storage.getCountry(operator.countryId).catch(() => null);
    countryCode = operatorCountry?.code?.toUpperCase() || "";
  }
  if (!/^[A-Z]{2}$/.test(countryCode) && transaction.recipientCountry) {
    const countries = await storage.getAllCountries().catch(() => []);
    const recipientCountry = transaction.recipientCountry.trim().toLowerCase();
    const country = countries.find((candidate) =>
      candidate.name?.trim().toLowerCase() === recipientCountry ||
      candidate.code?.trim().toLowerCase() === recipientCountry
    );
    countryCode = country?.code?.toUpperCase() || "";
  }
  if (provider === "pixpay" && !/^[A-Z]{2}$/.test(countryCode)) {
    return {
      supported: false,
      provider,
      providerStatus: "unsupported",
      transactionStatus: transaction.status,
      message: "Le pays de la tentative PixPay n'a pas pu être identifié. Aucune modification n'a été effectuée.",
    };
  }
  if (!/^[A-Z]{2}$/.test(countryCode)) countryCode = "CM";

  const iziPayoutId = provider === "izichange"
    ? getIziPayoutIdForPolling(transaction.externalReference, metadata)
    : undefined;
  const lookupReference = resolvePayoutStatusLookupReference(
    provider,
    transaction,
    iziPayoutId,
  );
  if (
    !lookupReference ||
    (provider === "pawapay" && !isPawaPayUuidV4(lookupReference)) ||
    (provider === "izichange" && !iziPayoutId)
  ) {
    return {
      supported: false,
      provider,
      providerStatus: "unsupported",
      transactionStatus: transaction.status,
      message: "L'identifiant fournisseur est manquant ou invalide. Aucune nouvelle tentative n'a été créée.",
    };
  }

  const payout: PendingPayout = {
    transactionId: transaction.id,
    reference: provider === "izichange"
      ? transaction.reference || lookupReference
      : lookupReference,
    userId: transaction.userId,
    amount: transaction.amount || "0",
    totalDebited: transaction.totalAmount || transaction.amount || "0",
    attempts: 0,
    provider,
    externalReference: provider === "izichange"
      ? iziPayoutId
      : transaction.externalReference || undefined,
    countryCode,
    txType: transaction.type,
    txCurrency: transaction.currency || "XAF",
    walletCurrency: metadata.walletCurrency || transaction.currency || "XAF",
  };

  if (pendingPayoutStatusChecks.has(transaction.id)) {
    return {
      supported: true,
      provider,
      providerStatus: "pending",
      transactionStatus: transaction.status,
      message: "Un rapprochement fournisseur est déjà en cours.",
    };
  }

  pendingPayoutStatusChecks.add(transaction.id);
  try {
    const result = await checkProviderStatus(payout, lookupReference);
    const providerStatus: AdminPayoutReconciliationResult["providerStatus"] =
      result.status === "completed" || result.status === "success"
        ? "completed"
        : ["failed", "refunded", "cancelled"].includes(result.status)
          ? "failed"
          : "pending";

    if (providerStatus === "completed") {
      await processPayout(payout, "success");
    } else if (providerStatus === "failed") {
      await processPayout(payout, result.status);
    }

    const latest = await storage.getTransactionById(transaction.id);
    if (latest && ["pending", "pending_manual", "processing"].includes(latest.status)) {
      addPendingPayout({
        transactionId: payout.transactionId,
        reference: payout.reference,
        userId: payout.userId,
        amount: payout.amount,
        totalDebited: payout.totalDebited,
        provider: payout.provider,
        externalReference: payout.externalReference,
        countryCode: payout.countryCode,
        txType: payout.txType,
        txCurrency: payout.txCurrency,
        walletCurrency: payout.walletCurrency,
      });
    }

    return {
      supported: true,
      provider,
      providerStatus,
      transactionStatus: latest?.status || transaction.status,
    };
  } finally {
    pendingPayoutStatusChecks.delete(transaction.id);
  }
}

async function pollPendingPayouts() {
  try {
    const now = Date.now();
    const entries = Array.from(pendingPayouts.entries());
    const checkedTransactions = new Set<string>();
    for (const [reference, payout] of entries) {
      if (
        checkedTransactions.has(payout.transactionId) ||
        pendingPayoutStatusChecks.has(payout.transactionId)
      ) continue;
      if (!isProviderStatusPollDue(payout.startedAt ?? now, payout.lastCheckedAt ?? 0, now)) continue;
      pendingPayoutStatusChecks.add(payout.transactionId);
      checkedTransactions.add(payout.transactionId);
      try {
        payout.lastCheckedAt = now;
        const transaction = await storage.getTransactionById(payout.transactionId);
        if (
          !transaction ||
          !["pending", "processing", "pending_manual"].includes(transaction.status)
        ) {
          removePendingPayout(reference);
          continue;
        }
        const metadata = ((transaction as any).metadata || {}) as Record<string, any>;
        // Resolve every lookup from the current persisted transaction, not
        // the potentially stale identifier held by this process's queue.
        const iziPayoutId = payout.provider === "izichange"
          ? getIziPayoutIdForPolling(transaction.externalReference, metadata)
          : undefined;
        const persistedProviderReference = resolvePayoutStatusLookupReference(
          payout.provider,
          transaction,
          iziPayoutId,
        );
        if (!persistedProviderReference) continue;
        if (payout.provider === "pawapay") {
          // PawaPay status endpoints require a UUID, never the AshTech ref.
          if (!isPawaPayUuidV4(persistedProviderReference)) continue;
          payout.externalReference = persistedProviderReference;
        } else if (payout.provider === "izichange") {
          payout.externalReference = persistedProviderReference;
        }
        payout.attempts++;

        const { status } = await checkProviderStatus(payout, persistedProviderReference);
        console.log(`[PayoutPoller] ${reference}: status=${status} provider=${payout.provider} (attempt ${payout.attempts})`);

        if (status === "completed" || status === "success") {
          await processPayout(payout, "success");
        } else if (status === "failed" || status === "refunded" || status === "cancelled") {
          await processPayout(payout, status);
        }
      } catch (entryErr: any) {
        console.error(`[PayoutPoller] Unexpected error for ${reference}:`, entryErr?.message);
      } finally {
        pendingPayoutStatusChecks.delete(payout.transactionId);
      }
    }
  } catch (err: any) {
    console.error("[PayoutPoller] Poll loop crashed — recovered:", err?.message);
  }
}

let pollerInterval: NodeJS.Timeout | null = null;

export function startPayoutPoller() {
  if (pollerInterval) { console.log("[PayoutPoller] Already running"); return; }
  console.log(`[PayoutPoller] Starting payout poller (scheduler tick ${POLL_INTERVAL / 1000}s; provider status checks use progressive backoff)`);
  pollerInterval = setInterval(pollPendingPayouts, POLL_INTERVAL);
}

export function stopPayoutPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[PayoutPoller] Stopped");
  }
}
