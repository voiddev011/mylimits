import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState } from '../ui/demo';
import { diagnostics, privatePresentation, needsAttention,accountSource,connectionSource } from './presentation';
import { collectAlerts } from './engine';
import { emptyStore } from './model';
import { SettingsSchema } from './schema';

test('privacy projection survives reorder without changing saved identity or names', () => {
  const state = demoState(); const original = structuredClone(state);
  const shown = privatePresentation(state);
  assert.deepEqual(state, original);
  for (const a of state.accounts) {
    assert.equal(shown.accounts.find(x => x.id === a.id)?.alias,
      privatePresentation({...state, accounts: [...state.accounts].reverse()}).accounts.find(x => x.id === a.id)?.alias);
    assert.ok(!JSON.stringify(shown).includes(a.alias || a.defaultName));
  }
});
test('diagnostics excludes free-form error, identity, workspace and meter data', () => {
  const state = demoState(); state.connections[0]!.message = 'SECRET_EMAIL SECRET_TOKEN';
  const text = JSON.stringify(diagnostics(state, '3.0.0', Date.now()));
  assert.ok(!text.includes('SECRET')); for(const a of state.accounts) assert.ok(!text.includes(a.id));
  assert.ok(!text.includes('meters')); assert.ok(!text.includes('workspace'));
});
test('old settings remain valid and new presentation settings are validated', () => {
  const settings = emptyStore('test').settings; delete settings.textSize; delete settings.privacyMode;
  assert.ok(SettingsSchema.safeParse(settings).success);
  assert.ok(!SettingsSchema.safeParse({...settings,textSize:'tiny'}).success);
});
test('needs attention includes signed-out and old readings but excludes local activity', () => {
  const state = demoState(1800000000000); const a = state.accounts.find(a=>a.meters.length)!;
  assert.equal(needsAttention({...a,connection:'signed-out'},state.settings,1800000000000),true);
  assert.equal(needsAttention({...a,kind:'browser'},state.settings,1800000000000),false);
});
test('privacy mode masks desktop notification titles and meter labels', () => {
  const now=1800000000000, demo=demoState(now), store=emptyStore('test');
  store.accounts=[{...demo.accounts.find(a=>a.meters.some(m=>m.evidence==='reported'))!,alias:'SECRET',connection:'active'}];
  store.accounts[0]!.meters=store.accounts[0]!.meters.map(m=>({...m,label:'SECRET_WINDOW',usedPercent:99,observedAt:now,resetsAt:now+3600000}));
  store.settings={...store.settings,desktopAlerts:true,privacyMode:true};
  const {alerts}=collectAlerts(store,now); assert.ok(alerts.length); assert.ok(!JSON.stringify(alerts.map(a=>[a.title,a.message])).includes('SECRET'));
});
test('source labels follow the live bound reading, not the provider or an account nickname',()=>{
 const state=demoState(),account=state.accounts[0]!;
 state.connections=[{...emptyStore('fixture').connections[0]!,id:'old',kind:'website',accountId:account.id,status:'needs-auth',enabled:true},
  {...emptyStore('fixture').connections[0]!,id:'current',kind:'vault',accountId:account.id,status:'active',enabled:true}];
 account.meters=account.meters.map(m=>({...m,connectionId:'current'}));
 assert.equal(accountSource(account,state),'Saved sign-in');
 assert.equal(connectionSource('companion'),'Companion');assert.equal(connectionSource('cloud'),'Hosted');
 assert.equal(accountSource({...account,id:'unbound'},state),'Saved reading');
});
