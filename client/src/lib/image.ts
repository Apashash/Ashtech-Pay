export function getImageSrc(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (pathOrUrl.startsWith("/uploads/")) return pathOrUrl;
  if (pathOrUrl.startsWith("private-kyc/")) {
    return `/api/image-proxy?path=${encodeURIComponent(pathOrUrl)}`;
  }

  // For Supabase storage paths (e.g. "payment-links/xxx.jpg", "kyc/xxx.jpg")
  // Use /api/img (no auth required) — redirects to Supabase public CDN URL.
  return `/api/img?path=${encodeURIComponent(pathOrUrl)}`;
}
