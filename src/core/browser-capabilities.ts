import { syncPermission } from './sync-origin';
export const SYNC_DATA_TYPES=['personallyIdentifyingInfo','authenticationInfo','websiteActivity','technicalAndInteraction'];
export function syncGrant(origin:string,browserName:string){return {origins:[syncPermission(origin)],...(browserName==='firefox'?{data_collection:[...SYNC_DATA_TYPES]}:{})}}
