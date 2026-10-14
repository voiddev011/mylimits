import { browser } from 'wxt/browser';
import { providerForUrl } from '../src/providers/catalog';

export default defineContentScript({
  matches: ['https://gemini.google.com/*', 'https://grok.com/*', 'https://www.perplexity.ai/*'],
  registration: 'runtime',
  runAt: 'document_start',
  main(ctx) {
    const provider = providerForUrl(location.href);
    if (!provider) return;
    const channel = crypto.randomUUID();
    const stop = () => window.postMessage({ mylimits: channel, type: 'stop-observer' }, location.origin);
    const onStorage = (changes: Record<string, { newValue?: unknown }>) => {
      const state = changes['mylimits:state:v1']?.newValue as { providers?: Record<string, { enabled: boolean }> } | undefined;
      if (state && !state.providers?.[provider]?.enabled) stop();
    };
    browser.storage.onChanged.addListener(onStorage);
    ctx.onInvalidated(() => { browser.storage.onChanged.removeListener(onStorage); stop(); });
    ctx.addEventListener(window, 'message', (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin) return;
      const data = event.data;
      if (!data || data.mylimits !== channel || data.type !== 'request-observed' || typeof data.eventId !== 'string'
        || !/^[0-9a-f-]{36}$/i.test(data.eventId)) return;
      void browser.runtime.sendMessage({ type: 'observation', provider, eventId: data.eventId }).catch(() => undefined);
    });
    void browser.runtime.sendMessage({ type: 'observer-ready', provider, channel }).catch(() => undefined);
  },
});
