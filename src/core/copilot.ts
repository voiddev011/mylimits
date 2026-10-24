import type { Snapshot } from "./engine";
import { object } from "../providers/parsers";
// Verify these plan allowances against GitHub's current Copilot plan page before release.
export const COPILOT_PLANS = { Free: 50, Pro: 300, "Pro+": 1500 } as const;
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
