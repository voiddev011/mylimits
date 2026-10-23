import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';
for(const target of ['chrome','edge','firefox']){
 const dir=`.output/${target}-mv3`,m=JSON.parse(await readFile(`${dir}/manifest.json`));assert.equal(m.manifest_version,3);assert.ok(!m.host_permissions?.length,'Provider grants must remain optional');assert.ok(!JSON.stringify(m).includes('<all_urls>'));assert.ok(!m.content_scripts?.length,'Website scripts must be opt-in runtime registrations');
 for(const file of ['providers/claude.svg','providers/chatgpt.svg','providers/gemini.png','providers/grok.svg','providers/perplexity.svg','providers/cursor.svg','popup.html','dashboard.html','background.js','content-scripts/widget.js'])await access(`${dir}/${file}`);
 if(target==='firefox'){assert.ok(!m.permissions.includes('sidePanel'));assert.ok(!m.optional_permissions.includes('nativeMessaging'));assert.ok(!m.background.service_worker);assert.equal(m.sidebar_action.default_panel,'sidepanel.html');assert.ok(m.browser_specific_settings.gecko.data_collection_permissions)}else{assert.equal(m.background.service_worker,'background.js');assert.equal(m.side_panel.default_path,'sidepanel.html')}
 console.log(`${target}: optional grants, entrypoints and browser-specific manifest verified`);
}
