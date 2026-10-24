// CDP-only harness: actual React component/runtime; injected fictional provider/private browser APIs.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PrivateSignIn } from "../../src/ui/PrivateSignIn";
import { toPublicState } from "../../src/core/public";
import { privatePresentation } from "../../src/core/presentation";
import { emptyStore } from "../../src/core/model";
import type { ActionRunner } from "../../src/platform/messages";
import { createPrivateFixture } from "./private-flow";
import type { browser as BrowserAPI } from "wxt/browser";
export async function mountPrivateUI(
  browser: typeof BrowserAPI,
  options: { empty?: boolean; incognito?: boolean; permission?: boolean } = {},
) {
  const f = await createPrivateFixture(browser);
  if (options.empty)
    await f.port.updateStore((s) => ({
      store: emptyStore(s.installSalt),
      value: undefined,
    }));
  f.incognito(options.incognito ?? true);
  let granted = options.permission ?? true,
    successes = 0;
  const initial = toPublicState(await f.readStore());
  function Harness() {
    const [store, setStore] = useState(initial),
      [busy, setBusy] = useState(false),
      [saved, setSaved] = useState(0);
    useEffect(
      () =>
        f.subscribe(() => {
          void f.readStore().then((s) => setStore(toPublicState(s)));
        }),
      [],
    );
    const run: ActionRunner = async (c, onError) => {
      setBusy(true);
      try {
        if (c.type === "vault-signin-start") {
          f.advance();
          const id = await f.runtime.start(c.provider, c.method, c.nickname);
          await f.runtime.check(id);
        } else if (c.type === "vault-signin-save")
          await f.runtime.save(c.setupId, c.accountId, c.consent, c.nickname);
        else if (c.type === "vault-signin-cancel")
          await f.runtime.cancel(c.setupId);
        else if (c.type === "vault-signin-check")
          await f.runtime.check(c.setupId);
        else throw Error("Unexpected harness command");
        return true;
      } catch (e) {
        onError?.(e);
        return false;
      } finally {
        setStore(toPublicState(await f.readStore()));
        setBusy(false);
      }
    };
    return (
      <div className="app app--dashboard">
        <div className="connect-sheet">
          {saved > 0 && <p role="status">Saved {saved} account</p>}
          <PrivateSignIn
            provider="chatgpt"
            store={
              store.settings.privacyMode ? privatePresentation(store) : store
            }
            run={run}
            access={{ grant: async () => granted }}
            busy={busy}
            demo={false}
            onSaved={() => {
              successes++;
              setSaved(successes);
            }}
          />
        </div>
      </div>
    );
  }
  const previous = document.getElementById("root");
  if (previous) previous.style.display = "none";
  const container = document.createElement("div");
  container.id = "private-signin-fixture";
  document.body.append(container);
  const root = createRoot(container);
  root.render(<Harness />);
  return {
    read: f.readStore,
    metrics: f.metrics,
    slots: () => f.vault.listVault(),
    incognito: f.incognito,
    permission: (value: boolean) => {
      granted = value;
    },
    identity: f.identity,
    privacy: async (value: boolean) =>
      await f.port.updateStore((s) => ({
        store: { ...s, settings: { ...s.settings, privacyMode: value } },
        value: undefined,
      })),
    async disconnect(id: string) {
      await f.runtime.disconnect(id);
    },
    async forget(id: string) {
      await f.runtime.forget(id);
    },
    unmount: () => {
      root.unmount();
      container.remove();
      if (previous) previous.style.display = "";
    },
  };
}
