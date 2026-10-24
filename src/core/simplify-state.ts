// Compatibility boundary: only explicitly retired data is dropped before validation.
const retiredProviders = new Set(["gemini", "grok", "perplexity"]);
const retiredKinds = new Set([
  "companion",
  "cloud",
  "snapshot-import",
  "independent-local",
]);
const retiredId = (id: unknown) =>
  typeof id === "string" &&
  /^(cloud|companion|snapshot-import|independent-local):/.test(id);
export function simplifyStoredState(raw: Record<string, unknown>) {
  const removed = new Set<string>(),
    removedSources = new Set<string>();
  if (Array.isArray(raw.accounts))
    for (const a of raw.accounts)
      if (
        a &&
        (retiredProviders.has(a.provider) ||
          a.companionProfile ||
          retiredId(a.id))
      )
        removed.add(a.id);
  const connections = Array.isArray(raw.connections)
    ? raw.connections.filter((c) => {
        const drop =
          c && (retiredProviders.has(c.provider) || retiredKinds.has(c.kind));
        if (drop) {
          removedSources.add(c.id);
          if (c.accountId) removed.add(c.accountId);
        }
        return !drop;
      })
    : raw.connections;
  return {
    ...raw,
    accounts: Array.isArray(raw.accounts)
      ? raw.accounts.filter((a) => !a || !removed.has(a.id))
      : raw.accounts,
    connections: Array.isArray(connections)
      ? connections.map((c) =>
          c && removed.has(c.accountId)
            ? { ...c, accountId: null, enabled: false, status: "disabled" }
            : c,
        )
      : connections,
    providers:
      raw.providers && typeof raw.providers === "object"
        ? Object.fromEntries(
            Object.entries(raw.providers).filter(
              ([p]) => !retiredProviders.has(p),
            ),
          )
        : raw.providers,
    snapshots: Array.isArray(raw.snapshots)
      ? raw.snapshots.filter(
          (s) =>
            !s ||
            (!retiredProviders.has(s.providerId) &&
              !removed.has(s.accountId) &&
              !retiredId(s.connectionId) &&
              !removedSources.has(s.connectionId)),
        )
      : raw.snapshots,
    workspaces: Array.isArray(raw.workspaces)
      ? raw.workspaces.filter((w) => !w || !retiredProviders.has(w.provider))
      : raw.workspaces,
    accountSetup:
      raw.accountSetup &&
      typeof raw.accountSetup === "object" &&
      retiredProviders.has((raw.accountSetup as { provider: string }).provider)
        ? null
        : raw.accountSetup,
    alertLedger:
      raw.alertLedger && typeof raw.alertLedger === "object"
        ? Object.fromEntries(
            Object.entries(raw.alertLedger).filter(
              ([key]) => ![...removed].some((id) => key.startsWith(`${id}/`)),
            ),
          )
        : raw.alertLedger,
    resetLedger:
      raw.resetLedger && typeof raw.resetLedger === "object"
        ? Object.fromEntries(
            Object.entries(raw.resetLedger).filter(
              ([key]) => ![...removed].some((id) => key.startsWith(`${id}/`)),
            ),
          )
        : raw.resetLedger,
  };
}
