import type { Response } from "express";

// Keep scanner/probe responses branded and HTML-based without importing the
// database-backed bot guard into the early Passenger startup path.
export const CLEAN_404_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>404 - Page non trouvée | AshTech Pay</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #0B0E11;
    color: #EAECEF;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
  }
  .card { max-width: 420px; }
  .code {
    font-size: 72px;
    font-weight: 800;
    color: #F0B90B;
    line-height: 1;
    margin-bottom: 12px;
  }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
  p { color: #848E9C; font-size: 14px; margin-bottom: 24px; }
  a {
    display: inline-block;
    background: #F0B90B;
    color: #0B0E11;
    text-decoration: none;
    font-weight: 600;
    padding: 10px 24px;
    border-radius: 8px;
    font-size: 14px;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="code">404</div>
    <h1>Page non trouvée</h1>
    <p>La page que vous recherchez n'existe pas ou a été déplacée.</p>
    <a href="/">Retour à l'accueil</a>
  </div>
</body>
</html>`;

export function sendClean404(res: Response): void {
  res.status(404).set("Content-Type", "text/html; charset=utf-8").send(CLEAN_404_HTML);
}