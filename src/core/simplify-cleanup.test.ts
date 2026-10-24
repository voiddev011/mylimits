import test from 'node:test';import assert from 'node:assert/strict';
import { emptyStore,websiteConnection } from './model';import { StoreSchema } from './schema';import { cleanupRetiredState } from './simplify-cleanup';
function saved(current:boolean){const s=emptyStore('keep-salt'),a={id:'keep',provider:'claude',kind:'account',alias:'Keep alias',defaultName:'Claude',plan:null,meters:[],connection:'active',createdAt:1,updatedAt:2,alertRemaining:20,alertsMuted:false};
 const raw:Record<string,any>={...s,accounts:[a,{...a,id:'retired',provider:'gemini'},{...a,id:'external'}],connections:[...s.connections,{...websiteConnection('claude'),id:'cloud:remote',kind:'cloud',accountId:'external'},{...websiteConnection('claude'),id:'website:gemini',provider:'gemini',accountId:'retired'}],snapshots:[{schemaVersion:2,snapshotId:'drop',providerId:'gemini',accountId:'retired',connectionId:'website:gemini',workspaceId:null,observedAt:2,receivedAt:2,connectorVersion:'fixture',meters:[]}],providers:{...s.providers,gemini:s.providers.claude,grok:s.providers.claude,perplexity:s.providers.claude}};
 if(!current){delete raw.providers.copilot;delete raw.providers.cursor;raw.connections=raw.connections.filter((c:any)=>c.provider!=='cursor')}
 return raw;
}
for(const current of [false,true])test(`U1 ${current?'current':'2.2-era'} store drops retired routes and preserves retained identity/settings`,()=>{
 const raw=saved(current),parsed=StoreSchema.parse(raw);assert.equal(parsed.version,2);assert.equal(parsed.installSalt,raw.installSalt);assert.deepEqual(parsed.accounts,[raw.accounts[0]]);assert.deepEqual(parsed.settings,raw.settings);assert.deepEqual(parsed.snapshots,[]);assert.deepEqual(Object.keys(parsed.providers),['claude','chatgpt','cursor','copilot']);assert.ok(parsed.connections.every(c=>c.kind==='website'||c.kind==='vault'));assert.equal(StoreSchema.safeParse({...raw,accounts:[{...raw.accounts[0],updatedAt:'broken'}]}).success,false);
});
test('U1 cleanup journals deleted IDs across state rewrite/history failure and erases obsolete keys only after validation',async()=>{
 const values:Record<string,unknown>={'mylimits:state:v2':saved(true),'mylimits:widget:v1':{enabled:true},'mylimits:sync:private:v1':{fictional:true},'mylimits:hosted:attempt:v1':{},'mylimits:companion-enabled':true,'unrelated':'keep'};
 const local={get:async()=>structuredClone(values),set:async(v:Record<string,unknown>)=>{Object.assign(values,structuredClone(v))},remove:async(ks:string|string[])=>{for(const k of typeof ks==='string'?[ks]:ks)delete values[k]}};
 const initialize=async()=>{values['mylimits:state:v2']=StoreSchema.parse(values['mylimits:state:v2'])};
 await assert.rejects(cleanupRetiredState(local,initialize,async()=>{throw Error('history interrupted')}));assert.ok(values['mylimits:u1-cleanup:v1']);
 let removed:string[]=[],sources:string[]=[];await cleanupRetiredState(local,initialize,async (ids,connections)=>{removed=ids;sources=connections});assert.ok(sources.includes('cloud:remote'));assert.deepEqual(removed.sort(),['external','retired']);assert.equal(values.unrelated,'keep');assert.equal(values['mylimits:u1-completed:v1'],true);assert.equal(values['mylimits:widget:v1'],undefined);assert.equal(values['mylimits:sync:private:v1'],undefined);assert.equal(values['mylimits:hosted:attempt:v1'],undefined);assert.equal(values['mylimits:companion-enabled'],undefined);
 await cleanupRetiredState(local,initialize,async()=>{throw Error('must run only once')});
});
test('U1 removes every retired connection kind, including opaque IDs, without accepting unknown kinds',()=>{
 for(const kind of ['companion','cloud','snapshot-import','independent-local']){
  const raw=saved(true);raw.connections=raw.connections.map((c:any)=>c.kind==='cloud'?{...c,kind,id:'opaque-connection-id'}:c);
  const parsed=StoreSchema.parse(raw);assert.deepEqual(parsed.accounts.map(a=>a.id),['keep']);assert.ok(!parsed.connections.some(c=>c.id==='opaque-connection-id'));
 }
 const future=saved(true);future.connections.push({...websiteConnection('claude'),kind:'future-unknown'});assert.equal(StoreSchema.safeParse(future).success,false);
});

test('combined cleanup retains Copilot connections and their separate token storage',async()=>{
 const raw=saved(true),slot='10000000-0000-4000-8000-000000000001';
 raw.accounts.push({...raw.accounts[0],id:'copilot-kept',provider:'copilot'});
 raw.connections.push({...websiteConnection('copilot'),id:`copilot:${slot}`,kind:'copilot',profileId:slot,accountId:'copilot-kept',enabled:true,status:'active'});
 const tokenEnvelope={[slot]:{iv:'FICTIONAL_NONCE',data:'FICTIONAL_CIPHERTEXT'}};
 const data:Record<string,unknown>={'mylimits:state:v2':raw,'mylimits:tokens:v1':tokenEnvelope};
 const local={get:async()=>structuredClone(data),set:async(v:Record<string,unknown>)=>{Object.assign(data,structuredClone(v))},remove:async(ks:string|string[])=>{for(const k of typeof ks==='string'?[ks]:ks)delete data[k]}};
 let deleted:string[]=[];await cleanupRetiredState(local,async()=>{data['mylimits:state:v2']=StoreSchema.parse(data['mylimits:state:v2'])},async ids=>{deleted=ids});
 const store=StoreSchema.parse(data['mylimits:state:v2']);assert.ok(store.accounts.some(a=>a.id==='copilot-kept'));assert.ok(store.connections.some(c=>c.id===`copilot:${slot}`));assert.ok(!deleted.includes('copilot-kept'));assert.deepEqual(data['mylimits:tokens:v1'],tokenEnvelope);
});
