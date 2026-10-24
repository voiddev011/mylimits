import type { Account, Meter, Settings } from "./model";
export function isQuiet(settings: Settings, now: number): boolean {
  const q = settings.quietHours;
  if (!q?.enabled) return false;
  const minutes = (v: string) =>
    Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  const start = minutes(q.start),
    end = minutes(q.end),
    date = new Date(now),
    current = date.getHours() * 60 + date.getMinutes();
  if (start === end) return false;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}
export function alertKey(account: Account, meter: Meter): string {
  return `${account.id}/${account.workspaceId ?? "legacy"}/${meter.scope}/${meter.id}`;
}
export interface ResetReading {
  window: string | null;
  resetsAt: number | null;
  observedAt: number;
  usedPercent: number | null;
}
export function confirmedReset(
  before: ResetReading | undefined,
  next: ResetReading,
): boolean {
  return (
    !!before &&
    before.resetsAt !== null &&
    next.resetsAt !== null &&
    next.resetsAt > before.resetsAt &&
    next.observedAt >= before.resetsAt &&
    next.observedAt > before.observedAt &&
    before.usedPercent !== null &&
    next.usedPercent !== null &&
    next.usedPercent <= before.usedPercent
  );
}
