/** Omitted values preserve existing settings; null clears a deposit override. */
export function hasSupportedOperatorProviders(input: Record<string, unknown>): boolean {
  const supported = (value: unknown) => value === "afribapay" || value === "pixpay";
  return (input.paymentProvider === undefined || supported(input.paymentProvider)) &&
    (input.depositPaymentProvider === undefined || input.depositPaymentProvider === null ||
      supported(input.depositPaymentProvider));
}
