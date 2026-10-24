import type { HistoryPoint } from "./history-data";
export interface InsightPoint {
  time: number;
  percent: number | null;
  remaining: number | null;
  used: number | null;
}
export type Pacing =
  | { kind: "insufficient"; reason: string }
  | {
      kind: "range";
      lowHours: number;
      highHours: number;
      samples: number;
      spanMinutes: number;
      ratePerHour: number;
    };
export interface InsightSeries {
  key: string;
  accountId: string;
  meterId: string;
  label: string;
  scope: string;
  evidence: string;
  connectionId: string;
  workspaceId: string | null;
  window: string | null;
  resetsAt: number | null;
  unit: string;
  currency: string | null;
  segments: InsightPoint[][];
  samples: number;
  displayedSamples: number;
  pacing: Pacing;
  latest: {
    time: number;
    used: number | null;
    total: number | null;
    remaining: number | null;
    percent: number | null;
  };
}
export interface HistoryInsights {
  series: InsightSeries[];
  timeline: {
    key: string;
    label: string;
    scope: string;
    at: number;
    observedAt: number;
  }[];
  truncated: boolean;
  gaps: number;
}
const valid = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
const quantile = (sorted: number[], q: number) =>
  sorted[Math.floor((sorted.length - 1) * q)]!;
export function pacing(
  points: InsightPoint[],
  options: {
    now: number;
    refreshMinutes: number;
    resetsAt: number | null;
    reported: boolean;
    active: boolean;
  },
): Pacing {
  points = points.slice(-48); // Bound pairwise rate work even with 90-day histories.
  const no = (reason: string): Pacing => ({ kind: "insufficient", reason });
  const last = points.at(-1);
  if (!options.reported || !options.active)
    return no("A currently active reported source is required.");
  if (
    !last ||
    options.now < last.time - 60000 ||
    options.now - last.time > Math.max(15, options.refreshMinutes * 3) * 60000
  )
    return no("The latest reading is stale.");
  if (options.resetsAt === null || options.resetsAt <= options.now)
    return no("A current reported reset window is required.");
  if (last.percent === null || last.percent >= 100)
    return no("No usable percentage headroom was reported.");
  if (points.length < 4) return no("At least four readings are needed.");
  const span = (last.time - points[0]!.time) / 60000;
  if (span < 30) return no("At least 30 minutes of samples are needed.");
  const rates: number[] = [];
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!,
        b = points[j]!,
        hours = (b.time - a.time) / 3600000;
      if (
        hours >= 1 / 12 &&
        a.percent !== null &&
        b.percent !== null &&
        b.percent >= a.percent
      )
        rates.push((b.percent - a.percent) / hours);
    }
  rates.sort((a, b) => a - b);
  if (!rates.length || quantile(rates, 0.25) <= 0)
    return no("Usage is too flat or bursty for a stable range.");
  const median = quantile(rates, 0.5),
    lower = quantile(rates, 0.25),
    upper = quantile(rates, 0.75);
  if (upper > lower * 5) return no("Usage varies too much for a useful range.");
  const left = Math.max(0, 100 - last.percent);
  return {
    kind: "range",
    lowHours: left / (upper * 1.2),
    highHours: left / (lower * 0.8),
    samples: points.length,
    spanMinutes: span,
    ratePerHour: median,
  };
}
export function downsampleSegments(
  segments: InsightPoint[][],
  maxPoints: number,
): InsightPoint[][] {
  const all = segments.flatMap((points, segment) =>
    points.map((point) => ({ point, segment })),
  );
  if (all.length <= maxPoints) return segments;
  // Min/max representatives retain bursts; segment identity prevents joining gaps.
  const chosen = new Set<InsightPoint>();
  const buckets = Math.max(1, Math.floor(maxPoints / 4));
  for (let n = 0; n < buckets; n++) {
    const group = all.slice(
      Math.floor((n * all.length) / buckets),
      Math.floor(((n + 1) * all.length) / buckets),
    );
    if (!group.length) continue;
    chosen.add(group[0]!.point);
    chosen.add(group.at(-1)!.point);
    const values = group.filter((x) => x.point.percent !== null);
    if (values.length) {
      chosen.add(
        values.reduce((a, b) => (a.point.percent! < b.point.percent! ? a : b))
          .point,
      );
      chosen.add(
        values.reduce((a, b) => (a.point.percent! > b.point.percent! ? a : b))
          .point,
      );
    }
  }
  return segments
    .map((s) => s.filter((p) => chosen.has(p)))
    .filter((s) => s.length);
}
export function analyzeHistory(
  points: HistoryPoint[],
  options: {
    now: number;
    refreshMinutes: number;
    activeConnectionIds: string[];
    maxPoints?: number;
    truncated?: boolean;
  },
): HistoryInsights {
  let limited = false;
  const groups = new Map<
    string,
    {
      series: InsightSeries;
      rows: Map<number, { point: InsightPoint; received: number }>;
    }
  >();
  for (const row of points)
    for (const m of row.meters) {
      const time = m.observedAt ?? row.observedAt ?? row.time;
      if (!valid(time) || time > options.now + 60000) continue;
      const connection = m.connectionId ?? row.connectionId ?? "legacy",
        window = m.windowId ?? (m.resetsAt ? String(m.resetsAt) : null),
        scope = m.scope ?? "unknown",
        evidence = m.evidence ?? "legacy";
      const key = JSON.stringify([
        row.accountId,
        connection,
        row.workspaceId ?? null,
        scope,
        m.id,
        window,
        m.currency ?? null,
        m.unit ?? null,
        evidence,
      ]);
      let group = groups.get(key);
      if (!group) {
        if (groups.size >= 256) {
          limited = true;
          continue;
        }
        const empty: InsightSeries = {
          key,
          accountId: row.accountId,
          meterId: m.id,
          label: m.label ?? m.id,
          scope,
          evidence,
          connectionId: connection,
          workspaceId: row.workspaceId ?? null,
          window,
          resetsAt: m.resetsAt ?? null,
          unit: m.unit ?? "percent",
          currency: m.currency ?? null,
          segments: [],
          samples: 0,
          displayedSamples: 0,
          pacing: { kind: "insufficient", reason: "No samples." },
          latest: {
            time: 0,
            used: null,
            total: null,
            remaining: null,
            percent: null,
          },
        };
        group = { series: empty, rows: new Map() };
        groups.set(key, group);
      }
      const point = {
          time,
          percent: valid(m.usedPercent) ? m.usedPercent : null,
          remaining: valid(m.remaining) ? m.remaining : null,
          used: valid(m.used) ? m.used : null,
        },
        received = row.receivedAt ?? time;
      const old = group.rows.get(time);
      if (!old || received >= old.received)
        group.rows.set(time, { point, received });
      if (time >= group.series.latest.time)
        group.series.latest = {
          time,
          used: point.used,
          total: valid(m.total) ? m.total : null,
          remaining: point.remaining,
          percent: point.percent,
        };
    }
  let gaps = 0;
  const series = [...groups.values()]
    .map((g) => {
      const samples = [...g.rows.values()]
          .map((r) => r.point)
          .sort((a, b) => a.time - b.time),
        segments: InsightPoint[][] = [];
      for (const point of samples) {
        const previous = segments.at(-1)?.at(-1),
          gap =
            previous &&
            (point.time - previous.time >
              Math.max(15, options.refreshMinutes * 3) * 60000 ||
              (point.percent !== null &&
                previous.percent !== null &&
                point.percent < previous.percent));
        if (!previous || gap) {
          segments.push([]);
          if (previous) gaps++;
        }
        segments.at(-1)!.push(point);
      }
      const s = g.series;
      s.samples = samples.length;
      s.pacing = pacing(segments.at(-1) ?? [], {
        ...options,
        resetsAt: s.resetsAt,
        reported: s.evidence === "reported",
        active: options.activeConnectionIds.includes(s.connectionId),
      });
      s.segments = downsampleSegments(
        segments,
        Math.max(16, Math.min(300, options.maxPoints ?? 160)),
      );
      s.displayedSamples = s.segments.reduce((n, s) => n + s.length, 0);
      return s;
    })
    .sort((a, b) => b.latest.time - a.latest.time);
  const timeline = series
    .filter((s) => s.resetsAt !== null)
    .map((s) => ({
      key: s.key,
      label: s.label,
      scope: s.scope,
      at: s.resetsAt!,
      observedAt: s.latest.time,
    }))
    .sort((a, b) => a.at - b.at);
  return {
    series: series.slice(0, 32),
    timeline: timeline.slice(-100),
    truncated: !!options.truncated || limited || series.length > 32,
    gaps,
  };
}
