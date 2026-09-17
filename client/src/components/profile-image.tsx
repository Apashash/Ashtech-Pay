import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { DEFAULT_PROFILE_IMAGE, getProfileImageSrc } from "@/lib/profile-image";

type ProfileImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  profileImagePath?: string | null;
};

/**
 * Profile avatars are served through an authenticated proxy. A normal <img>
 * request cannot attach the Bearer header used by mobile/PWA sessions, so
 * fetch the bytes explicitly and expose them through a short-lived object URL.
 */
export function ProfileImage({ profileImagePath, onError, ...props }: ProfileImageProps) {
  const [src, setSrc] = useState(DEFAULT_PROFILE_IMAGE);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const imageUrl = getProfileImageSrc(profileImagePath);

    setSrc(DEFAULT_PROFILE_IMAGE);

    if (!profileImagePath || imageUrl.startsWith("/uploads/")) {
      if (profileImagePath) setSrc(imageUrl);
      return () => {
        active = false;
      };
    }

    const controller = new AbortController();
    fetch(imageUrl, {
      method: "GET",
      credentials: "include",
      headers: getAuthHeaders(),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Profile image request failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        // Keep the default image visible when an old/deleted avatar cannot be
        // loaded. The profile page must never render a broken-image icon.
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profileImagePath]);

  return (
    <img
      {...props}
      src={src}
      onError={(event) => {
        if (src !== DEFAULT_PROFILE_IMAGE) setSrc(DEFAULT_PROFILE_IMAGE);
        onError?.(event);
      }}
    />
  );
}