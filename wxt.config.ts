import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { vaultEnabled } from './src/core/vault-policy';
import { PROVIDER_IDS } from './src/core/model';
const savedSignIn=PROVIDER_IDS.some(vaultEnabled);
const spike=process.env.MYLIMITS_SPIKE==='1';

export default defineConfig({
  manifestVersion:3,
  outDir:spike?'.output-spike':'.output',
  hooks:{'entrypoints:resolved':(_wxt,entries)=>{if(spike&&_wxt.config.browser==='firefox')throw new Error('The C6 evidence spike requires Chromium. Normal Firefox builds remain supported.');if(!spike)for(let i=entries.length-1;i>=0;i--)if(entries[i]!.name==='spike')entries.splice(i,1);}},
  modules: ['@wxt-dev/module-react'],
  zip: { zipSources:false,excludeSources:['artifacts/**','local-data/**','**/.env*','**/*.pem','**/*.key'],artifactTemplate: `{{name}}-{{packageVersion}}-{{browser}}${spike?'-spike':''}.zip` },
  vite: ({browser}) => ({ plugins: [tailwindcss()],define:{__MYLIMITS_SPIKE__:JSON.stringify(spike),__MYLIMITS_BROWSER__:JSON.stringify(browser)} }),
  manifest: ({browser}) => ({
    name: spike?'MyLimits · Evidence spike (test accounts only)':'MyLimits',
    version: '3.4.0',
    version_name: spike?'3.4 Evidence spike - not for release':'3.4 Website tracking',
    description: 'Keep your AI accounts, usage limits, and reset times in one place.',
    permissions: ['storage', 'alarms', 'scripting','idle',...(spike?['cookies','declarativeNetRequestWithHostAccess','webRequest']:[]),...(browser==='firefox'?[]:['sidePanel'])],
    optional_permissions: ['notifications',...(spike?[]:['cookies',...(savedSignIn&&browser!=='firefox'?['declarativeNetRequestWithHostAccess']:[])])],
    ...(spike?{options_ui:{page:'spike.html',open_in_tab:true}}:{}),
    optional_host_permissions: [
      'https://claude.ai/*',
      'https://chatgpt.com/*',
      'https://cursor.com/*',
      'https://api.github.com/*',
    ],
    action: { default_title: 'MyLimits',...(spike?{default_popup:'spike.html'}:{}) },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    ...(browser==='firefox'?{browser_specific_settings:{gecko:{id:'mylimits@voiddev011',strict_min_version:'140.0',data_collection_permissions:{required:['none']}}}}:{minimum_chrome_version:'116'}),
  }),
});
