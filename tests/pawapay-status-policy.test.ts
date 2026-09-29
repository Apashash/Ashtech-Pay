import assert from "node:assert/strict";
import test from "node:test";
import {
  getPawaPayDeposit,
  getPawaPayPayout,
  normalizePawaPayStatus,
} from "../server/pawapay.ts";

test("PawaPay 404 and NOT_FOUND status reads remain pending and repeat reads are cached", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.PAWAPAY_API_TOKEN;
  const depositId = "5c0cbb4b-8961-45d5-8948-aa7ad7f42c66";
  const payoutId = "5c0cbb4b-8961-45d5-8948-aa7ad7f42c67";
  const terminalDepositId = "5c0cbb4b-8961-45d5-8948-aa7ad7f42c68";
  const requests: string[] = [];

  process.env.PAWAPAY_API_TOKEN = "test-token";
  globalThis.fetch = (async (url: string | URL | Request) => {
    const requestUrl = String(url);
    requests.push(requestUrl);
    if (requestUrl.endsWith(`/deposits/${terminalDepositId}`)) {
      return new Response(JSON.stringify({
        status: "FAILED",
        depositId: terminalDepositId,
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      status: "FAILED",
      message: "not found",
    }), { status: 404 });
  }) as typeof fetch;

  try {
    const deposit = await getPawaPayDeposit(depositId);
    const repeatedDeposit = await getPawaPayDeposit(depositId);
    const payout = await getPawaPayPayout(payoutId);
    const terminalDeposit = await getPawaPayDeposit(terminalDepositId);

    assert.equal(deposit.status, "pending");
    assert.equal(repeatedDeposit.status, "pending");
    assert.equal(payout.status, "pending");
    assert.equal(terminalDeposit.status, "failed");
    assert.equal(deposit.providerStatus, 404);
    assert.equal(requests.filter(url => url.endsWith(`/deposits/${depositId}`)).length, 1);
    assert.equal(requests.filter(url => url.endsWith(`/payouts/${payoutId}`)).length, 1);
    assert.equal(requests.filter(url => url.endsWith(`/deposits/${terminalDepositId}`)).length, 1);
    assert.equal(normalizePawaPayStatus("NOT_FOUND"), "pending");
    assert.equal(normalizePawaPayStatus("ERROR"), "pending");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.PAWAPAY_API_TOKEN;
    else process.env.PAWAPAY_API_TOKEN = originalToken;
  }
});