import type { CSSProperties } from 'react';
import type { ProviderId } from '../core/model';
import { providers } from '../providers/catalog';

export function ProviderMark({ provider }: { provider: ProviderId }) {
  return <span aria-hidden="true" className="provider-mark" style={{ '--provider': providers[provider].color } as CSSProperties}>
    {provider === 'chatgpt' ? 'O' : providers[provider].name[0]}
  </span>;
}
