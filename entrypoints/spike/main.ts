import { browser } from "wxt/browser";
import { PROVIDER_IDS, type ProviderId } from "../../src/core/model";
import { providers } from "../../src/providers/catalog";
import {
  SPIKE_MARKER,
  SPIKE_PORT,
  type SpikeCommand,
} from "../../src/core/spike";
import "./style.css";

function initializeSpikePage() {
  document.documentElement.dataset.build = SPIKE_MARKER;
  const root = document.querySelector<HTMLDivElement>("#root")!;
  root.innerHTML = `<main><header><h1>MyLimits evidence spike</h1><p class="warning">Test accounts only · No automatic tracking · No saved-account feature</p></header>
<p>Use a separate browser test profile. Captured cookies and tokens stay in worker memory, disappear on disconnect/restart, and are never printed or saved. Do not share raw browser logs or responses.</p>
<label>Provider<select id="provider"></select></label><button id="connect">Reconnect diagnostic worker</button><p id="status" role="status">Connecting…</p>
<section><h2>A · Cookie names and flags</h2><button id="cookies">List cookie metadata</button><p>Normal and other stores are identified from tab metadata. Unknown stores are never guessed. Select names from exactly one store for an explicit in-memory replay.</p><div id="cookies-table"></div><label>Capture store<select id="store"></select></label><label><input id="consent" type="checkbox"/>I consent to using my selected test-session cookies in memory for these experiments.</label><button id="capture">Capture selected names in memory</button></section>
<section><h2>B · Compare reader requests</h2><p>Runs the current reader, scoped Origin/Referer rules, then captured-cookie replay with credentials omitted. No prompts or model generations. Respect every retry wait; each comparison can make several usage reads.</p><button id="compare">Compare three transports</button></section>
<section><h2>C · Token expiry and Bearer test</h2><p>ChatGPT only. Expiry is decoded, not signature-verified. No token value is displayed.</p><label>Session source<select id="token-source"><option value="ambient">Current browser login</option><option value="replay">Captured test session</option></select></label><button id="token">Inspect expiry and test Bearer</button></section>
<section><h2>D · Response cookie names</h2><p>Observes only MyLimits worker requests to the selected provider's reader endpoints. Stops after 60 seconds. Values are discarded.</p><button id="observe-start">Observe Set-Cookie names</button><button id="observe-read">Read observations</button><button id="observe-stop">Stop observation</button></section>
<section><h2>E · Private-window dry run</h2><p>Enable Allow in Incognito in extension details first. Close other private windows in this test profile; private windows can share a cookie store. Sign in yourself, inspect metadata, then close without signing out.</p><button id="private-open">Open private dry run</button><button id="private-inspect">Inspect private stores</button><button id="private-close">Close owned private window</button></section>
<section><h2>F · Bearer only, no cookies or rules</h2><p>Uses the token already inspected by C, performs only the usage request with credentials omitted and no DNR rule, and prints its status only.</p><button id="bearer">Test Bearer-only status</button></section>
<section><h2>Sanitized results</h2><button id="cancel">Cancel running test</button><button id="clear">Clear captured state and results</button><button id="copy">Copy sanitized results</button><p>HTTP success alone does not prove which DNR rule matched. Unavailable feedback remains unverified. These results do not automatically pass G0 or G1.</p><div id="results" aria-live="polite"></div></section></main>`;
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const provider = $<HTMLSelectElement>("provider");
  for (const id of PROVIDER_IDS) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = providers[id].name;
    provider.append(option);
  }
  let connection: ReturnType<typeof browser.runtime.connect> | undefined,
    sequence = 0,
    ready = false,
    retries = 0;
  const pending = new Map<
    number,
    {
      resolve: (data: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const reports: {
    experiment: string;
    provider: string;
    at: string;
    result: unknown;
  }[] = [];
  function status(text: string) {
    $("status").textContent = text;
  }
  function connect() {
    connection?.disconnect();
    ready = false;
    const port = browser.runtime.connect({ name: SPIKE_PORT });
    connection = port;
    port.onMessage.addListener((packet) => {
      if (packet.type === "ready") {
        ready = true;
        retries = 0;
        status("Ready. No provider request has run.");
        return;
      }
      const request = pending.get(packet.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(packet.id);
      packet.ok
        ? request.resolve(packet.data)
        : request.reject(new Error(packet.code ?? "probe-unavailable"));
    });
    port.onDisconnect.addListener(() => {
      void browser.runtime.lastError;
      if (connection !== port) return;
      const wasReady = ready;
      connection = undefined;
      ready = false;
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("worker-disconnected"));
      }
      pending.clear();
      status(
        "Worker disconnected. Captures are cleared; reconnect and recapture.",
      );
      if (!wasReady && retries++ < 3) setTimeout(connect, 250);
    });
  }
  function send(command: SpikeCommand): Promise<unknown> {
    if (!connection || !ready)
      return Promise.reject(new Error("worker-disconnected"));
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("probe-timeout"));
      }, 180000);
      pending.set(id, { resolve, reject, timer });
      connection!.postMessage({ id, command });
    });
  }
  function table(rows: Record<string, unknown>[], target: HTMLElement) {
    if (!rows.length) {
      const p = document.createElement("p");
      p.textContent = "No rows reported.";
      target.append(p);
      return;
    }
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))],
      t = document.createElement("table"),
      head = t.createTHead().insertRow();
    for (const key of keys) {
      const cell = document.createElement("th");
      cell.textContent = key;
      head.append(cell);
    }
    for (const row of rows) {
      const tr = t.insertRow();
      for (const key of keys) {
        const cell = tr.insertCell();
        cell.textContent =
          typeof row[key] === "object"
            ? JSON.stringify(row[key])
            : String(row[key] ?? "unknown");
      }
    }
    target.append(t);
  }
  function show(
    experiment: string,
    result: unknown,
    selected = provider.value,
  ) {
    reports.push({
      experiment,
      provider: selected,
      at: new Date().toISOString(),
      result,
    });
    if (reports.length > 100) reports.shift();
    const article = document.createElement("article"),
      h = document.createElement("h3");
    h.textContent = experiment;
    article.append(h);
    const data = result as Record<string, unknown>;
    if (data && typeof data === "object" && Array.isArray(data.rows)) {
      table(data.rows as Record<string, unknown>[], article);
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(
        Object.fromEntries(
          Object.entries(data).filter(([key]) => key !== "rows"),
        ),
        null,
        2,
      );
      article.append(pre);
    } else
      table([data && typeof data === "object" ? data : { result }], article);
    $("results").prepend(article);
  }
  async function run(label: string, command: SpikeCommand) {
    const selected =
      "provider" in command
        ? command.provider
        : command.type === "token" || command.type === "bearer"
          ? "chatgpt"
          : (provider.value as ProviderId);
    try {
      // Permission request stays directly inside the user's click; no automatic site grants.
      if (
        !["ping", "clear", "cancel"].includes(command.type) &&
        !(await browser.permissions.request({
          origins: [providers[selected].origin],
        }))
      )
        throw Error("site-access-required");
      status("Running…");
      const result = await send(command);
      show(label, result, selected);
      status("Finished. Captured values remain private.");
      return result;
    } catch (error) {
      const code = error instanceof Error ? error.message : "probe-unavailable";
      status(`Test stopped: ${code}. No success inferred.`);
      show(label, { error: code }, selected);
      return null;
    }
  }
  $("connect").onclick = () => {
    retries = 0;
    connect();
  };
  $("cookies").onclick = async () => {
    const data = (await run("A cookie metadata", {
      type: "cookies",
      provider: provider.value as ProviderId,
    })) as {
      rows: Record<string, unknown>[];
      stores: { storeId: string; context: string }[];
    } | null;
    if (!data) return;
    $("cookies-table").replaceChildren();
    const select = $<HTMLSelectElement>("store");
    select.replaceChildren();
    for (const store of data.stores) {
      const option = document.createElement("option");
      option.value = store.storeId;
      option.textContent = `${store.storeId} (${store.context})`;
      select.append(option);
    }
    for (const row of data.rows) {
      const label = document.createElement("label"),
        input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(row.name);
      input.dataset.store = String(row.storeId);
      label.append(
        input,
        document.createTextNode(`${row.name} · store ${row.storeId}`),
      );
      $("cookies-table").append(label);
    }
  };
  $("capture").onclick = () => {
    if (!$<HTMLInputElement>("consent").checked) {
      status("Consent is required before capture.");
      return;
    }
    const storeId = $<HTMLSelectElement>("store").value;
    const names = [
      ...document.querySelectorAll<HTMLInputElement>(
        "#cookies-table input:checked",
      ),
    ]
      .filter((i) => i.dataset.store === storeId)
      .map((i) => i.value);
    void run("Capture metadata", {
      type: "capture",
      provider: provider.value as ProviderId,
      storeId,
      names,
      consent: true,
    });
  };
  $("compare").onclick = () =>
    void run("B transport comparison", {
      type: "compare",
      provider: provider.value as ProviderId,
    });
  $("token").onclick = () =>
    void run("C decoded expiry and Bearer test", {
      type: "token",
      source: $<HTMLSelectElement>("token-source").value as
        "ambient" | "replay",
    });
  $("bearer").onclick = () => void run("F status only", { type: "bearer" });
  for (const action of ["start", "read", "stop"] as const)
    $(`observe-${action}`).onclick = () =>
      void run("D response cookie names", {
        type: "observe",
        provider: provider.value as ProviderId,
        action,
      });
  for (const action of ["open", "inspect", "close"] as const)
    $(`private-${action}`).onclick = () =>
      void run("E private dry run", {
        type: "private",
        provider: provider.value as ProviderId,
        action,
      });
  $("cancel").onclick = () => void run("Cancel", { type: "cancel" });
  $("clear").onclick = async () => {
    await run("Clear", { type: "clear" });
    reports.length = 0;
    $("results").replaceChildren();
    $("cookies-table").replaceChildren();
    $<HTMLSelectElement>("store").replaceChildren();
    $<HTMLInputElement>("consent").checked = false;
  };
  $("copy").onclick = () => {
    void navigator.clipboard.writeText(JSON.stringify(reports, null, 2)).then(
      () => status("Sanitized results copied."),
      () => status("Clipboard unavailable."),
    );
  };
  setInterval(() => {
    if (connection) void send({ type: "ping" }).catch(() => {});
  }, 20000);
  window.addEventListener("pagehide", () => connection?.disconnect());
  connect();
}

// A toolbar popup closes on blur, which would cancel a private sign-in dry run.
// Promote that view to a persistent extension tab before opening any session port.
void browser.tabs
  .getCurrent()
  .then((tab) => {
    if (tab?.id !== undefined) initializeSpikePage();
    else
      void browser.tabs
        .create({ url: browser.runtime.getURL("/") + "spike.html" })
        .then(() => window.close());
  })
  .catch(() => {
    document.body.textContent =
      "Open MyLimits Extension options in a normal browser tab to use the evidence spike.";
  });
