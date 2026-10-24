import { useEffect, useRef, useState } from "react";
import type {
  HistoryInsights,
  InsightSeries,
  InsightPoint,
} from "../core/insights";
import { countdown } from "./format";

export function historyLimitName(label: string): string {
  const clean = label
    .replace(/^Work \/ Codex · /, "")
    .replace(/ · all models$/, "");
  if (/^(Session · )?5 hours$|^five_hour$/i.test(clean)) return "5-hour limit";
  if (/^weekly$|^seven_day$/i.test(clean)) return "Weekly limit";
  return clean.replaceAll("_", " ");
}
const percent = (s: InsightSeries, p: InsightPoint): number | null =>
  p.percent ??
  (p.time === s.latest.time &&
  s.latest.used !== null &&
  s.latest.total !== null &&
  s.latest.total > 0
    ? (s.latest.used / s.latest.total) * 100
    : null);
const used = (n: number) => `${Number(n.toFixed(1))} % used`;
const timeText = (time: number) =>
  new Date(time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
function LimitChart({
  series,
  from,
  to,
  now,
}: {
  series: InsightSeries[];
  from: number;
  to: number;
  now: number;
}) {
  const chart = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(600);
  const [hover, setHover] = useState<{ time: number; value: number } | null>(
    null,
  );
  useEffect(() => {
    const node = chart.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(220, node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const current = [...series].sort((a, b) => b.latest.time - a.latest.time)[0]!;
  const label = historyLimitName(current.label),
    left = 44,
    right = width - 12,
    top = 14,
    bottom = 158,
    height = 214;
  const x = (time: number) =>
    left + ((time - from) / Math.max(1, to - from)) * (right - left);
  const y = (value: number) =>
    bottom - (Math.max(0, Math.min(100, value)) / 100) * (bottom - top);
  const lines: { time: number; value: number }[][] = [];
  for (const source of series)
    for (const segment of source.segments) {
      let line: { time: number; value: number }[] = [];
      for (const point of segment) {
        const value = percent(source, point);
        if (value === null || point.time < from || point.time > to) {
          if (line.length) lines.push(line);
          line = [];
          continue;
        }
        line.push({ time: point.time, value });
      }
      if (line.length) lines.push(line);
    }
  const resets = [
    ...new Set(
      series.flatMap((s) =>
        s.resetsAt !== null && s.resetsAt >= from && s.resetsAt <= to
          ? [s.resetsAt]
          : [],
      ),
    ),
  ].sort((a, b) => a - b);
  const latest = percent(current, {
    ...current.latest,
    percent: current.latest.percent,
  });
  const value =
    latest !== null
      ? used(latest)
      : current.latest.used !== null
        ? `${current.latest.used.toLocaleString()}${current.unit === "currency" && current.currency ? ` ${current.currency}` : ""} used`
        : "Usage unavailable";
  const reset =
    current.resetsAt === null
      ? "Reset not reported"
      : current.resetsAt <= now
        ? "Reset time passed"
        : `resets in ${countdown(current.resetsAt, now).replace(/(\d)([dhm])/g, "$1 $2")}`;
  const ticks = width >= 540 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];
  return (
    <section className="history-limit" aria-label={label}>
      <header>
        <h4>{label}</h4>
        <p className="history-current">
          <strong>{value}</strong>
          <span> · {reset}</span>
        </p>
      </header>
      <div
        className="history-plot"
        ref={chart}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          role="group"
          aria-label={`${label} usage over time`}
          viewBox={`0 0 ${width} ${height}`}
        >
          {[0, 50, 100].map((n) => (
            <g key={n}>
              <line
                className="history-gridline"
                x1={left}
                x2={right}
                y1={y(n)}
                y2={y(n)}
              />
              <text
                className="history-axis"
                x={left - 9}
                y={y(n) + 4}
                textAnchor="end"
              >
                {n}%
              </text>
            </g>
          ))}
          {resets.map((time) => (
            <line
              className="history-reset"
              key={time}
              x1={x(time)}
              x2={x(time)}
              y1={top}
              y2={bottom}
              strokeDasharray="4 4"
              aria-label={`Reset ${timeText(time)}`}
            >
              <title>Reset {timeText(time)}</title>
            </line>
          ))}
          {lines.map((line, i) => (
            <g key={i}>
              <polyline
                className="history-line"
                points={line.map((p) => `${x(p.time)},${y(p.value)}`).join(" ")}
                fill="none"
                strokeWidth="2"
              />
              {line.map((p, j) => (
                <g key={j}>
                  <circle
                    className="history-dot"
                    cx={x(p.time)}
                    cy={y(p.value)}
                    r="3"
                  />
                  <circle
                    className="history-hit"
                    cx={x(p.time)}
                    cy={y(p.value)}
                    r="11"
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${timeText(p.time)} · ${used(p.value)}`}
                    onPointerEnter={() => setHover(p)}
                    onClick={() => setHover(p)}
                    onFocus={() => setHover(p)}
                    onBlur={() => setHover(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setHover(p);
                      }
                      if (e.key === "Escape") setHover(null);
                    }}
                  />
                </g>
              ))}
            </g>
          ))}
          {ticks.map((t, i) => {
            const time = from + (to - from) * t;
            return (
              <g key={i}>
                <line
                  className="history-tick"
                  x1={x(time)}
                  x2={x(time)}
                  y1={bottom}
                  y2={bottom + 4}
                />
                <text
                  className="history-axis"
                  x={x(time)}
                  y={184}
                  textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
                >
                  {new Date(time).toLocaleString(
                    undefined,
                    to - from <= 86400000
                      ? { hour: "numeric", minute: "2-digit" }
                      : { month: "short", day: "numeric" },
                  )}
                  {to - from <= 86400000 && i !== Math.floor(ticks.length / 2) && (
                    <tspan x={x(time)} dy={17}>
                      {new Date(time).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </tspan>
                  )}
                </text>
              </g>
            );
          })}
        </svg>
        {hover && (
          <div
            className="history-tooltip"
            role="tooltip"
            style={{
              left: `${Math.min(75, Math.max(25, (x(hover.time) / width) * 100))}%`,
              top: Math.max(0, y(hover.value) - 52),
            }}
          >
            <time>{timeText(hover.time)}</time>
            <strong>{used(hover.value)}</strong>
          </div>
        )}
        {!lines.length && (
          <p className="history-chart-empty">Usage percentage unavailable</p>
        )}
      </div>
    </section>
  );
}
export function HistoryCharts({
  insights,
  names,
  colors,
  from,
  to,
  now,
}: {
  insights: HistoryInsights;
  names: Record<string, string>;
  colors: Record<string, string>;
  from: number;
  to: number;
  now: number;
}) {
  const accounts = new Map<string, Map<string, InsightSeries[]>>();
  for (const series of insights.series) {
    let limits = accounts.get(series.accountId);
    if (!limits) {
      limits = new Map();
      accounts.set(series.accountId, limits);
    }
    const key = JSON.stringify([
      series.meterId,
      series.scope,
      series.unit,
      series.currency,
    ]);
    limits.set(key, [...(limits.get(key) ?? []), series]);
  }
  return (
    <div className="history-cards">
      {insights.truncated && (
        <p className="notice">
          Some older readings aren't shown. Choose a shorter range to see more
          detail.
        </p>
      )}
      {[...accounts]
        .sort(
          ([a], [b]) =>
            Object.keys(names).indexOf(a) - Object.keys(names).indexOf(b),
        )
        .map(([id, limits]) => (
          <article
            className="history-account"
            key={id}
            style={
              {
                "--history-color": colors[id] ?? "var(--accent)",
              } as React.CSSProperties
            }
          >
            <h3>
              <span className="history-account-dot" />
              {names[id] ?? "Account"}
            </h3>
            {[...limits].map(([key, series]) => (
              <LimitChart
                key={key}
                series={series}
                from={from}
                to={to}
                now={now}
              />
            ))}
          </article>
        ))}
    </div>
  );
}
