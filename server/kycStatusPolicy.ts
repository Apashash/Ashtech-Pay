export interface UserKycState {
  kycStatus: "not_submitted" | "pending" | "verified" | "rejected";
  isVerified: boolean;
}

/** Map the latest submitted KYC state to the account-level flags. */
export function userKycStateFromSubmissionStatus(status: unknown): UserKycState | null {
  if (status === "approved") return { kycStatus: "verified", isVerified: true };
  if (status === "pending") return { kycStatus: "pending", isVerified: false };
  if (status === "rejected") return { kycStatus: "rejected", isVerified: false };
  return null;
}

/** Map an admin's account-level choice to the account flags. */
export function userKycStateFromAdminStatus(status: unknown): UserKycState | null {
  if (status === "not_submitted") return { kycStatus: "not_submitted", isVerified: false };
  return userKycStateFromSubmissionStatus(status === "verified" ? "approved" : status);
}

/** Convert account status to the matching persisted dossier status, if any. */
export function submissionStatusFromAdminKycStatus(
  status: unknown,
): "pending" | "approved" | "rejected" | null {
  if (status === "verified") return "approved";
  if (status === "pending" || status === "rejected") return status;
  return null;
}

/**
 * Reconcile stale account flags without allowing an approved historical dossier
 * to undo an explicit non-verified account status.
 */
export function userKycStateForProfile(
  currentStatus: string,
  currentIsVerified: boolean,
  latestSubmissionStatus: unknown,
): UserKycState | null {
  if (currentStatus === "not_submitted") {
    return currentIsVerified ? { kycStatus: "not_submitted", isVerified: false } : null;
  }

  const latestState = userKycStateFromSubmissionStatus(latestSubmissionStatus);
  if (!latestState) return null;

  if (
    latestState.kycStatus === "verified" &&
    (currentStatus === "pending" || currentStatus === "rejected")
  ) {
    return currentIsVerified
      ? { kycStatus: currentStatus, isVerified: false }
      : null;
  }

  return latestState;
}
