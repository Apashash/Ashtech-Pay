import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { encryptField, hmacField, hmacFieldCandidates } from "../server/fieldEncryption";
import { resolveStoredDirectApiKey } from "../server/directApiKey";

test("preserves existing Direct API keys when their encrypted value cannot be read", () => {
  const previousKey = process.env.FIELD_ENCRYPTION_KEY;
  const previousPreviousKey = process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;

  try {
    delete process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;
    process.env.FIELD_ENCRYPTION_KEY = "direct-api-key-test-key-one";

    assert.deepEqual(resolveStoredDirectApiKey(null, null), { kind: "missing" });
    assert.deepEqual(resolveStoredDirectApiKey(null, "existing-hmac"), { kind: "unavailable" });
    assert.deepEqual(resolveStoredDirectApiKey("ak_legacy_plaintext", null), {
      kind: "ready",
      apiKey: "ak_legacy_plaintext",
    });

    const encrypted = encryptField("ak_encrypted_existing");
    const oldHash = hmacField("ak_encrypted_existing");
    assert.ok(encrypted);
    assert.ok(oldHash);
    const legacyHash = createHash("sha256")
      .update("ak_encrypted_existing")
      .digest("hex");
    assert.ok(hmacFieldCandidates("ak_encrypted_existing").includes(legacyHash));
    assert.deepEqual(resolveStoredDirectApiKey(encrypted, "existing-hmac"), {
      kind: "ready",
      apiKey: "ak_encrypted_existing",
    });

    process.env.FIELD_ENCRYPTION_KEY = "direct-api-key-test-key-two";
    assert.deepEqual(resolveStoredDirectApiKey(encrypted, "existing-hmac"), { kind: "unavailable" });

    process.env.FIELD_ENCRYPTION_KEY_PREVIOUS = "direct-api-key-test-key-one";
    assert.deepEqual(resolveStoredDirectApiKey(encrypted, "existing-hmac"), {
      kind: "ready",
      apiKey: "ak_encrypted_existing",
    });
    assert.ok(hmacFieldCandidates("ak_encrypted_existing").includes(oldHash));

    delete process.env.FIELD_ENCRYPTION_KEY;
    assert.deepEqual(resolveStoredDirectApiKey(encrypted, "existing-hmac"), {
      kind: "ready",
      apiKey: "ak_encrypted_existing",
    });
    assert.ok(hmacFieldCandidates("ak_encrypted_existing").includes(oldHash));

    process.env.FIELD_ENCRYPTION_KEY_PREVIOUS = "wrong-previous-key-value";
    assert.deepEqual(resolveStoredDirectApiKey(encrypted, "existing-hmac"), { kind: "unavailable" });
  } finally {
    if (previousKey === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = previousKey;
    if (previousPreviousKey === undefined) delete process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;
    else process.env.FIELD_ENCRYPTION_KEY_PREVIOUS = previousPreviousKey;
  }
});
