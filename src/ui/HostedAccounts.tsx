import type { HostedProvider } from '../core/hosted-contracts';
export function HostedAccounts({provider,demo}:{provider?:HostedProvider|null;demo:boolean}){
 return <section className="connect-steps" aria-label="Independent accounts"><h3>Connect another account</h3><p role="status">Not available yet</p><p>{provider==='claude'?'Claude remote sign-in is still being validated.':provider==='openai'?'OpenAI hosted authorization is still being validated.':'Independent sign-in is not available for this service.'}</p><small>{demo?'Preview does not connect accounts.':'Opening the ordinary website would use your existing login. No account was connected.'}</small></section>;
}
