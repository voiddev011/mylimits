import test from "node:test";
import assert from "node:assert/strict";
import { parseClaude, parseChatGPT } from "./parsers";
import { providerForUrl } from "./catalog";

const account = { uuid: "fixture-user" };
const organization = {
  uuid: "fixture-org",
  name: "Personal",
  rate_limit_tier: "default_claude_pro",
};
test("Claude legacy readings preserve zero usage, real reset timestamps and model scope", () => {
  const result = parseClaude(account, organization, {
    five_hour: { utilization: 0, resets_at: "2026-10-14T15:00:00Z" },
    seven_day: { utilization: 82, resets_at: null },
    seven_day_sonnet: { utilization: 25 },
  });
  assert.equal(result.meters.length, 3);
  assert.equal(result.meters[0]!.usedPercent, 0);
  assert.equal(result.meters[0]!.resetsAt, Date.parse("2026-10-14T15:00:00Z"));
  assert.equal(result.plan, "pro");
  assert.equal(result.identity, "fixture-user:fixture-org");
});
test("Claude normalized limits use provider model labels and do not double count legacy fields", () => {
  const result = parseClaude(account, organization, {
    limits: [
      { kind: "session", percent: 20 },
      {
        kind: "weekly_model",
        percent: 40,
        scope: { model: { display_name: "Sonnet" } },
      },
    ],
    five_hour: { utilization: 20 },
  });
  assert.equal(result.meters.length, 2);
  assert.equal(result.meters[1]!.label, "Weekly · Sonnet");
});
test("Claude empty or malformed quota fields produce no invented allowance", () => {
  const result = parseClaude(account, organization, {
    five_hour: null,
    seven_day: { utilization: "25" },
    limits: [],
  });
  assert.equal(result.meters.length, 0);
  assert.throws(() => parseClaude({}, organization, {}), /identity/);
});
test("private account email is not included in the persisted display name", () => {
  const result = parseClaude(
    account,
    { ...organization, name: "sample@example.invalid" },
    {},
  );
  assert.equal(result.displayName, "Claude account");
});
test("ChatGPT readings remain explicitly Work/Codex and preserve monthly windows", () => {
  const result = parseChatGPT(
    { user: { id: "fixture-user" }, accessToken: "fictional-test-value" },
    {
      plan_type: "free",
      account_id: "fixture-workspace",
      rate_limit: {
        primary_window: {
          used_percent: 0,
          limit_window_seconds: 2592000,
          reset_at: 1790000000,
        },
        secondary_window: null,
      },
    },
  );
  assert.equal(result.meters.length, 1);
  assert.equal(result.meters[0]!.scope, "work-codex");
  assert.equal(result.meters[0]!.label, "Work / Codex · Monthly");
  assert.equal(result.meters[0]!.resetsAt, 1790000000000);
  assert.ok(!JSON.stringify(result).includes("fictional-test-value"));
});
test("ChatGPT window parsing uses actual durations, not a universal five-hour assumption", () => {
  const result = parseChatGPT(
    { user: { id: "user" } },
    {
      rate_limit: {
        primary_window: { used_percent: 30, limit_window_seconds: 10800 },
        secondary_window: { used_percent: 60, limit_window_seconds: 604800 },
      },
    },
  );
  assert.equal(result.meters[0]!.label, "Work / Codex · 3 hours");
  assert.equal(result.meters[1]!.label, "Work / Codex · Weekly");
  assert.equal(result.meters[0]!.resetsAt, null);
});
test("ChatGPT unknown shapes stay unavailable and unknown identities are rejected", () => {
  assert.equal(
    parseChatGPT(
      { user: { id: "user" } },
      { rate_limit: { primary_window: { used_percent: "30" } } },
    ).meters.length,
    0,
  );
  assert.throws(() => parseChatGPT({}, {}), /identity/);
});
test("website matching uses exact HTTPS origins, rejecting lookalikes and insecure sites", () => {
  assert.equal(providerForUrl("https://claude.ai/new"), "claude");
  assert.equal(providerForUrl("https://chatgpt.com/codex"), "chatgpt");
  assert.equal(providerForUrl("https://claude.ai.evil.invalid/"), null);
  assert.equal(
    providerForUrl("https://evil.invalid/?site=https://claude.ai"),
    null,
  );
  assert.equal(providerForUrl("http://claude.ai/"), null);
  assert.equal(providerForUrl("not-a-url"), null);
});
