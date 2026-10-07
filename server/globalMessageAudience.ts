import {
  and,
  count,
  eq,
  exists,
  gte,
  isNotNull,
  isNull,
  lt,
  notExists,
  or,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "./db";
import {
  pushSubscriptions,
  transactions,
  users,
} from "@shared/schema-runtime";
import type { GlobalMessagePushAudience } from "@shared/global-message-audiences";

function completedTransactionExists(): SQL {
  return exists(
    db.select({ id: transactions.id })
      .from(transactions)
      .where(and(
        eq(transactions.userId, users.id),
        eq(transactions.status, "completed"),
      )),
  );
}

function frequentTransactionExists(): SQL {
  return exists(
    db.select({ userId: transactions.userId })
      .from(transactions)
      .where(and(
        eq(transactions.userId, users.id),
        eq(transactions.status, "completed"),
      ))
      .groupBy(transactions.userId)
      .having(gte(count(), 10)),
  );
}

function audienceSpecificCondition(audience: GlobalMessagePushAudience): SQL | null {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  switch (audience) {
    case "all_active":
      return null;
    case "kyc_verified":
      return or(eq(users.kycStatus, "verified"), eq(users.isVerified, true))!;
    case "kyc_not_submitted":
      return and(
        or(eq(users.kycStatus, "not_submitted"), isNull(users.kycStatus)),
        or(eq(users.isVerified, false), isNull(users.isVerified)),
      )!;
    case "kyc_pending":
      return eq(users.kycStatus, "pending");
    case "kyc_rejected":
      return eq(users.kycStatus, "rejected");
    case "direct_api_active":
      return and(
        eq(users.apiEnabled, true),
        or(isNotNull(users.apiKeyHash), isNotNull(users.apiKey)),
      )!;
    case "direct_api_disabled":
      return or(eq(users.apiEnabled, false), isNull(users.apiEnabled))!;
    case "has_completed_transaction":
      return completedTransactionExists();
    case "no_completed_transaction":
      return notExists(
        db.select({ id: transactions.id })
          .from(transactions)
          .where(and(
            eq(transactions.userId, users.id),
            eq(transactions.status, "completed"),
          )),
      );
    case "frequent_transactions":
      return frequentTransactionExists();
    case "new_accounts_30_days":
      return gte(users.createdAt, thirtyDaysAgo);
    case "recently_active_30_days":
      return or(
        gte(users.lastSeenAt, thirtyDaysAgo),
        gte(users.lastLoginAt, thirtyDaysAgo),
      )!;
    case "inactive_30_days":
      return and(
        or(isNull(users.lastSeenAt), lt(users.lastSeenAt, thirtyDaysAgo)),
        or(isNull(users.lastLoginAt), lt(users.lastLoginAt, thirtyDaysAgo)),
      )!;
    case "suspended_accounts":
      return eq(users.isBanned, true);
  }
}

function audienceCondition(audience: GlobalMessagePushAudience): SQL {
  const conditions: SQL[] = [
    eq(users.role, "user"),
    audience === "suspended_accounts"
      ? eq(users.isBanned, true)
      : or(eq(users.isBanned, false), isNull(users.isBanned))!,
  ];
  const specificCondition = audienceSpecificCondition(audience);
  if (specificCondition) conditions.push(specificCondition);
  return and(...conditions)!;
}

function safeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function getGlobalMessagePushAudienceStats(
  audience: GlobalMessagePushAudience,
): Promise<{
  targetAccounts: number;
  subscribedAccounts: number;
  subscribedDevices: number;
}> {
  const condition = audienceCondition(audience);
  const [accountRows, subscriberRows, deviceRows] = await Promise.all([
    db.select({ total: count() }).from(users).where(condition),
    db.selectDistinct({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .innerJoin(users, eq(pushSubscriptions.userId, users.id))
      .where(condition),
    db.select({ total: count() })
      .from(pushSubscriptions)
      .innerJoin(users, eq(pushSubscriptions.userId, users.id))
      .where(condition),
  ]);

  return {
    targetAccounts: safeCount(accountRows[0]?.total),
    subscribedAccounts: subscriberRows.length,
    subscribedDevices: safeCount(deviceRows[0]?.total),
  };
}

export async function getGlobalMessagePushRecipientIds(
  audience: GlobalMessagePushAudience,
): Promise<string[]> {
  const rows = await db.selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .innerJoin(users, eq(pushSubscriptions.userId, users.id))
    .where(audienceCondition(audience));
  return rows.map(({ userId }) => userId);
}
