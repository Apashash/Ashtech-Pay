export type TransactionStatusCategory =
  | "completed"
  | "pending"
  | "processing"
  | "failed"
  | "cancelled"
  | "unknown";

export function getTransactionStatusCategory(status: string | null | undefined): TransactionStatusCategory {
  switch (String(status || "").trim().toLowerCase()) {
    case "completed":
    case "success":
    case "succeeded":
      return "completed";
    case "pending":
    case "pending_manual":
      return "pending";
    case "processing":
      return "processing";
    case "failed":
    case "rejected":
    case "declined":
    case "refunded":
    case "error":
      return "failed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "unknown";
  }
}

export function isTransactionCompletedStatus(status: string | null | undefined): boolean {
  return getTransactionStatusCategory(status) === "completed";
}

export function isTransactionPendingStatus(status: string | null | undefined): boolean {
  return getTransactionStatusCategory(status) === "pending";
}

export function isTransactionOpenStatus(status: string | null | undefined): boolean {
  const category = getTransactionStatusCategory(status);
  return category === "pending" || category === "processing";
}