import { copilotIdentity, parseCopilot } from "../core/copilot";
import type { Snapshot } from "../core/engine";
import { AdapterError, retryTime } from "../providers/errors";
export async function readCopilot(
  token: string,
  allowance: number | null,
  now: number,
  request: (url: string, options: RequestInit) => Promise<Response>,
  signal?: AbortSignal,
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
          "X-GitHub-Api-Version": "2022-11-28",
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
        "A fine-grained token with the Plan: read user permission is required.",
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
    const who = copilotIdentity(await get("/user")),
      d = new Date(now),
      usage = await get(
        `/users/${encodeURIComponent(who.login)}/settings/billing/premium_request/usage?year=${d.getUTCFullYear()}&month=${d.getUTCMonth() + 1}&product=Copilot`,
      ),
      checked = copilotIdentity(await get("/user"));
    if (
      checked.id !== who.id ||
      checked.login.toLowerCase() !== who.login.toLowerCase()
    )
      throw Error("identity changed");
    return parseCopilot(who, usage, now, allowance);
  } catch (e) {
    if (e instanceof AdapterError) throw e;
    throw new AdapterError(
      "unavailable",
      "GitHub account or usage response could not be verified.",
    );
  }
}
