import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePaymentLinkRequestError,
  parsePaymentLinkJson,
} from "../client/src/lib/payment-link-http.ts";

test("normalizes Safari's opaque Load failed network error", () => {
  const error = normalizePaymentLinkRequestError(new TypeError("Load failed"));

  assert.equal(
    error.message,
    "Impossible de joindre le serveur de paiement. Vérifiez votre connexion puis réessayez.",
  );
});

test("reports a payment request timeout instead of leaving the button pending", () => {
  const error = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });

  assert.equal(
    normalizePaymentLinkRequestError(error).message,
    "Le serveur de paiement met trop de temps à répondre. Veuillez réessayer.",
  );
});

test("preserves structured provider errors", () => {
  const error = new Error("Solde insuffisant") as Error & { provider_code: string };
  error.provider_code = "OPERATOR_PAYER_INSUFF_BALANCE";

  assert.equal(normalizePaymentLinkRequestError(error), error);
  assert.equal((normalizePaymentLinkRequestError(error) as typeof error).provider_code, error.provider_code);
});

test("reports an empty successful response instead of failing on response.json", async () => {
  await assert.rejects(
    parsePaymentLinkJson(new Response("", { status: 200 }), "Réponse vide"),
    { message: "Réponse vide" },
  );
});

test("reports a non-JSON successful response clearly", async () => {
  await assert.rejects(
    parsePaymentLinkJson(new Response("<html>proxy</html>", { status: 200 }), "Réponse vide"),
    { message: "Le serveur a renvoyé une réponse invalide. Veuillez réessayer." },
  );
});