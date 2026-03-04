export function getImageSrc(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (pathOrUrl.startsWith("/uploads/")) return pathOrUrl;

  // For Supabase storage paths (e.g. "payment-links/xxx.jpg", "kyc/xxx.jpg")
  return `/api/image-proxy?path=${encodeURIComponent(pathOrUrl)}`;
}
