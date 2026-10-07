import {
  and,
  asc,
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
import type { AdminPushCampaignSegment } from "@shared/push-campaigns";

function completedTransactionExists() {
  return exists(
    db.select({ id: transactions.id })
      .from(transactions)
      .where(and(
        eq(transactions.userId, users.id),
        eq(transactions.status, "completed"),
      )),
  );
}

function atLeastTenCompletedTransactionsExists() {
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

function segmentCondition(segment: AdminPushCampaignSegment): SQL {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  switch (segment) {
    case "all_active":
      return and(
        or(eq(users.isBanned, false), isNull(users.isBanned)),
      )!;
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
    case "kyc_verified_no_transactions":
      return and(
        or(eq(users.kycStatus, "verified"), eq(users.isVerified, true)),
        notExists(
          db.select({ id: transactions.id })
            .from(transactions)
            .where(and(
              eq(transactions.userId, users.id),
              eq(transactions.status, "completed"),
            )),
        ),
      )!;
    case "direct_api_active":
      return and(
        eq(users.apiEnabled, true),
        or(isNotNull(users.apiKeyHash), isNotNull(users.apiKey)),
      )!;
    case "direct_api_enabled_no_key":
      return and(
        eq(users.apiEnabled, true),
        isNull(users.apiKeyHash),
        isNull(users.apiKey),
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
      return atLeastTenCompletedTransactionsExists();
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

function buildAudienceCondition(
  segment: AdminPushCampaignSegment,
  country?: string | null,
): SQL {
  const conditions: SQL[] = [
    eq(users.role, "user"),
    segment === "suspended_accounts"
      ? eq(users.isBanned, true)
      : or(eq(users.isBanned, false), isNull(users.isBanned))!,
    segmentCondition(segment),
  ];
  const normalizedCountry = country?.trim();
  if (normalizedCountry) conditions.push(eq(users.country, normalizedCountry));
  return and(...conditions)!;
}

function asCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function getPushCampaignAudienceStats(
  segment: AdminPushCampaignSegment,
  country?: string | null,
): Promise<{
  targetAccounts: number;
  subscribedAccounts: number;
  subscribedDevices: number;
}> {
  const condition = buildAudienceCondition(segment, country);
  const [accountRows, subscribedAccountRows, deviceRows] = await Promise.all([
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
    targetAccounts: asCount(accountRows[0]?.total),
    subscribedAccounts: subscribedAccountRows.length,
    subscribedDevices: asCount(deviceRows[0]?.total),
  };
}

export async function getPushCampaignRecipientUserIds(
  segment: AdminPushCampaignSegment,
  country?: string | null,
): Promise<string[]> {
  const rows = await db.selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .innerJoin(users, eq(pushSubscriptions.userId, users.id))
    .where(buildAudienceCondition(segment, country));
  return rows.map(({ userId }) => userId);
}

export async function getPushCampaignCountries(): Promise<string[]> {
  const rows = await db.selectDistinct({ country: users.country })
    .from(users)
    .where(and(
      eq(users.role, "user"),
      isNotNull(users.country),
    ))
    .orderBy(asc(users.country));

  return rows
    .map(({ country }) => country?.trim() || "")
    .filter((country): country is string => country.length > 0);
}
