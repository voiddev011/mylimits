import type { ProviderId } from "./model";
/** ChatGPT saved sign-in is an explicitly enabled experiment; other providers stay off. */
export const VAULT_POLICY: Readonly<
  Record<ProviderId, "off" | "experimental">
> = Object.freeze({
  claude: "off",
  chatgpt: "experimental",
  cursor: "off",
  copilot: "off",
});
/** Must come from E3, never guessed from fixtures or provider branding. */
const empty: readonly string[] = Object.freeze([]);
export const VAULT_COOKIE_ALLOWLIST: Readonly<
  Record<ProviderId, readonly string[]>
> = Object.freeze({
  claude: empty,
  chatgpt: Object.freeze([
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.session-token.0",
    "__Secure-next-auth.session-token.1",
  ]),
  cursor: empty,
  copilot: empty,
});
export function vaultEnabled(provider: ProviderId) {
  return (
    VAULT_POLICY[provider] === "experimental" &&
    VAULT_COOKIE_ALLOWLIST[provider].length > 0
  );
}
