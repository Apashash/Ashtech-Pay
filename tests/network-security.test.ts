import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateOrReservedIp, isSafeWebhookDestination } from "../server/networkSecurity";

test("IP address checks reject private, reserved, and IPv4-mapped private addresses", () => {
  for (const address of [
    "0.0.0.0",
    "10.0.0.8",
    "127.0.0.1",
    "169.254.10.1",
    "172.16.0.1",
    "192.0.2.1",
    "192.168.1.1",
    "224.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:192.168.1.1",
  ]) {
    assert.equal(isPrivateOrReservedIp(address), true, `expected private/reserved classification for ${address}`);
  }

  for (const address of [
    "1.1.1.1",
    "8.8.8.8",
    "172.15.255.255",
    "2606:4700:4700::1111",
    "::ffff:1.1.1.1",
    "not-an-ip",
  ]) {
    assert.equal(isPrivateOrReservedIp(address), false, `expected public/invalid classification for ${address}`);
  }
});

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