import type { Meter } from "./model";
export interface DisplayMeter {
  meter: Meter;
  projected: boolean;
  label: string | null;
}
/** Display only: never pass this copy to persistence, history or alert collection. */
export function projectRememberedReset(
  meter: Meter,
  remembered: boolean,
  now: number,
): DisplayMeter {
  if (
    !remembered ||
    meter.evidence !== "reported" ||
    meter.resetsAt === null ||
    meter.resetsAt > now
  )
    return { meter, projected: false, label: null };
  return {
    meter: {
      ...meter,
      usedPercent: 0,
      used: 0,
      remaining: meter.total ?? null,
      evidence: "estimated",
    },
    projected: true,
    label: "Reset · full limit available",
  };
}
