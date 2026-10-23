import type { ProviderId } from '../core/model';
import { providers } from '../providers/catalog';
export interface PrivateAccess {grant(provider:ProviderId):Promise<boolean>;}
export function createPrivateAccess(port:{permissions:{request(grants:{permissions:('cookies'|'declarativeNetRequestWithHostAccess')[];origins:string[]}):Promise<boolean>}}):PrivateAccess{
 return {grant:provider=>port.permissions.request({permissions:['cookies','declarativeNetRequestWithHostAccess'],origins:[providers[provider].origin]})};
}
