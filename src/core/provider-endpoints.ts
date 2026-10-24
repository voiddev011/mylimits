import type { ProviderId } from "./model";
/** Fixed reader endpoints only. No arbitrary URL, query, login/logout or model prompt. */
export function providerEndpointAllowed(
  provider: ProviderId,
  path: string,
): boolean {
  const paths: Partial<Record<ProviderId, string[]>> = {
    chatgpt: ["/api/auth/session", "/backend-api/wham/usage"],
    claude: ["/api/account", "/api/organizations"],
    cursor: ["/api/auth/me", "/api/usage-summary"],
  };
  return (
    paths[provider]?.includes(path) === true ||
    (provider === "claude" &&
      /^\/api\/organizations\/[A-Za-z0-9_-]{1,180}\/usage$/.test(path))
  );
}
