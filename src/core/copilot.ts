import type { Snapshot } from "./engine";
import { object } from "../providers/parsers";
// Verify these plan allowances against GitHub's current Copilot plan page before release.
export const COPILOT_PLANS = { Pro: 300, "Pro+": 1500 } as const;
export function copilotIdentity(raw: unknown) {
  const a = object(raw);
  if (
    !Number.isSafeInteger(a.id) ||
    Number(a.id) <= 0 ||
    typeof a.login !== "string" ||
    !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(a.login)
  )
    throw Error("GitHub identity could not be verified.");
  return { id: String(a.id), login: a.login };
}
export function parseCopilot(
  identity: { id: string; login: string },
  raw: unknown,
  now: number,
  allowance: number | null,
): Snapshot {
  const r = object(raw),
    period = object(r.timePeriod),
    date = new Date(now);
  if (
    !Array.isArray(r.usageItems) ||
    period.year !== date.getUTCFullYear() ||
    (period.month !== undefined && period.month !== date.getUTCMonth() + 1) ||
    typeof r.user !== "string" ||
    r.user.toLowerCase() !== identity.login.toLowerCase()
  )
    throw Error("GitHub usage response could not be verified.");
  let used = 0;
  for (const item of r.usageItems) {
    const row = object(item);
    if (typeof row.product !== "string") throw Error("Invalid usage item.");
    if (row.product.toLowerCase() !== "copilot") continue;
    if (
      row.unitType !== "requests" ||
      typeof row.grossQuantity !== "number" ||
      !Number.isFinite(row.grossQuantity) ||
      row.grossQuantity < 0
    )
      throw Error("Invalid Copilot request quantity.");
    used += row.grossQuantity;
    if (!Number.isFinite(used))
      throw Error("Invalid Copilot request quantity.");
  }
  if (allowance !== null && (!Number.isFinite(allowance) || allowance <= 0))
    throw Error("Choose a valid Copilot allowance.");
  return {
    identity: identity.id,
    kind: "account",
    displayName: `GitHub Copilot · ${identity.login}`,
    plan: allowance === null ? null : `${allowance} requests/month`,
    meters: [
      {
        id: "premium-requests",
        label: "Premium requests",
        scope: "subscription",
        evidence: "reported",
        unit: "requests",
        used,
        total: allowance,
        usedPercent:
          allowance === null ? null : Math.min(1000, (used / allowance) * 100),
        remaining: allowance === null ? null : Math.max(0, allowance - used),
        resetsAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
        windowId: `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`,
        source:
          "GitHub official REST API gross Copilot premium-request quantity; allowance chosen by user",
      },
    ],
  };
}

/** Current billing reports count AI credits, not legacy premium requests.
 * An empty report does not establish eligibility or a zero Free-plan quota. */
export function parseCopilotCredits(
  identity: { id: string; login: string },
  raw: unknown,
  now: number,
): Snapshot {
  const r = object(raw),
    period = object(r.timePeriod),
    date = new Date(now);
  if (
    !Array.isArray(r.usageItems) ||
    period.year !== date.getUTCFullYear() ||
    (period.month !== undefined && period.month !== date.getUTCMonth() + 1) ||
    typeof r.user !== "string" ||
    r.user.toLowerCase() !== identity.login.toLowerCase()
  )
    throw Error("GitHub usage response could not be verified.");
  let used: number | null = null;
  for (const item of r.usageItems) {
    const row = object(item);
    if (typeof row.product !== "string") throw Error("Invalid usage item.");
    if (row.product.toLowerCase() !== "copilot ai credits") continue;
    if (
      row.unitType !== "ai-credits" ||
      typeof row.grossQuantity !== "number" ||
      !Number.isFinite(row.grossQuantity) ||
      row.grossQuantity < 0
    )
      throw Error("Invalid Copilot credit quantity.");
    used = (used ?? 0) + row.grossQuantity;
    if (!Number.isFinite(used)) throw Error("Invalid Copilot credit quantity.");
  }
  return {
    identity: identity.id,
    kind: "account",
    displayName: `GitHub Copilot · ${identity.login}`,
    plan: null,
    meters: [
      {
        id: "ai-credits",
        label: "Credits",
        scope: "subscription",
        evidence: "reported",
        unit: "credits",
        used,
        total: null,
        remaining: null,
        usedPercent: null,
        resetsAt: null,
        windowId: `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`,
        source:
          used === null
            ? "No eligible billing data. Not a zero quota. Free-plan credits and suggestions are not supplied by this API."
            : "GitHub official AI credit billing report; total allowance and inline suggestions are not supplied by this report.",
      },
    ],
  };
}

/** Experimental first-party IDE entitlement response; not a public REST contract.
 * No invented quotas: absent/malformed fields remain unknown or fail closed. */
export function parseCopilotQuotas(
  identity: { id: string; login: string },
  raw: unknown,
): Snapshot {
  const r = object(raw);
  if (
    (r.id !== undefined && String(r.id) !== identity.id) ||
    (r.login !== undefined &&
      (typeof r.login !== "string" ||
        r.login.toLowerCase() !== identity.login.toLowerCase()))
  )
    throw Error("GitHub quota identity does not match.");
  const quantity = (v: unknown): number | null => {
    if (
      typeof v !== "number" &&
      !(typeof v === "string" && /^\d+(\.\d+)?$/.test(v))
    )
      return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const resetTime = (v: unknown): number | null => {
    const n =
      typeof v === "string"
        ? Date.parse(v)
        : typeof v === "number"
          ? v < 1e12
            ? v * 1000
            : v
          : NaN;
    return Number.isFinite(n) && n > 0 && n <= 8.64e15 ? n : null;
  };
  const reset = resetTime(
    r.quota_reset_date_utc ?? r.quota_reset_date ?? r.limited_user_reset_date,
  );
  const snapshots = object(r.quota_snapshots);
  const meters: Snapshot["meters"] = [];
  for (const [key, label] of [
    ["chat", r.token_based_billing === true ? "Credits" : "Chat"],
    ["completions", "Inline suggestions"],
    [
      "premium_interactions",
      r.token_based_billing === true ? "Premium credits" : "Premium requests",
    ],
  ] as const) {
    const q = object(snapshots[key]);
    if (!Object.keys(q).length) continue;
    const unlimited = q.unlimited === true;
    const entitlement = quantity(q.entitlement);
    if (!unlimited && entitlement === 0) continue;
    const total = unlimited ? null : entitlement;
    const remaining = unlimited ? null : quantity(q.quota_remaining);
    const percent = unlimited ? null : quantity(q.percent_remaining);
    if (percent !== null && percent > 100)
      throw Error("Invalid quota percentage.");
    const credits = quantity(q.credits_used);
    const used = unlimited
      ? null
      : (credits ??
        (total !== null && remaining !== null
          ? Math.max(0, total - remaining)
          : null));
    meters.push({
      id: `quota-${key}`,
      label,
      scope: "subscription",
      evidence: "reported",
      unit:
        r.token_based_billing === true && key !== "completions"
          ? "credits"
          : "requests",
      unlimited,
      total,
      used,
      remaining,
      usedPercent:
        percent !== null
          ? 100 - percent
          : total !== null && used !== null
            ? Math.min(1000, (used / total) * 100)
            : null,
      resetsAt: resetTime(q.quota_reset_at) ?? reset,
      source:
        "GitHub account entitlement (experimental, undocumented IDE endpoint); provider-reported quota.",
    });
  }
  // Older Free accounts report remaining chat/completion quantities separately.
  for (const [key, label] of [
    ["chat", "Chat"],
    ["completions", "Inline suggestions"],
  ] as const) {
    if (meters.some((m) => m.id === `quota-${key}`)) continue;
    const total = quantity(object(r.monthly_quotas)[key]);
    const remaining = quantity(object(r.limited_user_quotas)[key]);
    if (total === null || total === 0 || remaining === null) continue;
    const used = Math.max(0, total - remaining);
    meters.push({
      id: `quota-${key}`,
      label,
      scope: "subscription",
      evidence: "reported",
      unit: "requests",
      total,
      used,
      remaining,
      usedPercent: Math.min(1000, (used / total) * 100),
      resetsAt: reset,
      source:
        "GitHub account entitlement (experimental); legacy Free quota reported by provider.",
    });
  }
  if (!meters.length) throw Error("No account quotas returned.");
  return {
    identity: identity.id,
    kind: "account",
    displayName: `GitHub Copilot · ${identity.login}`,
    plan:
      typeof r.copilot_plan === "string" ? r.copilot_plan.slice(0, 120) : null,
    meters,
  };
}
