/**
 * Builds a single QR payload for a crypto deposit.
 *
 * The address is always displayed separately. A memo/tag is included in the
 * QR only when the chain has a known URI format; this avoids the previous
 * duplicate `data=` query parameter that made QR readers ignore the memo.
 */
export function cryptoQrPayload(
  assetCode: string,
  address: string,
  memo: string | null | undefined,
  memoType: string | null | undefined,
): string {
  if (!memo) return address;
  const asset = assetCode.toUpperCase();
  const encodedMemo = encodeURIComponent(memo);

  if (memoType === "tag" || asset === "XRP") {
    return `xrpl:${address}?dt=${encodedMemo}`;
  }
  if (asset === "XLM") {
    return `web+stellar:pay?destination=${encodeURIComponent(address)}&memo=${encodedMemo}`;
  }
  if (asset === "TON" || asset.endsWith(".TON") || asset === "DOGS.TON") {
    return `ton://transfer/${address}?text=${encodedMemo}`;
  }
  // Unknown network formats must not invent a URI. The memo remains visible
  // and copyable as a separate field beside the address.
  return address;
}