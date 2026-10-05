import assert from "node:assert/strict";
import test from "node:test";
import { buildTransactionBalanceSnapshots } from "../server/transactionBalances.ts";
import { isPrimaryWalletCurrency } from "../server/walletRouting.ts";

test("wallet identity uses exact currency codes, not CFA-family membership", () => {
  assert.equal(isPrimaryWalletCurrency("XOFB", "XOFT"), false);
  assert.equal(isPrimaryWalletCurrency("xoft", "XOFT"), true);
  assert.equal(isPrimaryWalletCurrency("USDT", "USDT"), true);
});

test("legacy failed payout without refund-wallet proof hides affected historical balances", () => {
  const transactions = [
    {
      id: "conversion",
      type: "conversion",
      currency: "XOFT",
      recipientCountry: "XOFB",
      amount: "83000.00",
      totalAmount: "83000.00",
      status: "completed",
      createdAt: new Date("2026-10-05T10:56:00Z"),
      metadata: {},
    },
    {
      id: "payout",
      type: "withdrawal",
      currency: "XOF",
      amount: "79000.00",
      totalAmount: "82160.00",
      status: "failed",
      createdAt: new Date("2026-10-05T10:57:00Z"),
      metadata: { walletCurrency: "XOFB" },
    },
  ] as any[];

  const snapshots = buildTransactionBalanceSnapshots(transactions, "XOFT", 101082.71, [
    { currency: "XOFB", balance: "0.00" },
  ] as any);

  assert.deepEqual(snapshots.get("payout"), { balanceSnapshotUnavailable: true });
  assert.deepEqual(snapshots.get("conversion"), { balanceSnapshotUnavailable: true });
});

test("verified same-wallet refund preserves valid before-and-after snapshots", () => {
  const transactions = [
    {
      id: "conversion",
      type: "conversion",
      currency: "XOFT",
      recipientCountry: "XOFB",
      amount: "83000.00",
      totalAmount: "83000.00",
      status: "completed",
      createdAt: new Date("2026-10-05T10:56:00Z"),
      metadata: {},
    },
    {
      id: "payout",
      type: "withdrawal",
      currency: "XOF",
      amount: "79000.00",
      totalAmount: "82160.00",
      status: "failed",
      createdAt: new Date("2026-10-05T10:57:00Z"),
      metadata: {
        walletCurrency: "XOFB",
        payoutRefundedWalletCurrency: "XOFB",
        payoutRefundedAmount: "82160.00",
      },
    },
  ] as any[];

  const snapshots = buildTransactionBalanceSnapshots(transactions, "XOFT", 450243, [
    { currency: "XOFB", balance: "83000.00" },
  ] as any);

  assert.deepEqual(snapshots.get("payout"), {
    balanceCurrency: "XOFB",
    balanceBefore: "83000.00",
    balanceAfter: "83000.00",
  });
  assert.deepEqual(snapshots.get("conversion"), {
    balanceCurrency: "XOFT",
    balanceBefore: "533243.00",
    balanceAfter: "450243.00",
    targetBalanceCurrency: "XOFB",
    targetBalanceBefore: "0.00",
    targetBalanceAfter: "83000.00",
  });
});
