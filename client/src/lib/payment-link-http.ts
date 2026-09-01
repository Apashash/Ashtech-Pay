/**
 * Helpers shared by the public payment-link checkout.
 *
 * Public checkout requests can fail before a Response exists (for example,
 * Safari reports this as "Load failed"). Keep that browser-specific wording
 * out of the payment UI and provide a useful, stable message instead.
 */
export function normalizePaymentLinkRequestError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message;
    if (
      error instanceof TypeError ||
      error.name === "AbortError" ||
      /load failed|failed to fetch|network\s*error|networkerror/i.test(message)
    ) {
      return new Error(
        error.name === "AbortError"
          ? "La demande a peut-être déjà été enregistrée. Attendez la mise à jour du statut avant de recommencer."
          : "Impossible de joindre le serveur de paiement. Vérifiez votre connexion puis réessayez.",
      );
    }
    return error;
  }

  return new Error(
    "Impossible de joindre le serveur de paiement. Vérifiez votre connexion puis réessayez.",
  );
}

/**
 * Parse a successful payment-link response without assuming that the server
 * always sent JSON. This prevents a blank/HTML proxy response from becoming
 * an opaque browser JSON parsing error.
 */
export async function parsePaymentLinkJson<T>(
  response: Response,
  emptyResponseMessage: string,
): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      response.ok
        ? emptyResponseMessage
        : `Le serveur n'a renvoyé aucune réponse (${response.status}).`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok
        ? "Le serveur a renvoyé une réponse invalide. Veuillez réessayer."
        : `Le serveur a renvoyé une réponse inattendue (${response.status}).`,
    );
  }
}