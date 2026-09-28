import test from "node:test";
import assert from "node:assert/strict";
import { isSafeWebhookDestination } from "../server/networkSecurity";

test("webhook destination validation rejects non-HTTPS and private targets", async () => {
  for (const url of [
    "http://example.com/webhook",
    "https://localhost/webhook",
    "https://127.0.0.1/webhook",
    "https://10.0.0.8/webhook",
    "https://[::1]/webhook",
    "https://user:pass@example.com/webhook",
    "not a URL",
  ]) {
    assert.equal(await isSafeWebhookDestination(url), false, `expected rejection for ${url}`);
  }
  assert.equal(await isSafeWebhookDestination(null), false);
  assert.equal(await isSafeWebhookDestination(42), false);
});