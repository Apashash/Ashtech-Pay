declare global {
  interface Window {
    __ADMIN_PATH__?: string;
  }
}

export function getAdminPath(): string {
  return window.__ADMIN_PATH__ || "/admin";
}
