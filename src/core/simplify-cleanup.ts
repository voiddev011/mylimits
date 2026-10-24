import { simplifyStoredState } from "./simplify-state";
const JOURNAL = "mylimits:u1-cleanup:v1",
  DONE = "mylimits:u1-completed:v1";
interface Port {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<unknown>;
  remove(keys: string | string[]): Promise<unknown>;
}
export async function cleanupRetiredState(
  local: Port,
  initialize: () => Promise<void>,
  removeHistory: (ids: string[], sourceIds: string[]) => Promise<void>,
) {
  const saved = await local.get(null);
  if (saved[DONE] === true) {
    await initialize();
    return;
  }
  const removed = new Set<string>(),
    sources = new Set<string>();
  const prior = saved[JOURNAL] as
    { accounts?: unknown; connections?: unknown } | undefined;
  if (prior && Array.isArray(prior.accounts))
    for (const id of prior.accounts)
      if (typeof id === "string") removed.add(id);
  if (prior && Array.isArray(prior.connections))
    for (const id of prior.connections)
      if (typeof id === "string") sources.add(id);
  if (Array.isArray(saved[JOURNAL]))
    for (const id of saved[JOURNAL])
      if (typeof id === "string") removed.add(id);
  for (const key of [
    "mylimits:state:v2",
    "mylimits:state:v1",
    "mylimits:backup:v1",
  ]) {
    const raw = saved[key] as Record<string, unknown> | undefined;
    if (!raw || !Array.isArray(raw.accounts)) continue;
    if (Array.isArray(raw.connections))
      for (const c of raw.connections)
        if (
          c &&
          ([
            "companion",
            "cloud",
            "snapshot-import",
            "independent-local",
          ].includes(c.kind) ||
            ["gemini", "grok", "perplexity"].includes(c.provider))
        )
          sources.add(c.id);
    const next = simplifyStoredState(raw),
      kept = new Set(
        Array.isArray(next.accounts) ? next.accounts.map((a) => a.id) : [],
      );
    for (const a of raw.accounts) if (!kept.has(a.id)) removed.add(a.id);
  }
  await local.set({
    [JOURNAL]: { accounts: [...removed], connections: [...sources] },
  });
  await initialize(); // Validate before deletion; an interrupted cleanup retries its journal.
  await removeHistory([...removed], [...sources]);
  const keys = Object.keys(saved).filter((k) =>
    /^mylimits:(widget|sync|hosted|companion|native|bridge)(:|-|$)/.test(k),
  );
  await local.remove(keys);
  // Legacy recovery copies must not retain deleted accounts either.
  for (const key of ["mylimits:state:v1", "mylimits:backup:v1"]) {
    const raw = saved[key] as Record<string, unknown> | undefined;
    if (raw && Array.isArray(raw.accounts))
      await local.set({
        [key]: {
          ...raw,
          accounts: raw.accounts.filter((a) => !removed.has(a.id)),
        },
      });
  }
  await local.set({ [DONE]: true });
  await local.remove(JOURNAL);
}
