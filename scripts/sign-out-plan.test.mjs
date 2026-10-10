import assert from "node:assert/strict";
import { test } from "node:test";
import { SIGN_OUT_TIMEOUT_MS, runSignOut, settleWithin } from "./sign-out-plan.mjs";

/** Records the order of side effects so each test can assert on it. */
function recorder(requestSignOut) {
  const calls = [];
  return {
    calls,
    steps: {
      requestSignOut: () => {
        calls.push("request");
        return requestSignOut();
      },
      clearToken: () => calls.push("clear"),
      redirect: () => calls.push("redirect"),
    },
  };
}

test("a confirmed sign-out clears the token, then redirects", async () => {
  const { calls, steps } = recorder(() => Promise.resolve());
  await runSignOut(steps);
  assert.deepEqual(calls, ["request", "clear", "redirect"]);
});

test("a rejected sign-out throws and does NOT redirect", async () => {
  const { calls, steps } = recorder(() => Promise.reject(new Error("500")));
  await assert.rejects(runSignOut(steps), /Sign-out failed/);
  assert.deepEqual(calls, ["request"]);
});

test("a sign-out that throws synchronously is reported as failed", async () => {
  const { calls, steps } = recorder(() => {
    throw new Error("boom");
  });
  await assert.rejects(runSignOut(steps), /Sign-out failed/);
  assert.deepEqual(calls, ["request"]);
});

test("a sign-out that never settles times out and does NOT redirect", async () => {
  const { calls, steps } = recorder(() => new Promise(() => {}));
  await assert.rejects(runSignOut({ ...steps, timeoutMs: 20 }), /timed out/);
  assert.deepEqual(calls, ["request"]);
});

test("settleWithin reports the outcome and never rejects", async () => {
  assert.equal(await settleWithin(() => Promise.resolve(), 50), "ok");
  assert.equal(await settleWithin(() => Promise.reject(new Error("x")), 50), "failed");
  assert.equal(await settleWithin(() => new Promise(() => {}), 20), "timeout");
});

test("the default wait is bounded", () => {
  assert.ok(SIGN_OUT_TIMEOUT_MS > 0 && SIGN_OUT_TIMEOUT_MS <= 30_000);
});
