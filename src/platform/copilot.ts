import {
  copilotIdentity,
  parseCopilot,
  parseCopilotCredits,
  parseCopilotQuotas,
} from "../core/copilot";
import type { Snapshot } from "../core/engine";
import { AdapterError, retryTime } from "../providers/errors";
export async function readCopilot(
  token: string,
  allowance: number | null,
  now: number,
  request: (url: string, options: RequestInit) => Promise<Response>,
  signal?: AbortSignal,
  quotaAccess = false,
): Promise<Snapshot> {
  async function get(path: string) {
    let response: Response;
    try {
      response = await request(`https://api.github.com${path}`, {
        method: "GET",
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.any([
          ...(signal ? [signal] : []),
          AbortSignal.timeout(12000),
        ]),
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
        },
      });
    } catch {
      throw new AdapterError("offline", "GitHub API could not be reached.");
    }
    const retry = retryTime(response.headers.get("retry-after"), now),
      reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
    if (response.status === 401)
      throw new AdapterError(
        "signed-out",
        "Token expired or revoked, paste a new one",
        null,
        "copilot-auth",
      );
    if (
      response.status === 429 ||
      response.headers.get("x-ratelimit-remaining") === "0" ||
      (response.status === 403 && retry !== null)
    )
      throw new AdapterError(
        "error",
        "GitHub API rate limit reached.",
        Math.max(now + 900000, retry ?? 0, Number.isFinite(reset) ? reset : 0),
        "rate-limit",
      );
    if (response.status === 403 || response.status === 404)
      throw new AdapterError(
        "unavailable",
        path === "/copilot_internal/user"
          ? "GitHub denied experimental quota access for this token. Billing access does not grant IDE quota access."
          : "Billing reports require Plan: read and an eligible personally purchased plan. Free quotas are not supplied by billing.",
        null,
        "copilot-permission",
      );
    if (!response.ok)
      throw new AdapterError("unavailable", "GitHub API request failed.");
    try {
      return await response.json();
    } catch {
      throw new AdapterError(
        "unavailable",
        "GitHub API returned an invalid response.",
      );
    }
  }
  try {
    const who = copilotIdentity(await get("/user"));
    if (quotaAccess) {
      const snapshot = parseCopilotQuotas(
        who,
        await get("/copilot_internal/user"),
      );
      const checked = copilotIdentity(await get("/user"));
      if (
        checked.id !== who.id ||
        checked.login.toLowerCase() !== who.login.toLowerCase()
      )
        throw Error("identity changed");
      return snapshot;
    }
    const d = new Date(now);
    const period = `year=${d.getUTCFullYear()}&month=${d.getUTCMonth() + 1}`;
    const prefix = `/users/${encodeURIComponent(who.login)}/settings/billing`;
    const credits = parseCopilotCredits(
      who,
      await get(`${prefix}/ai_credit/usage?${period}`),
      now,
    );
    let snapshot = credits;
    if (credits.meters[0]!.used === null) {
      const rawLegacy = await get(
        `${prefix}/premium_request/usage?${period}&product=Copilot`,
      );
      const legacy = parseCopilot(who, rawLegacy, now, allowance);
      // Only a report containing actual legacy usage establishes a usable legacy source.
      // An empty billing report must never masquerade as zero Free-plan usage.
      if (
        (rawLegacy as { usageItems: { product: string }[] }).usageItems.some(
          (item) => item.product.toLowerCase() === "copilot",
        )
      )
        snapshot = legacy;
    }
    const checked = copilotIdentity(await get("/user"));
    if (
      checked.id !== who.id ||
      checked.login.toLowerCase() !== who.login.toLowerCase()
    )
      throw Error("identity changed");
    return snapshot;
  } catch (e) {
    if (e instanceof AdapterError) throw e;
    throw new AdapterError(
      "unavailable",
      "GitHub account or usage response could not be verified.",
    );
  }
}
