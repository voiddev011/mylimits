import test from "node:test";
import assert from "node:assert/strict";
import { readJsonResponse } from "./response";
import { responseError } from "./errors";

test("HTML success and Cloudflare 403 challenges preserve status without attempting quota JSON parsing", async () => {
  for (const [status, type, mitigated] of [
    [200, "text/html; charset=UTF-8", ""],
    [403, "application/json", "challenge"],
    [403, "application/xhtml+xml", ""],
  ] as const) {
    const response = new Response("<html>PRIVATE_PAGE</html>", {
      status,
      headers: { "content-type": type, "cf-mitigated": mitigated },
    });
    const result = await readJsonResponse(response);
    assert.equal(result.status, status);
    assert.equal(result.body, null);
    assert.equal(response.bodyUsed, false);
    const error = responseError(result, "Claude")!;
    assert.equal(error.status, "waiting-for-tab");
    assert.equal(error.code, "challenge");
    assert.ok(!error.message.includes("PRIVATE_PAGE"));
  }
});
test("JSON sign-out, provider denial and throttling remain different even when rate limits use an HTML page", async () => {
  for (const [status, expected, code] of [
    [401, "signed-out", "signed-out"],
    [403, "unavailable", "unavailable"],
    [429, "error", "rate-limit"],
  ] as const) {
    const response = new Response("SECRET", {
      status,
      headers: {
        "content-type": status === 429 ? "text/html" : "application/json",
        "retry-after": "120",
      },
    });
    const error = responseError(
      await readJsonResponse(response),
      "ChatGPT",
      1000,
    )!;
    assert.equal(error.status, expected);
    assert.equal(error.code, code);
    if (status === 429) assert.equal(error.retryAt, 121000);
  }
});
test("valid JSON is returned unchanged and malformed JSON never becomes a fake network status or quota", async () => {
  const valid = await readJsonResponse(
    new Response('{"used_percent":0}', {
      headers: { "content-type": "application/json" },
    }),
  );
  assert.deepEqual(valid.body, { used_percent: 0 });
  assert.equal(responseError(valid, "Claude"), null);
  const invalid = await readJsonResponse(
    new Response("MALFORMED_SECRET", {
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(invalid.status, 200);
  assert.equal(invalid.parseFailed, true);
  assert.equal(invalid.body, null);
  assert.equal(responseError(invalid, "Claude")!.code, "shape");
  assert.ok(
    !responseError(invalid, "Claude")!.message.includes("MALFORMED_SECRET"),
  );
});
