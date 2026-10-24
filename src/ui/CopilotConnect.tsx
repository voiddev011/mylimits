import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { openDashboard } from "./navigation";
import { COPILOT_PLANS } from "../core/copilot";
import type { ActionRunner } from "../platform/messages";
export function CopilotConnect({
  run,
  busy,
  onSaved,
  connectionId,
  another = false,
  accountId,
}: {
  run: ActionRunner;
  busy: boolean;
  onSaved: () => void;
  connectionId?: string;
  another?: boolean;
  accountId?: string;
}) {
  const [token, setToken] = useState(""),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const dashboard = location.pathname === "/dashboard.html";
  async function openSetup() {
    try {
      await openDashboard(
        connectionId ? "overview" : "add-copilot",
        connectionId ? accountId : undefined,
      );
      onSaved();
    } catch {
      setError("Could not open account setup. Try again.");
    }
  }
  useEffect(() => {
    if (!dashboard && !busy) void openSetup();
  }, [dashboard, busy, connectionId, accountId]);
  if (!dashboard)
    return (
      <div className="connect-steps">
        <p>Use the full dashboard to connect this account securely.</p>
        {error && <p role="alert">{error}</p>}
        <button
          className="button"
          disabled={busy}
          onClick={() => void openSetup()}
        >
          Open Copilot setup
        </button>
      </div>
    );
  return (
    <form
      className="connect-steps"
      onSubmit={async (e) => {
        e.preventDefault();
        setWorking(true);
        setError("");
        try {
          const granted = await browser.permissions.request({
            origins: ["https://api.github.com/*"],
          });
          if (!granted) {
            setError("Allow GitHub API access to connect.");
            return;
          }
          if (await run({ type: "copilot-connect", token, connectionId }))
            onSaved();
        } catch {
          setError("Could not connect. Try again.");
        } finally {
          setToken("");
          setWorking(false);
        }
      }}
    >
      {another && !connectionId && <h3>Add another GitHub account</h3>}
      <p>
        Create a fine-grained personal access token. Under Account permissions,
        set <strong>Plan → Read-only</strong>. No repository access is needed.
      </p>
      {!connectionId && (
        <p className="small-note">
          Use a token created by the GitHub account you want to add. To keep
          your usual GitHub login unchanged, sign into the other account in a
          private window and create its token there. Another token for the same
          account will not add a different account.
        </p>
      )}
      <a
        href="https://github.com/settings/personal-access-tokens/new"
        target="_blank"
        rel="noreferrer"
      >
        Create token on GitHub ↗
      </a>
      <label>
        Fine-grained personal access token
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={501}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          pattern="github_pat_[A-Za-z0-9_]{10,490}"
        />
      </label>
      <small>
        Encrypted on this device. Premium requests only; choose your allowance
        in account settings. Checks run at most every 15 minutes.
      </small>
      {error && <p role="alert">{error}</p>}
      <button className="button button--primary" disabled={busy || working}>
        {working
          ? "Verifying GitHub account…"
          : connectionId
            ? "Replace token"
            : "Connect GitHub Copilot"}
      </button>
    </form>
  );
}
export function CopilotSettings({
  connectionId,
  allowance,
  run,
  busy,
  accountId,
}: {
  connectionId: string;
  allowance: number | null;
  run: ActionRunner;
  busy: boolean;
  accountId?: string;
}) {
  const [plan, setPlan] = useState("Custom"),
    [custom, setCustom] = useState(String(allowance ?? "")),
    [replace, setReplace] = useState(false);
  return (
    <div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run({
            type: "copilot-allowance",
            connectionId,
            allowance:
              plan === "Custom"
                ? custom
                  ? Number(custom)
                  : null
                : COPILOT_PLANS[plan as keyof typeof COPILOT_PLANS],
          });
        }}
      >
        <label>
          Monthly allowance
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            {Object.entries(COPILOT_PLANS).map(([name, n]) => (
              <option key={name} value={name}>
                {name} · {n}
              </option>
            ))}
            <option>Custom</option>
          </select>
        </label>
        {plan === "Custom" && (
          <label>
            Requests (blank = unknown)
            <input
              type="number"
              min="1"
              max="1000000000"
              step="any"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
        )}
        <button className="button" disabled={busy}>
          Save allowance
        </button>
      </form>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => setReplace(!replace)}
      >
        {replace ? "Cancel" : "Replace token"}
      </button>
      {replace && (
        <CopilotConnect
          run={run}
          busy={busy}
          connectionId={connectionId}
          accountId={accountId}
          onSaved={() => setReplace(false)}
        />
      )}
    </div>
  );
}
