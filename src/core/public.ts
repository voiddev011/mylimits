import type { Account, ConnectionRecord, Store } from './model';
export type PublicConnection = Omit<ConnectionRecord, 'generation' | 'profileId'>;
export interface PublicState {
  accountSetup?: Store['accountSetup'];
  version: 2; accounts: Account[]; providers: Store['providers']; settings: Store['settings'];
  connections: PublicConnection[]; workspaces: { id: string; provider: string; name: string }[]; historyIssue: string | null;
}
export function toPublicState(store: Store): PublicState {
  return {
    accountSetup: structuredClone(store.accountSetup ?? null),
    version: 2, settings: structuredClone(store.settings), providers: structuredClone(store.providers), historyIssue: store.historyIssue,
    workspaces: store.workspaces.map(({ id, provider, name }) => ({ id, provider, name })),
    connections: store.connections.map(c => ({ id:c.id, provider:c.provider,kind:c.kind,accountId:c.accountId,workspaceId:c.workspaceId,workspaceIds:[...c.workspaceIds],
      independent:c.independent ? structuredClone(c.independent) : undefined,savedSignIn:c.savedSignIn?{method:c.savedSignIn.method,notAfter:c.savedSignIn.notAfter}:undefined, enabled:c.enabled,status:c.status,lastAttemptAt:c.lastAttemptAt,lastSuccessAt:c.lastSuccessAt,nextRetryAt:c.nextRetryAt,failures:c.failures,message:c.message })),
    accounts: store.accounts.map(a => ({ id:a.id,provider:a.provider,kind:a.kind,alias:a.alias,defaultName:a.defaultName,plan:a.plan,
      companionProfile:a.companionProfile,connection:a.connection,createdAt:a.createdAt,updatedAt:a.updatedAt,alertRemaining:a.alertRemaining,alertsMuted:a.alertsMuted,
      pinned:a.pinned,order:a.order,pinnedMeterIds:a.pinnedMeterIds,snoozedUntil:a.snoozedUntil,workspaceId:a.workspaceId,
      meters:a.meters.map(m=>({id:m.id,label:m.label,scope:m.scope,evidence:m.evidence,used:m.used,total:m.total,remaining:m.remaining,usedPercent:m.usedPercent,
        unit:m.unit,resetsAt:m.resetsAt,source:m.source,currency:m.currency,windowId:m.windowId,observedAt:m.observedAt,connectionId:m.connectionId})) })),
  };
}
