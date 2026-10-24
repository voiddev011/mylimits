import { useEffect, useRef, useState } from "react";
import { HistoryCharts, historyLimitName } from "./HistoryCharts";
import type { HistoryInsights } from "../core/insights";
import { Download, ChevronDown } from "lucide-react";
import { command, type PublicStore } from "../platform/messages";
import { accountName } from "../core/model";
import { providers } from "../providers/catalog";
import type {
  HistoryCursor,
  HistoryPage,
  HistoryPoint,
} from "../core/history-data";
const DAY = 86400000;
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
    from = range.to - days * DAY;
  const accountIds = store.accounts.map((a) => a.id).join("|");
  const names = Object.fromEntries(
    store.accounts.map((a, i) => [
      a.id,
      privacy ? `Account ${i + 1}` : accountName(a),
    ]),
  );
  useEffect(() => {
    if (id && !store.accounts.some((a) => a.id === id)) setId("");
  }, [accountIds, id]);
  useEffect(() => {
    const stamp = ++generation.current;
    setError("");
    setInsights(null);
    setPoints([]);
    setCursors({});
    setConfirm(false);
    setMenu(null);
    setLoading(false);
    const ids = store.accounts
      .filter((a) => !id || a.id === id)
      .map((a) => a.id);
    if (!ids.length || demo || privacy) return;
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
                to: range.to,
                limit: 48,
              }),
              command<HistoryInsights>({
                type: "history-insights",
                accountIds: [accountId],
                from,
                to: range.to,
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
  }, [accountIds, id, from, range.to, demo, revision, privacy]);
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
          to: range.to,
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
        to: range.to,
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
  const rows = [...points].sort((a, b) => b.time - a.time),
    empty = !insights?.series.length && !points.some((p) => p.meters.length);
  return (
    <section className="panel history-panel" aria-label="History">
      <header className="history-heading">
        <h2>History</h2>
        <p>How much of each limit you used over time.</p>
      </header>
      <div className="history-filters">
        <label>
          Account
          <select
            aria-label="History account"
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="">All accounts</option>
            {store.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {names[a.id]}
              </option>
            ))}
          </select>
        </label>
        <div
          className="history-ranges"
          role="group"
          aria-label="History time range"
        >
          {[1, 7, 30, ...(retention === 90 ? [90] : [])].map((n) => (
            <button
              key={n}
              className={`filter-button ${days === n ? "selected" : ""}`}
              aria-pressed={days === n}
              onClick={() => setRange({ days: n, to: Date.now() })}
            >
              {n === 1 ? "24 h" : `${n} days`}
            </button>
          ))}
        </div>
      </div>
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
          {insights && (
            <HistoryCharts
              insights={insights}
              names={names}
              colors={Object.fromEntries(
                store.accounts.map((a) => [a.id, providers[a.provider].color]),
              )}
              from={from}
              to={range.to}
              now={Date.now()}
            />
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
