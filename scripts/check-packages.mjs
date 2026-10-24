import assert from 'node:assert/strict';import {readFile,access,readdir} from 'node:fs/promises';
import {assertReleaseHasNoSpike} from './package-policy.mjs';
async function filesUnder(dir,prefix=''){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())files.push(...await filesUnder(dir+'/'+entry.name,name+'/'));else files.push(name);}return files;}
for(const target of ['chrome','edge','firefox']){
 const dir=`.output/${target}-mv3`,m=JSON.parse(await readFile(`${dir}/manifest.json`));assert.equal(m.manifest_version,3);assert.ok(m.optional_host_permissions.includes('https://api.github.com/*'));assert.ok(!m.host_permissions?.length,'Provider grants must remain optional');assert.ok(!JSON.stringify(m).includes('<all_urls>'));assert.ok(!m.content_scripts?.length,'Website scripts must be opt-in runtime registrations');
 const files=await filesUnder(dir),code=(await Promise.all(files.filter(f=>f.endsWith('.js')||f.endsWith('.html')).map(f=>readFile(`${dir}/${f}`,'utf8')))).join('\n');assertReleaseHasNoSpike(m,files,code);
 for(const file of ['providers/copilot.svg','providers/claude.svg','providers/chatgpt.svg','providers/gemini.png','providers/grok.svg','providers/perplexity.svg','providers/cursor.svg','popup.html','dashboard.html','background.js','content-scripts/widget.js'])await access(`${dir}/${file}`);
 if(target==='firefox'){assert.ok(!m.permissions.includes('sidePanel'));assert.ok(!m.optional_permissions.includes('nativeMessaging'));assert.ok(!m.background.service_worker);assert.equal(m.sidebar_action.default_panel,'sidepanel.html');assert.ok(m.browser_specific_settings.gecko.data_collection_permissions)}else{assert.equal(m.background.service_worker,'background.js');assert.equal(m.side_panel.default_path,'sidepanel.html')}
 console.log(`${target}: optional grants, entrypoints and browser-specific manifest verified`);
}
