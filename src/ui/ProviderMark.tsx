import type { ProviderId } from '../core/model';
const icons: Record<ProviderId,string> = {chatgpt:'chatgpt.svg',claude:'claude.svg',gemini:'gemini.png',grok:'grok.svg',perplexity:'perplexity.svg',cursor:'cursor.svg'};
export function ProviderMark({provider}:{provider:ProviderId}) {
  return <span aria-hidden="true" className="provider-mark"><img src={`/providers/${icons[provider]}`} alt="" width={24} height={24}/></span>;
}
