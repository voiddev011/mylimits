import { browser } from 'wxt/browser';
import { SnapshotSync,SyncError } from '../core/sync';
import { syncGrant } from '../core/browser-capabilities';
import { readStore } from './repository';
export const syncOrigin=typeof __MYLIMITS_SYNC_ORIGIN__==='string'?__MYLIMITS_SYNC_ORIGIN__:'';
const key='mylimits:sync:private:v1';
export const snapshotSync=new SnapshotSync(syncOrigin,{
 async read(){return (await browser.storage.local.get(key))[key]},
 async write(value){await browser.storage.local.set({[key]:value})},
 store:readStore,
 async request(path,options){
  if(!syncOrigin||new URL(path,syncOrigin).origin!==syncOrigin||!await browser.permissions.contains(syncGrant(syncOrigin,__MYLIMITS_BROWSER__)))throw new Error('Approve the configured sync server first.');
  const response=await fetch(new URL(path,syncOrigin),{method:options.method,credentials:'omit',redirect:'error',signal:options.signal,headers:{...(options.body?{'content-type':'application/json'}:{}),...(options.token?{authorization:`Bearer ${options.token}`}:{})},body:options.body?JSON.stringify(options.body):undefined});
  if(!response.ok)throw new SyncError(response.status);
  const reader=response.body?.getReader();if(!reader)throw new Error('Empty sync response.');let size=0;const chunks:Uint8Array[]=[];
  for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>1048576){await reader.cancel();throw new Error('Sync response exceeds the safe size.')}chunks.push(next.value)}
  const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length}return JSON.parse(new TextDecoder().decode(data));
 },
});
