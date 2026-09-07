import type { Transaction, Wallet } from "@shared/schema";

export interface TransactionBalanceSnapshot {
  balanceCurrency: string;
  balanceBefore: string;
  balanceAfter: string;
  targetBalanceCurrency?: string;
  targetBalanceBefore?: string;
  targetBalanceAfter?: string;
}

type BalanceState = Record<string, number>;

const ACTIVE_STATUSES = new Set(["pending", "processing", "pending_manual", "completed"]);
const TERMINAL_NO_EFFECT_STATUSES = new Set(["failed", "cancelled"]);

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return value.toFixed(2);
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
    if (statusIsActive) addDelta(deltas, transaction.currency, -totalAmount);
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

  for (const transaction of ordered) {
    const after = { ...state };
    const deltas = transactionDeltas(transaction);
    const before = { ...after };

    for (const [currency, delta] of deltas) {
      before[currency] = (before[currency] || 0) - delta;
    }

    const sourceCurrency = transaction.currency || primaryCurrency;
    const sourceBefore = before[sourceCurrency] || 0;
    const sourceAfter = after[sourceCurrency] || 0;
    const snapshot: TransactionBalanceSnapshot = {
      balanceCurrency: sourceCurrency,
      balanceBefore: money(sourceBefore),
      balanceAfter: money(sourceAfter),
    };

    if (transaction.type === "conversion" && transaction.recipientCountry) {
      snapshot.targetBalanceCurrency = transaction.recipientCountry;
      snapshot.targetBalanceBefore = money(before[transaction.recipientCountry] || 0);
      snapshot.targetBalanceAfter = money(after[transaction.recipientCountry] || 0);
    }

    snapshots.set(transaction.id, snapshot);
    for (const currency of Object.keys(before)) state[currency] = before[currency];
  }

  return snapshots;
}