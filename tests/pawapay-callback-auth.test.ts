import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { verifyPawaPayCallbackToken, pawaPayCallbackUrlTemplate } from "../server/pawapayCallbackAuth";
import { hasSupportedOperatorProviders } from "../server/operatorProviderPolicy";
import { parsePawaPayCallback, isPawaPayUuidV4, verifyPawaPayCallbackSignature } from "../server/pawapay";

const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
const start = routes.indexOf("  async function handlePawaPayCallback(");
const end = routes.indexOf('  app.post("/api/pawapay/deposit-callback"', start);
assert.ok(start >= 0 && end > start);
const handlerCode = ts.transpileModule(routes.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(secret: unknown = "test-callback-secret") {
  const calls = { reads: 0, updates: 0, deposits: 0, payouts: 0 };
  let transaction: any = {
    id: "internal-id", externalReference: "550e8400-e29b-41d4-a716-446655440000",
    status: "pending", type: "deposit",
  };
  const deps = {
    getPawaPayWebhookSecret: async () => secret,
    verifyPawaPayCallbackToken, parsePawaPayCallback, isPawaPayUuidV4,
    verifyPawaPayCallbackSignature,
    process: { env: {} as Record<string, string> },
    console: { error() {} },
    db: { select() {
      calls.reads++;
      return { from: () => ({ where: () => ({ limit: async () => transaction ? [transaction] : [] }) }) };
    } },
    transactionsTable: { externalReference: "externalReference" },
    eq: () => true,
    storage: { updateTransaction: async () => { calls.updates++; } },
    buildProviderErrorPayload: () => ({ message: "Payment failed" }),
    processPawaPayDepositCallback: async () => { calls.deposits++; },
    processPawaPayPayoutCallback: async () => { calls.payouts++; },
  };
  const handler = new Function(...Object.keys(deps), `${handlerCode}; return handlePawaPayCallback;`)(...Object.values(deps));
  return {
    calls, env: deps.process.env,
    setTransaction(value: any) { transaction = value; },
    async send(direction = "deposit", token: unknown = undefined, status = "COMPLETED", header = false) {
      let httpStatus = 200;
      const req = {
        query: header || token === undefined ? {} : { token },
        headers: header ? { "x-webhook-token": token } : {},
        body: { [direction === "deposit" ? "depositId" : "payoutId"]: "550e8400-e29b-41d4-a716-446655440000", status },
      };
      const res = { status(code: number) { httpStatus = code; return this; }, json() { return this; } };
      await handler(req, res, direction);
      return httpStatus;
    },
  };
}

test("token comparison rejects missing, empty, incorrect and non-scalar values", () => {
  for (const secret of [undefined, null, "", "   "]) {
    assert.equal(verifyPawaPayCallbackToken(secret, "anything"), false);
  }
  for (const token of [undefined, null, "", "wrong", ["secret"], { token: "secret" }, 123]) {
    assert.equal(verifyPawaPayCallbackToken("secret", token), false);
  }
  assert.equal(verifyPawaPayCallbackToken("secret", "secreT"), false);
  assert.equal(verifyPawaPayCallbackToken("secret", "secret"), true);
});

test("forged terminal callbacks cannot read or mutate financial state with legacy flags unset or false", async () => {
  for (const flag of [undefined, "false", "true"]) {
    for (const direction of ["deposit", "payout"]) {
      for (const status of ["COMPLETED", "FAILED"]) {
        for (const token of [undefined, "", "wrong", ["test-callback-secret"], { value: "test-callback-secret" }]) {
          const h = harness();
          if (flag !== undefined) h.env.PAWAPAY_REQUIRE_CALLBACK_TOKEN = flag;
          assert.equal(await h.send(direction, token, status), 401);
          assert.deepEqual(h.calls, { reads: 0, updates: 0, deposits: 0, payouts: 0 });
        }
      }
    }
  }
});

test("absent server secret fails closed even when a token is supplied", async () => {
  const h = harness(null);
  assert.equal(await h.send("deposit", "test-callback-secret"), 401);
  assert.equal(h.calls.reads, 0);
});

test("valid query/header tokens allow authenticated deposits and payouts", async () => {
  for (const header of [false, true]) {
    for (const direction of ["deposit", "payout"]) {
      for (const status of ["COMPLETED", "FAILED"]) {
        const h = harness();
        if (direction === "payout") h.setTransaction({ id: "payout", type: "withdrawal", status: "processing" });
        assert.equal(await h.send(direction, "test-callback-secret", status, header), 200);
        assert.equal(h.calls.deposits, direction === "deposit" ? 1 : 0);
        assert.equal(h.calls.payouts, direction === "payout" ? 1 : 0);
      }
    }
  }
});

test("signature-required mode still fails closed without a configured verifier", async () => {
  const h = harness();
  h.env.PAWAPAY_REQUIRE_SIGNED_CALLBACKS = "true";
  assert.equal(await h.send("deposit", "test-callback-secret"), 401);
  assert.equal(h.calls.reads, 0);
});

test("authenticated pending, unknown, wrong-direction and settled callbacks do not settle", async () => {
  const pending = harness();
  assert.equal(await pending.send("deposit", "test-callback-secret", "ACCEPTED"), 200);
  assert.equal(pending.calls.reads, 0);
  for (const transaction of [null, { type: "withdrawal", status: "pending" }, { type: "deposit", status: "completed" }]) {
    const h = harness();
    h.setTransaction(transaction);
    assert.equal(await h.send("deposit", "test-callback-secret"), 200);
    assert.equal(h.calls.deposits + h.calls.payouts + h.calls.updates, 0);
  }
});

test("admin provider routes reject retired PawaPay before updating operators", async () => {
  for (const [route, field] of [["provider", "paymentProvider"], ["deposit-provider", "depositPaymentProvider"]]) {
    const marker = `app.patch("/api/admin/operators/:id/${route}", requireAuth, requireAdmin, async (req, res) => {`;
    const start = routes.indexOf(marker);
    const end = routes.indexOf("\n  });", start);
    assert.ok(start >= 0 && end > start);
    const body = routes.slice(start + marker.length, end);
    const code = ts.transpileModule(`async function handler(req, res) {${body}\n}`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const handler = new Function(`${code}; return handler;`)();
    let status = 200;
    const res = { status(value: number) { status = value; return this; }, json() { return this; } };
    await handler({ params: { id: "operator" }, body: { [field]: "pawapay" } }, res);
    assert.equal(status, 400);
  }
});

test("all generic operator writes reject retired providers before storage access", async () => {
  for (const marker of [
    'app.post("/api/admin/operators", requireAuth, requireAdmin, async (req, res) => {',
    'app.patch("/api/admin/operators/:id", requireAuth, requireAdmin, async (req, res) => {',
  ]) {
    const start = routes.indexOf(marker);
    const end = routes.indexOf("\n  });", start);
    assert.ok(start >= 0 && end > start);
    const code = ts.transpileModule(`async function handler(req, res) {${routes.slice(start + marker.length, end)}\n}`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const handler = new Function("hasSupportedOperatorProviders", `${code}; return handler;`)(hasSupportedOperatorProviders);
    for (const field of ["paymentProvider", "depositPaymentProvider"]) {
      for (const value of ["pawapay", "PAWAPAY", "unknown", ["pawapay"]]) {
        let status = 200;
        const res = { status(value: number) { status = value; return this; }, json() { return this; } };
        await handler({ params: { id: "operator" }, body: { [field]: value } }, res);
        assert.equal(status, 400);
      }
    }
  }
  assert.equal(hasSupportedOperatorProviders({}), true);
  assert.equal(hasSupportedOperatorProviders({ paymentProvider: "afribapay", depositPaymentProvider: "pixpay" }), true);
  assert.equal(hasSupportedOperatorProviders({ depositPaymentProvider: null }), true);
});

test("documented callback URL template authenticates when privately completed, never embeds a secret", async () => {
  const secret = "test secret/+?&=123456";
  for (const direction of ["deposit", "payout"]) {
    const template = pawaPayCallbackUrlTemplate(`https://example.test/api/pawapay/${direction}-callback`);
    assert.equal(template.includes(secret), false);
    const h = harness(secret);
    if (direction === "payout") h.setTransaction({ id: "payout", type: "withdrawal", status: "pending" });
    const incompleteToken = new URL(template).searchParams.get("token");
    assert.equal(await h.send(direction, incompleteToken), 401);
    const configured = template.replace("REPLACE_WITH_URL_ENCODED_CALLBACK_SECRET", encodeURIComponent(secret));
    assert.equal(await h.send(direction, new URL(configured).searchParams.get("token")), 200);
    assert.equal(h.calls.deposits + h.calls.payouts, 1);
  }
});
