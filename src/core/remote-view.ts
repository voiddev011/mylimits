import type { Account } from './model';
import type { RemoteAccount,RemoteReading } from './sync-contracts';
export function remoteAccountView(account:RemoteAccount,reading:RemoteReading|null):Account {
 return {id:account.id,provider:account.provider,kind:'account',alias:account.name,defaultName:account.name,plan:account.plan,
  connection:account.status==='disabled'?'inactive':'active',createdAt:reading?.observedAt??0,updatedAt:reading?.observedAt??0,
  alertRemaining:null,alertsMuted:true,meters:reading?.snapshot.meters.map(m=>({...m,observedAt:m.observedAt??reading.observedAt,connectionId:reading.connectionId}))??[]};
}
