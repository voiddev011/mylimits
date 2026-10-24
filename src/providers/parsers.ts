import type { Meter } from "../core/model";
import type { Snapshot } from "../core/engine";

type Obj = Record<string, unknown>;
export function object(value: unknown): Obj {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 120)
    : null;
}
function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
function reset(value: unknown): number | null {
  if (typeof value === "string") {
    const result = Date.parse(value);
    return Number.isFinite(result) && result > 0 ? result : null;
  }
  const result = number(value);
  return result === null || result === 0
    ? null
    : result < 1e12
      ? result * 1000
      : result;
}
function percentMeter(
  id: string,
  label: string,
  scope: Meter["scope"],
  percent: unknown,
  resets: unknown,
  source: string,
): Meter | null {
  const usedPercent = number(percent);
  if (usedPercent === null || usedPercent > 1000) return null;
  return {
    id,
    label,
    scope,
    evidence: "reported",
    usedPercent,
    used: null,
    total: null,
    unit: "percent",
    resetsAt: reset(resets),
    source,
  };
}

export function parseClaude(
  accountData: unknown,
  organizationData: unknown,
  usageData: unknown,
): Snapshot {
  const account = object(accountData);
  const organization = object(organizationData);
  const usage = object(usageData);
  const userId =
    text(account.uuid) ??
    text(account.id) ??
    text(object(account.account).uuid);
  const organizationId = text(organization.uuid);
  if (!userId || !organizationId)
    throw new Error("Claude account identity could not be verified.");
  const meters: Meter[] = [];
  if (Array.isArray(usage.limits) && usage.limits.length) {
    for (const raw of usage.limits) {
      const item = object(raw);
      const kind = text(item.kind) ?? text(item.group);
      if (!kind) continue;
      const model = text(object(object(item.scope).model).display_name);
      const label =
        kind === "session"
          ? "Session"
          : kind === "weekly_all"
            ? "Weekly · all models"
            : model
              ? `Weekly · ${model}`
              : kind.replaceAll("_", " ");
      const meter = percentMeter(
        `claude:${kind}${model ? `:${model}` : ""}`,
        label,
        "subscription",
        item.percent,
        item.resets_at,
        "Claude account usage service",
      );
      if (meter) meters.push(meter);
    }
  } else {
    for (const [key, label] of [
      ["five_hour", "Session · 5 hours"],
      ["seven_day", "Weekly · all models"],
      ["seven_day_opus", "Weekly · Opus"],
      ["seven_day_sonnet", "Weekly · Sonnet"],
    ]) {
      const window = object(usage[key!]);
      const meter = percentMeter(
        `claude:${key}`,
        label!,
        "subscription",
        window.utilization,
        window.resets_at,
        "Claude account usage service",
      );
      if (meter) meters.push(meter);
    }
  }
  const extra = object(usage.extra_usage);
  if (extra.is_enabled === true) {
    const meter = percentMeter(
      "claude:extra",
      "Extra usage budget",
      "subscription",
      extra.utilization,
      extra.resets_at,
      "Claude extra usage service",
    );
    if (meter) meters.push(meter);
  }
  const rawTier = text(organization.rate_limit_tier);
  const plan = rawTier
    ? rawTier.replace(/^default_claude_/, "").replaceAll("_", " ")
    : null;
  const workspace = text(organization.name);
  return {
    identity: `${userId}:${organizationId}`,
    kind: "account",
    displayName:
      workspace && !workspace.includes("@")
        ? `Claude · ${workspace}`.slice(0, 120)
        : "Claude account",
    plan,
    meters,
  };
}

function windowLabel(seconds: unknown): string {
  const duration = number(seconds);
  if (duration === null || duration === 0) return "Allowance";
  if (duration >= 26 * 86400) return "Monthly";
  if (duration >= 6 * 86400) return "Weekly";
  if (duration >= 86400) return `${Math.round(duration / 86400)} days`;
  return `${Math.round((duration / 3600) * 10) / 10} hours`;
}

export function parseChatGPT(
  sessionData: unknown,
  usageData: unknown,
): Snapshot {
  const session = object(sessionData);
  const user = object(session.user);
  const usage = object(usageData);
  const userId = text(user.id) ?? text(user.email);
  if (!userId)
    throw new Error("ChatGPT account identity could not be verified.");
  const meters: Meter[] = [];
  for (const [poolId, poolLabel] of [
    ["rate_limit", "Work / Codex"],
    ["code_review_rate_limit", "Code review"],
  ]) {
    const pool = object(usage[poolId!]);
    for (const windowId of ["primary_window", "secondary_window"]) {
      const window = object(pool[windowId]);
      const meter = percentMeter(
        `chatgpt:${poolId}:${windowId}`,
        `${poolLabel} · ${windowLabel(window.limit_window_seconds)}`,
        "work-codex",
        window.used_percent,
        window.reset_at,
        "ChatGPT Work / Codex usage service",
      );
      if (meter) meters.push(meter);
    }
  }
  // No conversion from Work/Codex percentages to ordinary chat message limits.
  return {
    identity: `${userId}:${text(usage.account_id) ?? text(usage.accountId) ?? "default"}`,
    kind: "account",
    displayName: "ChatGPT account",
    plan: text(usage.plan_type),
    meters,
  };
}
