import defaultProfileImage from "@assets/f37ff271b2ae5859f0720d8bc533dffc_1789091759423.jpg";

export const DEFAULT_PROFILE_IMAGE = defaultProfileImage;

export function getProfileImageSrc(profileImagePath?: string | null): string {
  if (!profileImagePath) return DEFAULT_PROFILE_IMAGE;
  if (profileImagePath.startsWith("/uploads/")) return profileImagePath;
  return `/api/image-proxy?path=${encodeURIComponent(profileImagePath)}`;
}