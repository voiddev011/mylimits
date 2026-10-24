import { BrandMark } from "./BrandMark";
import { accountStatusText, accountSource } from "../core/presentation";
import { useState } from "react";
import { ArrowUpRight, Bell, Plus, RefreshCw, Search, X } from "lucide-react";
import {
  accountName,
  alertThresholds,
  isFresh,
  remainingPercent,
  type Account,
  type Meter,
} from "../core/model";
import { useMyLimits } from "./useMyLimits";
import { selectAccounts } from "./overview";
import { countdown, age } from "./format";
import { Reading } from "./Reading";
import { ProviderMark } from "./ProviderMark";
import { openDashboard } from "./navigation";
import "./styles.css";
import "./popup.css";

function visibleMeters(account: Account): Meter[] {
  return account.meters.slice(0, 2);
}

export function Popup() {
  const {
    store,
    demo,
    setDemo,
    busy,
    error,
    setError,
    toast,
    notify,
    now,
    run,
  } = useMyLimits();
  const [lowOnly, setLowOnly] = useState(false);
  const [query, setQuery] = useState("");
  const fresh = (a: Account) =>
    a.meters.filter(
      (m) =>
        m.evidence === "reported" &&
        isFresh(a, m, now, store?.settings.refreshMinutes ?? 5),
    );
  const low =
    store?.accounts.filter((a) =>
      fresh(a).some(
        (m) =>
          (remainingPercent(m) ?? Infinity) <=
          (a.alertRemaining ?? store.settings.warningRemaining),
      ),
    ).length ?? 0;
  const criticalAccounts = store?.accounts.filter((a) =>
    fresh(a).some((m) => {
      const remaining = remainingPercent(m);
      return (
        remaining !== null &&
        remaining <= alertThresholds(a, store.settings).critical
      );
    }),
  ) ?? [];
  const nextReset = Math.min(
    ...(store?.accounts.flatMap((a) =>
      fresh(a).flatMap((m) => (m.resetsAt === null ? [] : [m.resetsAt])),
    ) ?? []),
  );
  const latest = Math.max(
    0,
    ...(store?.accounts.map((a) => a.updatedAt) ?? []),
  );
  const accounts = store
    ? selectAccounts(
        store.accounts,
        store.settings,
        now,
        store.settings.privacyMode ? "" : query,
        lowOnly,
        "default",
      )
    : [];
  function dashboard(section = "overview", accountId?: string) {
    void openDashboard(section, accountId, demo).catch(() =>
      notify("Could not open the dashboard."),
    );
  }
  return (
    <div className="app app--popup quick-popup">
      <header className="quick-header">
        <div className="quick-brand">
          <BrandMark size={20} />
          <h1>MyLimits</h1>
          <span
            className="quick-count"
            aria-label={`${store?.accounts.length ?? 0} saved accounts`}
          >
            {store?.accounts.length ?? 0}
          </span>
        </div>
        <div className="inline-actions">
          <button
            className="icon-button"
            aria-label="Add account"
            title="Add account"
            onClick={() => dashboard("add")}
            disabled={!store}
          >
            <Plus size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Refresh all limits"
            title="Refresh all limits"
            disabled={busy || demo || !store}
            onClick={() => void run({ type: "refresh" })}
          >
            <RefreshCw size={16} className={busy ? "spin" : ""} />
          </button>
        </div>
      </header>
      {demo && (
        <div className="preview-banner">
          <span>Preview · sample accounts and readings</span>
          <button
            aria-label="Exit sample preview"
            onClick={() => setDemo(false)}
          >
            Exit preview
            <X size={12} />
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="error-banner">
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <main className="quick-main">
        {!store ? (
          <div className="empty-small">
            {error ? "Unable to load saved limits." : "Loading your limits…"}
          </div>
        ) : (
          <>
            {!!criticalAccounts.length && (
              <div className="quick-critical" role="alert">
                <strong>Critical limit reached</strong>
                <span>
                  {store.settings.privacyMode
                    ? `${criticalAccounts.length} account${criticalAccounts.length === 1 ? " is" : "s are"} at a critical limit.`
                    : `${criticalAccounts
                        .map(accountName)
                        .join(", ")} ${criticalAccounts.length === 1 ? "is" : "are"} at a critical limit.`}
                </span>
              </div>
            )}
            {!!store.accounts.length && (
              <div className="quick-summary">
                <button
                  className={`quick-low ${lowOnly ? "selected" : ""}`}
                  aria-label="Low only"
                  aria-pressed={lowOnly}
                  onClick={() => setLowOnly(!lowOnly)}
                >
                  <Bell size={12} />
                  {low ? `${low} running low` : "No low limits"}
                  {lowOnly && <X size={10} />}
                </button>
                <span>
                  {Number.isFinite(nextReset) ? (
                    <>
                      Next reset <strong>{countdown(nextReset, now)}</strong>
                    </>
                  ) : (
                    "Remaining allowance"
                  )}
                </span>
              </div>
            )}
            {store.accountSetup && (
              <div className="pending-setup">
                <span>Account setup in progress</span>
                <button
                  className="text-button"
                  onClick={() => dashboard("add")}
                >
                  Continue setup
                </button>
              </div>
            )}
            {store.accounts.length > 6 && (
              <label className="search-box quick-search">
                <Search size={13} />
                <input
                  aria-label="Search accounts"
                  placeholder="Find an account"
                  disabled={store.settings.privacyMode}
                  value={store.settings.privacyMode ? "" : query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            )}
            <div className="quick-accounts">
              {accounts.map((account) => {
                const meters = visibleMeters(account);
                const status = accountStatusText(account, store, now);
                const source = `${accountSource(account, store)}${account.provider === "chatgpt" ? " · Codex" : ""}`;
                return (
                  <button
                    className="quick-account"
                    key={account.id}
                    aria-label={`View ${accountName(account)} in full dashboard`}
                    onClick={() => dashboard("overview", account.id)}
                  >
                    <span className="quick-identity">
                      <ProviderMark provider={account.provider} />
                      <span className="quick-copy">
                        <strong>{accountName(account)}</strong>
                        <small
                          title={`${source ? source + " · " : ""}${status}${account.updatedAt ? " · " + age(account.updatedAt, now) : ""}`}
                        >
                          {source && `${source} · `}
                          {`${status} · last checked ${age(account.updatedAt, now)}`}
                          {account.meters.length > 2 &&
                            ` · +${account.meters.length - 2} limits`}
                        </small>
                      </span>
                    </span>
                    <span className="quick-meters">
                      {meters.map((m) => (
                        <Reading
                          key={`${m.scope}/${m.id}`}
                          account={account}
                          meter={m}
                          settings={store.settings}
                          now={now}
                          compact
                        />
                      ))}
                      {!meters.length && (
                        <span className="no-quota">
                          {account.kind === "browser"
                            ? "Local activity only"
                            : "Quota not reported"}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {store.accounts.some((a) => a.provider === "copilot") && (
              <div className="quick-provider-add">
                <button
                  className="text-button"
                  disabled={busy || demo}
                  onClick={() => dashboard("add-copilot")}
                >
                  <Plus size={14} />
                  Add another GitHub account
                </button>
              </div>
            )}
            {!store.accounts.length && (
              <div className="quick-empty">
                <BrandMark size={29} />
                <h2>Your limits at a glance.</h2>
                <p>Connect a service using your existing login.</p>
                <button
                  className="button button--primary"
                  onClick={() => dashboard("add")}
                >
                  <Plus size={14} />
                  Add your first account
                </button>
                <button className="text-button" onClick={() => setDemo(true)}>
                  Preview with sample data
                </button>
              </div>
            )}
            {!!store.accounts.length && !accounts.length && (
              <div className="empty-small">
                {lowOnly
                  ? "No accounts with fresh low limits."
                  : "No accounts match."}
              </div>
            )}
          </>
        )}
      </main>
      <footer className="quick-footer">
        {
          <span className="quick-updated">
            {latest ? `Last reading ${age(latest, now)}` : "On-device tracking"}
          </span>
        }
        <button className="text-button" onClick={() => dashboard()}>
          Full dashboard
          <ArrowUpRight size={14} />
        </button>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {store?.historyIssue && (
        <div className="history-warning" role="status">
          {store.historyIssue}
        </div>
      )}
    </div>
  );
}
