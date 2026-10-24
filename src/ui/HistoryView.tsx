import { useEffect, useRef, useState } from "react";
import { HistoryCharts, historyLimitName } from "./HistoryCharts";
import type { HistoryInsights, InsightSeries } from "../core/insights";
import { Download, ChevronDown } from "lucide-react";
import { command, type PublicStore } from "../platform/messages";
import { accountName, PROVIDER_IDS } from "../core/model";
import { providers } from "../providers/catalog";
import type { ProviderId } from "../core/model";
import type {
  HistoryCursor,
  HistoryPage,
  HistoryPoint,
} from "../core/history-data";
const DAY = 86400000;
const localDate = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const dateStart = (value: string) => new Date(`${value}T00:00:00`).getTime();
const dateEnd = (value: string) => dateStart(value) + DAY - 1;
const seriesLimitKey = (series: InsightSeries) =>
  JSON.stringify([series.meterId, series.scope, series.unit, series.currency]);
function readingValue(m: HistoryPoint["meters"][number]): string {
  const percent =
    m.usedPercent ??
    (m.used !== null && m.used !== undefined && m.total
      ? (m.used / m.total) * 100
      : null);
  return percent !== null
    ? `${Number(percent.toFixed(1))} % used`
    : m.used !== null && m.used !== undefined
      ? `${m.used.toLocaleString()}${m.currency ? ` ${m.currency}` : ""} used`
      : "Unavailable";
}
export function HistoryView({
  store,
  demo,
}: {
  store: PublicStore;
  demo: boolean;
}) {
  const [id, setId] = useState(""),
    [provider, setProvider] = useState<ProviderId | "all">("all"),
    [limit, setLimit] = useState("all"),
    [customActive, setCustomActive] = useState(false),
    [customDates, setCustomDates] = useState({ from: "", to: "" }),
    [range, setRange] = useState({ days: 7, to: Date.now() });
  const [points, setPoints] = useState<HistoryPoint[]>([]),
    [cursors, setCursors] = useState<Record<string, HistoryCursor>>({});
  const [insights, setInsights] = useState<HistoryInsights | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0),
    [confirm, setConfirm] = useState(false),
    [menu, setMenu] = useState<"download" | "manage" | null>(null);
  const generation = useRef(0),
    privacy = !!store.settings.privacyMode;
  const privateNow = useRef(privacy);
  privateNow.current = privacy;
  const retention = store.settings.historyRetentionDays ?? 30,
    days = Math.min(range.days, retention),
    quickFrom = Math.max(range.to - days * DAY, Date.now() - retention * DAY),
    customFrom = customDates.from || localDate(quickFrom),
    customTo = customDates.to || localDate(range.to),
    from = customActive ? dateStart(customFrom) : quickFrom,
    to = customActive ? Math.min(dateEnd(customTo), Date.now()) : range.to,
    invalidRange = from > to;
  const accountIds = store.accounts.map((a) => a.id).join("|");
  const visibleAccounts = store.accounts.filter(
    (a) => (provider === "all" || a.provider === provider) && (!id || a.id === id),
  );
  const visibleIds = new Set(visibleAccounts.map((a) => a.id));
  const visibleInsights = insights
    ? {
        ...insights,
        series: insights.series.filter(
          (series) =>
            visibleIds.has(series.accountId) &&
            (limit === "all" || seriesLimitKey(series) === limit),
        ),
      }
    : null;
  const limitOptions = [
    ...new Map(
      (insights?.series ?? [])
        .filter((series) => visibleIds.has(series.accountId))
        .map((series) => [seriesLimitKey(series), historyLimitName(series.label)] as const),
    ),
  ];
  const names = Object.fromEntries(
    store.accounts.map((a, i) => [
      a.id,
      privacy ? `Account ${i + 1}` : accountName(a),
    ]),
  );
  useEffect(() => {
    if (id && !store.accounts.some((a) => a.id === id)) setId("");
  }, [accountIds, id]);
  useEffect(() => setLimit("all"), [provider, id]);
  useEffect(() => {
    const stamp = ++generation.current;
    setError("");
    setInsights(null);
    setPoints([]);
    setCursors({});
    setConfirm(false);
    setMenu(null);
    setLoading(false);
    const ids = visibleAccounts.map((a) => a.id);
    if (!ids.length || demo || privacy || invalidRange) return;
    setLoading(true);
    void (async () => {
      const pages: HistoryPoint[] = [],
        next: Record<string, HistoryCursor> = {},
        collected: HistoryInsights = {
          series: [],
          timeline: [],
          truncated: false,
          gaps: 0,
        };
      let failed = false;
      // Bound simultaneous local IDB reads even when many accounts are remembered.
      for (let i = 0; i < ids.length; i += 4) {
        if (stamp !== generation.current) return;
        const results = await Promise.allSettled(
          ids.slice(i, i + 4).map(async (accountId) => {
            const [page, chart] = await Promise.all([
              command<HistoryPage>({
                type: "history-page",
                accountId,
                from,
                to,
                limit: 48,
              }),
              command<HistoryInsights>({
                type: "history-insights",
                accountIds: [accountId],
                from,
                to,
              }),
            ]);
            pages.push(...page.points);
            if (page.cursor) next[accountId] = page.cursor;
            collected.series.push(...chart.series);
            collected.truncated ||= chart.truncated;
          }),
        );
        failed ||= results.some((r) => r.status === "rejected");
      }
      if (stamp !== generation.current) return;
      setPoints(pages);
      setCursors(next);
      setInsights(collected);
      if (failed) setError("Some history could not be loaded. Try again.");
      setLoading(false);
    })();
    return () => {
      generation.current++;
    };
  }, [accountIds, id, provider, from, to, demo, revision, privacy]);
  async function more() {
    if (privacy || loading) return;
    const stamp = generation.current;
    setLoading(true);
    setError("");
    const results = await Promise.allSettled(
      Object.entries(cursors).map(async ([accountId, before]) => ({
        accountId,
        page: await command<HistoryPage>({
          type: "history-page",
          accountId,
          from,
          to,
          limit: 48,
          before,
        }),
      })),
    );
    if (stamp !== generation.current) return;
    const extra: HistoryPoint[] = [],
      next = { ...cursors };
    for (const result of results) {
      if (result.status === "rejected") {
        setError("More readings could not be loaded.");
        continue;
      }
      const { accountId, page } = result.value;
      extra.push(...page.points);
      if (page.cursor) next[accountId] = page.cursor;
      else delete next[accountId];
    }
    setPoints((old) => [...old, ...extra]);
    setCursors(next);
    setLoading(false);
  }
  async function download(format: "json" | "csv") {
    if (privacy || demo) return;
    const stamp = generation.current;
    setMenu(null);
    setError("");
    try {
      const file = await command<{ name: string; mime: string; text: string }>({
        type: "export-history",
        accountId: id || undefined,
        from,
        to,
        format,
      });
      if (privateNow.current || stamp !== generation.current) return;
      const url = URL.createObjectURL(
        new Blob([file.text], { type: file.mime }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("History could not be downloaded. Try again.");
    }
  }
  async function clear() {
    if (privacy || demo) return;
    setLoading(true);
    try {
      await command({ type: "clear-history", accountId: id || undefined });
      setRevision((n) => n + 1);
    } catch {
      setError("History could not be cleared.");
      setLoading(false);
    }
  }
  const visiblePoints = points
      .filter((point) => visibleIds.has(point.accountId))
      .map((point) => ({
        ...point,
        meters:
          limit === "all"
            ? point.meters
            : point.meters.filter(
                (meter) =>
                  JSON.stringify([
                    meter.id,
                    meter.scope,
                    meter.unit,
                    meter.currency ?? null,
                  ]) === limit,
              ),
      })),
    rows = visiblePoints.sort((a, b) => b.time - a.time),
    empty =
      !visibleInsights?.series.length &&
      !visiblePoints.some((point) => point.meters.length);
  return (
    <section className="panel history-panel" aria-label="History">
      <header className="history-heading">
        <h2>History</h2>
        <p>How much of each limit you used over time.</p>
      </header>
      <div className="history-filters">
        <div className="history-filter-selects">
          <label>
            Provider
            <select
              aria-label="History provider"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as ProviderId | "all");
                setId("");
              }}
            >
              <option value="all">All providers</option>
              {PROVIDER_IDS.map((providerId) => (
                <option key={providerId} value={providerId}>
                  {providers[providerId].name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Account
            <select
              aria-label="History account"
              value={id}
              onChange={(e) => setId(e.target.value)}
            >
              <option value="">All accounts</option>
              {store.accounts
                .filter((account) => provider === "all" || account.provider === provider)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {names[account.id]}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Limit
            <select
              aria-label="History limit"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            >
              <option value="all">All limits</option>
              {limitOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="history-range-controls">
          <div
            className="history-ranges"
            role="group"
            aria-label="History time range"
          >
            {[1, 7, 30, ...(retention === 90 ? [90] : [])].map((n) => (
              <button
                key={n}
                className={`filter-button ${!customActive && days === n ? "selected" : ""}`}
                aria-pressed={!customActive && days === n}
                onClick={() => {
                  setCustomActive(false);
                  setRange({ days: n, to: Date.now() });
                }}
              >
                {n === 1 ? "24 h" : `${n} days`}
              </button>
            ))}
            <button
              className={`filter-button ${customActive ? "selected" : ""}`}
              aria-pressed={customActive}
              onClick={() => {
                setCustomDates({ from: localDate(from), to: localDate(to) });
                setCustomActive(true);
              }}
            >
              Custom
            </button>
          </div>
          {customActive && (
            <div className="history-custom-dates">
              <label>
                From
                <input
                  type="date"
                  aria-label="History start date"
                  min={localDate(Date.now() - retention * DAY)}
                  max={customTo}
                  value={customFrom}
                  onChange={(e) =>
                    setCustomDates((old) => ({ ...old, from: e.target.value }))
                  }
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  aria-label="History end date"
                  min={customFrom}
                  max={localDate(Date.now())}
                  value={customTo}
                  onChange={(e) =>
                    setCustomDates((old) => ({ ...old, to: e.target.value }))
                  }
                />
              </label>
            </div>
          )}
        </div>
      </div>
      {invalidRange && (
        <p className="notice" role="alert">
          Choose a start date on or before the end date.
        </p>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {privacy ? (
        <div className="empty-small">
          Turn privacy mode off to view or export history.
        </div>
      ) : loading && !insights ? (
        <div className="empty-small" role="status">
          Loading readings…
        </div>
      ) : empty ? (
        <div className="empty-small">
          No readings yet. They appear after the first refresh.
        </div>
      ) : (
        <>
          {visibleInsights && (
            <HistoryCharts
              insights={visibleInsights}
              names={names}
              colors={Object.fromEntries(
                store.accounts.map((a) => [a.id, providers[a.provider].color]),
              )}
              from={from}
              to={to}
              now={Date.now()}
            />
          )}
          {visibleInsights && visibleInsights.series.length > 0 && (
            <p className="history-timeline-summary">
              {new Date(from).toLocaleDateString()}–{new Date(to).toLocaleDateString()}
              {" · "}
              {visibleInsights.series.reduce((total, series) => total + series.samples, 0).toLocaleString()} readings
              {visibleInsights.gaps > 0 ? ` · ${visibleInsights.gaps} timeline gaps` : ""}
            </p>
          )}
          <details className="history-readings">
            <summary>Show all readings</summary>
            <div className="history-table">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Account</th>
                    <th>Limit</th>
                    <th>Used</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.flatMap((p, i) =>
                    p.meters.map((m, j) => (
                      <tr key={`${p.accountId}/${p.id ?? i}/${j}`}>
                        <td>
                          <time>
                            {new Date(
                              m.observedAt ?? p.observedAt ?? p.time,
                            ).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </time>
                        </td>
                        <td>{names[p.accountId] ?? "Account"}</td>
                        <td>{historyLimitName(m.label ?? "Limit")}</td>
                        <td>{readingValue(m)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </details>
          {Object.keys(cursors).length > 0 && (
            <button
              className="button history-load"
              disabled={loading}
              onClick={() => void more()}
            >
              {loading ? "Loading…" : "Load older readings"}
            </button>
          )}
        </>
      )}
      <div
        className="history-actions"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setMenu(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setMenu(null);
        }}
      >
        <div className="history-menu">
          <button
            className="button button--small"
            aria-haspopup="menu"
            aria-expanded={menu === "download"}
            disabled={!store.accounts.length || demo || loading || privacy}
            onClick={() => setMenu(menu === "download" ? null : "download")}
          >
            <Download size={16} />
            Download
            <ChevronDown size={14} />
          </button>
          {menu === "download" && (
            <div
              className="history-menu-items"
              role="menu"
              aria-label="Download history"
            >
              <button role="menuitem" onClick={() => void download("csv")}>
                CSV (Excel)
              </button>
              <button role="menuitem" onClick={() => void download("json")}>
                JSON
              </button>
            </div>
          )}
        </div>
        <div className="history-menu">
          <button
            className="button button--small"
            aria-haspopup="menu"
            aria-expanded={menu === "manage"}
            disabled={!store.accounts.length || demo || loading || privacy}
            onClick={() => setMenu(menu === "manage" ? null : "manage")}
          >
            Manage
            <ChevronDown size={14} />
          </button>
          {menu === "manage" && (
            <div
              className="history-menu-items"
              role="menu"
              aria-label="Manage history"
            >
              <button
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenu(null);
                  setConfirm(true);
                }}
              >
                Clear history
              </button>
            </div>
          )}
        </div>
      </div>
      {confirm && !privacy && (
        <div className="history-confirm">
          <span>
            Clear {id ? "this account’s" : "all accounts’"} history? Tracking
            stays on.
          </span>
          <button
            className="text-button danger"
            disabled={loading}
            onClick={() => void clear()}
          >
            Confirm clear history
          </button>
          <button className="text-button" onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </div>
      )}
      <p className="history-footnote">
        {retention}-day local retention. Clearing history keeps account
        nicknames and tracking preferences.
      </p>
    </section>
  );
}
