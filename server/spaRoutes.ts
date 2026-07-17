/**
 * spaRoutes.ts — Liste des préfixes de routes SPA connues.
 *
 * Utilisé par le catch-all Express (static.ts) et le catch-all Vite (vite.ts)
 * pour répondre HTTP 200 sur les vraies routes et HTTP 404 sur les autres.
 *
 * ⚠️ Mettre à jour cette liste à chaque ajout d'une nouvelle route
 *    de premier niveau dans client/src/App.tsx.
 *
 * Pourquoi : une SPA renvoie normalement 200 + index.html pour TOUS les
 * chemins, y compris /webadmin, /config.json, /package.json…
 * Les scanners de sécurité interprètent ces 200 comme des "endpoints
 * existants" et génèrent des faux positifs. En renvoyant 404 pour les
 * chemins inconnus (tout en servant quand même index.html pour que React
 * affiche sa page d'erreur), on supprime ces faux positifs sans rien casser.
 */

const KNOWN_PREFIXES = [
  "/docs",
  "/blocked",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/dashboard",
  "/hpay",
  "/pay",
  "/checkout",
  "/admin-panel-verify",
  "/admin-login-otp",
  // Chemin admin secret — doit correspondre à ADMIN_PATH dans client/src/lib/adminPath.ts
  "/Ashtech76638393947vdkdbdozyzujebfkdbdj",
];

/**
 * Renvoie true si le chemin correspond à une vraie route React.
 * Renvoie false pour tout chemin inconnu (probe de scanner, page inexistante).
 */
export function isSpaRoute(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  return KNOWN_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(prefix + "/")
  );
}
