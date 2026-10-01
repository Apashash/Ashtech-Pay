import assert from "node:assert/strict";
import test from "node:test";
import { userKycStateFromSubmissionStatus } from "../server/kycStatusPolicy.ts";

test("KYC submission states keep account verification flags synchronized", () => {
  assert.deepEqual(userKycStateFromSubmissionStatus("approved"), {
    kycStatus: "verified",
    isVerified: true,
  });
  assert.deepEqual(userKycStateFromSubmissionStatus("pending"), {
    kycStatus: "pending",
    isVerified: false,
  });
  assert.deepEqual(userKycStateFromSubmissionStatus("rejected"), {
    kycStatus: "rejected",
    isVerified: false,
  });
  assert.equal(userKycStateFromSubmissionStatus("unknown"), null);
});
