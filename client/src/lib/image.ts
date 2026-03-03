export function getImageSrc(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("/uploads/")) return pathOrUrl;
  return `/api/image-proxy?path=${encodeURIComponent(pathOrUrl)}`;
}
