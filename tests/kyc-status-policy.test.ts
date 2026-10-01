import assert from "node:assert/strict";
import test from "node:test";
import {
  submissionStatusFromAdminKycStatus,
  userKycStateForProfile,
  userKycStateFromAdminStatus,
  userKycStateFromSubmissionStatus,
} from "../server/kycStatusPolicy.ts";

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

test("admin status changes keep account flags and the latest dossier aligned", () => {
  assert.deepEqual(userKycStateFromAdminStatus("rejected"), {
    kycStatus: "rejected",
    isVerified: false,
  });
  assert.equal(submissionStatusFromAdminKycStatus("rejected"), "rejected");
  assert.deepEqual(userKycStateFromAdminStatus("not_submitted"), {
    kycStatus: "not_submitted",
    isVerified: false,
  });
  assert.equal(submissionStatusFromAdminKycStatus("not_submitted"), null);
});

test("an approved historical dossier cannot reactivate a rejected account", () => {
  assert.equal(userKycStateForProfile("rejected", false, "approved"), null);
  assert.deepEqual(userKycStateForProfile("rejected", true, "approved"), {
    kycStatus: "rejected",
    isVerified: false,
  });
  assert.equal(userKycStateForProfile("not_submitted", false, "approved"), null);
  assert.deepEqual(userKycStateForProfile("verified", false, "approved"), {
    kycStatus: "verified",
    isVerified: true,
  });
  assert.deepEqual(userKycStateForProfile("verified", true, "rejected"), {
    kycStatus: "rejected",
    isVerified: false,
  });
});
