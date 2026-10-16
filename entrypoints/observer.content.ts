import { browser } from 'wxt/browser';
import { providerForUrl } from '../src/providers/catalog';

export default defineContentScript({
  // Matches are supplied only by the controller after optional site access.
  registration: 'runtime',
  runAt: 'document_start',
  main(ctx) {
    const provider = providerForUrl(location.href);
    if (!provider) return;
    const channel = crypto.randomUUID();
    let stopped=false;
    const stop = () => {if(stopped)return;stopped=true;window.postMessage({ mylimits: channel, type: 'stop-observer' }, location.origin);browser.runtime.onMessage.removeListener(onMessage)};
    const onMessage=(raw:unknown,sender:{id?:string;tab?:unknown})=>{if(sender.id===browser.runtime.id&&!sender.tab&&(raw as {type?:string})?.type==='mylimits-observer-stop')stop()};
    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(stop);
    ctx.addEventListener(window, 'message', (event: MessageEvent) => {
      if (stopped || event.source !== window || event.origin !== location.origin) return;
      const data = event.data;
      if (!data || data.mylimits !== channel || data.type !== 'request-observed' || typeof data.eventId !== 'string'
        || !/^[0-9a-f-]{36}$/i.test(data.eventId)) return;
      void browser.runtime.sendMessage({ type: 'observation', provider, eventId: data.eventId }).catch(() => undefined);
    });
    void browser.runtime.sendMessage({ type: 'observer-ready', provider, channel }).catch(() => undefined);
  },
});
