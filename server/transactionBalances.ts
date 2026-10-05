import type { Transaction, Wallet } from "@shared/schema-runtime";

export interface TransactionBalanceSnapshot {
  balanceCurrency?: string;
  balanceBefore?: string;
  balanceAfter?: string;
  targetBalanceCurrency?: string;
  targetBalanceBefore?: string;
  targetBalanceAfter?: string;
  balanceSnapshotUnavailable?: boolean;
}

type BalanceState = Record<string, number>;

const ACTIVE_STATUSES = new Set(["pending", "processing", "pending_manual", "completed"]);
const TERMINAL_NO_EFFECT_STATUSES = new Set(["failed", "cancelled", "refunded"]);

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return value.toFixed(2);
}

function transactionMetadata(transaction: Transaction): Record<string, unknown> {
  const value = (transaction as any).metadata;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function payoutWalletCurrency(transaction: Transaction, fallback: string): string {
  const currency = transactionMetadata(transaction).walletCurrency;
  return typeof currency === "string" && currency ? currency : fallback;
}

function hasVerifiedSameWalletRefund(transaction: Transaction, walletCurrency: string): boolean {
  const metadata = transactionMetadata(transaction);
  const refundedCurrency = metadata.payoutRefundedWalletCurrency;
  const refundedAmount = numeric(metadata.payoutRefundedAmount);
  const expectedAmount = numeric(transaction.totalAmount) || numeric(transaction.amount);
  return typeof refundedCurrency === "string" &&
    refundedCurrency.toUpperCase() === walletCurrency.toUpperCase() &&
    Math.abs(refundedAmount - expectedAmount) < 0.005;
}

function addDelta(deltas: Map<string, number>, currency: string | null | undefined, amount: number) {
  if (!currency || !Number.isFinite(amount) || amount === 0) return;
  deltas.set(currency, (deltas.get(currency) || 0) + amount);
}

function transactionDeltas(transaction: Transaction): Map<string, number> {
  const deltas = new Map<string, number>();
  if (TERMINAL_NO_EFFECT_STATUSES.has(transaction.status)) return deltas;

  const amount = numeric(transaction.amount);
  const totalAmount = numeric(transaction.totalAmount) || amount;
  const statusIsActive = ACTIVE_STATUSES.has(transaction.status);

  if (transaction.type === "conversion") {
    if (statusIsActive) addDelta(deltas, transaction.currency, -amount);
    if (transaction.status === "completed") {
      addDelta(deltas, transaction.recipientCountry, totalAmount);
    }
    return deltas;
  }

  if (transaction.type === "deposit" || transaction.type === "payment_link" || transaction.type === "transfer_in") {
    if (transaction.status === "completed") addDelta(deltas, transaction.currency, amount);
    return deltas;
  }

  if (transaction.type === "withdrawal" || transaction.type === "transfer_out" || transaction.type === "admin_debit") {
    if (statusIsActive) {
      const currency = transaction.type === "admin_debit"
        ? transaction.currency
        : payoutWalletCurrency(transaction, transaction.currency || "XAF");
      addDelta(deltas, currency, -totalAmount);
    }
    return deltas;
  }

  if (transaction.type === "admin_credit" && transaction.status === "completed") {
    addDelta(deltas, transaction.currency, amount);
  }

  return deltas;
}

/**
 * Reconstruct balance snapshots from the current ledger state. This is kept
 * read-only so old transactions can display balances without a destructive
 * backfill or a schema migration.
 */
export function buildTransactionBalanceSnapshots(
  transactions: Transaction[],
  primaryCurrency: string,
  primaryBalance: number,
  wallets: Wallet[],
): Map<string, TransactionBalanceSnapshot> {
  const current: BalanceState = { [primaryCurrency]: numeric(primaryBalance) };
  for (const wallet of wallets) {
    current[wallet.currency] = numeric(wallet.balance);
  }

  const state = { ...current };
  const snapshots = new Map<string, TransactionBalanceSnapshot>();
  const ordered = [...transactions].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime || b.id.localeCompare(a.id);
  });
  const unavailableCurrencies = new Set<string>();

  for (const transaction of ordered) {
    const isPayout = transaction.type === "withdrawal" || transaction.type === "transfer_out";
    const sourceCurrency = isPayout
      ? payoutWalletCurrency(transaction, transaction.currency || primaryCurrency)
      : transaction.currency || primaryCurrency;
    const failedPayout = isPayout && TERMINAL_NO_EFFECT_STATUSES.has(transaction.status);
    if (failedPayout && !hasVerifiedSameWalletRefund(transaction, sourceCurrency)) {
      snapshots.set(transaction.id, { balanceSnapshotUnavailable: true });
      unavailableCurrencies.add(sourceCurrency);
      unavailableCurrencies.add(primaryCurrency);
      const metadata = transactionMetadata(transaction);
      if (typeof metadata.payoutRefundedWalletCurrency === "string") {
        unavailableCurrencies.add(metadata.payoutRefundedWalletCurrency);
      }
      continue;
    }

    const after = { ...state };
    const deltas = transactionDeltas(transaction);
    const before = { ...after };

    for (const [currency, delta] of deltas) {
      if (unavailableCurrencies.has(currency)) continue;
      before[currency] = (before[currency] || 0) - delta;
      if (before[currency] < -0.005 || after[currency] < -0.005) {
        unavailableCurrencies.add(currency);
      }
    }

    const sourceBefore = before[sourceCurrency] || 0;
    const sourceAfter = after[sourceCurrency] || 0;
    const sourceAvailable = !unavailableCurrencies.has(sourceCurrency) &&
      sourceBefore >= -0.005 && sourceAfter >= -0.005;
    const snapshot: TransactionBalanceSnapshot = {};

    if (sourceAvailable) {
      snapshot.balanceCurrency = sourceCurrency;
      snapshot.balanceBefore = money(Math.max(0, sourceBefore));
      snapshot.balanceAfter = money(Math.max(0, sourceAfter));
    }

    if (transaction.type === "conversion" && transaction.recipientCountry) {
      const targetCurrency = transaction.recipientCountry;
      const targetBefore = before[targetCurrency] || 0;
      const targetAfter = after[targetCurrency] || 0;
      const targetAvailable = !unavailableCurrencies.has(targetCurrency) &&
        targetBefore >= -0.005 && targetAfter >= -0.005;
      if (targetAvailable) {
        snapshot.targetBalanceCurrency = targetCurrency;
        snapshot.targetBalanceBefore = money(Math.max(0, targetBefore));
        snapshot.targetBalanceAfter = money(Math.max(0, targetAfter));
      } else {
        unavailableCurrencies.add(targetCurrency);
      }
    }

    if (!sourceAvailable || (transaction.type === "conversion" && !snapshot.targetBalanceCurrency)) {
      snapshot.balanceSnapshotUnavailable = true;
    }

    snapshots.set(transaction.id, snapshot);
    for (const currency of Object.keys(before)) {
      if (!unavailableCurrencies.has(currency)) state[currency] = before[currency];
    }
  }

  return snapshots;
}