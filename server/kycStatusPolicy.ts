export interface UserKycState {
  kycStatus: "pending" | "verified" | "rejected";
  isVerified: boolean;
}

/** Map the latest submitted KYC state to the account-level flags. */
export function userKycStateFromSubmissionStatus(status: unknown): UserKycState | null {
  if (status === "approved") return { kycStatus: "verified", isVerified: true };
  if (status === "pending") return { kycStatus: "pending", isVerified: false };
  if (status === "rejected") return { kycStatus: "rejected", isVerified: false };
  return null;
}
