import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_PUSH_BODY_MAX_LENGTH,
  ADMIN_PUSH_CAMPAIGN_SEGMENTS,
  ADMIN_PUSH_TITLE_MAX_LENGTH,
  ADMIN_PUSH_URL_MAX_LENGTH,
  isAdminPushCampaignSegment,
  normalizeAdminPushUrl,
} from "../shared/push-campaigns";

test("admin push campaigns expose the expected customer segments", () => {
  const values = ADMIN_PUSH_CAMPAIGN_SEGMENTS.map((segment) => segment.value);
  assert.ok(values.includes("all_active"));
  assert.ok(values.includes("kyc_verified"));
  assert.ok(values.includes("direct_api_active"));
  assert.ok(values.includes("no_completed_transaction"));
  assert.ok(values.includes("suspended_accounts"));
  assert.equal(new Set(values).size, values.length);
});

test("admin push segment validation rejects unknown values", () => {
  assert.equal(isAdminPushCampaignSegment("kyc_pending"), true);
  assert.equal(isAdminPushCampaignSegment("all-customers"), false);
  assert.equal(isAdminPushCampaignSegment(undefined), false);
});

test("admin push links are restricted to same-site paths", () => {
  assert.equal(
    normalizeAdminPushUrl("/dashboard/notifications?tab=all#recent"),
    "/dashboard/notifications?tab=all#recent",
  );
  assert.equal(normalizeAdminPushUrl(""), "/dashboard/notifications");
  assert.equal(normalizeAdminPushUrl("https://example.com"), null);
  assert.equal(normalizeAdminPushUrl("//example.com/path"), null);
  assert.equal(normalizeAdminPushUrl("/\\example.com"), null);
  assert.equal(normalizeAdminPushUrl(`/${"a".repeat(ADMIN_PUSH_URL_MAX_LENGTH)}`), null);
});

test("push title and body limits fit the admin form contract", () => {
  assert.equal(ADMIN_PUSH_TITLE_MAX_LENGTH, 80);
  assert.equal(ADMIN_PUSH_BODY_MAX_LENGTH, 240);
});
