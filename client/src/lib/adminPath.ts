// Secret admin root path — hardcoded (no longer driven by VITE_ADMIN_PATH env
// var or server-side injection). Change this constant to rotate the path.
const ADMIN_PATH = "/Ashtech76638393947vdkdbdozyzujebfkdbdj";

export function getAdminPath(): string {
  return ADMIN_PATH;
}
