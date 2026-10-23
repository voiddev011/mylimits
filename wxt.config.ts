import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { SYNC_DATA_TYPES } from './src/core/browser-capabilities';
import { validateSyncOrigin,syncPermission } from './src/core/sync-origin';
const syncOrigin=validateSyncOrigin(process.env.MYLIMITS_SYNC_ORIGIN??'');
const desktopSetupURL=process.env.MYLIMITS_DESKTOP_SETUP_URL??'';
const spike=process.env.MYLIMITS_SPIKE==='1';
if(desktopSetupURL){const url=new URL(desktopSetupURL);if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error('Desktop setup URL must be public HTTPS.');}

export default defineConfig({
  manifestVersion:3,
  outDir:spike?'.output-spike':'.output',
  hooks:{'entrypoints:resolved':(_wxt,entries)=>{if(spike&&_wxt.config.browser==='firefox')throw new Error('The C6 evidence spike requires Chromium. Normal Firefox builds remain supported.');if(!spike)for(let i=entries.length-1;i>=0;i--)if(entries[i]!.name==='spike')entries.splice(i,1);}},
  modules: ['@wxt-dev/module-react'],
  zip: { zipSources:false,excludeSources:['artifacts/**','local-data/**','server/web-dist/**','**/.env*','**/*.pem','**/*.key'],artifactTemplate: `{{name}}-{{packageVersion}}-{{browser}}${spike?'-spike':''}.zip` },
  vite: ({browser}) => ({ plugins: [tailwindcss()],define:{__MYLIMITS_SPIKE__:JSON.stringify(spike),__MYLIMITS_SYNC_ORIGIN__:JSON.stringify(syncOrigin),__MYLIMITS_BROWSER__:JSON.stringify(browser),__MYLIMITS_DESKTOP_SETUP_URL__:JSON.stringify(desktopSetupURL)} }),
  manifest: ({browser}) => ({
    name: spike?'MyLimits · Evidence spike (test accounts only)':'MyLimits',
    version: '3.4.0',
    version_name: spike?'3.4 Evidence spike - not for release':'3.4 Desktop accounts preview',
    description: 'Keep your AI accounts, usage limits, and reset times in one place.',
    permissions: ['storage', 'alarms', 'scripting','idle',...(spike?['cookies','declarativeNetRequestWithHostAccess','webRequest']:[]),...(browser==='firefox'?[]:['sidePanel'])],
    optional_permissions: ['notifications',...(spike?[]:['cookies']),...(browser==='firefox'?[]:['nativeMessaging'])],
    ...(spike?{options_ui:{page:'spike.html',open_in_tab:true}}:{}),
    optional_host_permissions: [
      'https://claude.ai/*',
      'https://chatgpt.com/*',
      'https://gemini.google.com/*',
      'https://grok.com/*',
      'https://www.perplexity.ai/*',
      'https://cursor.com/*',
      ...(syncOrigin?[syncPermission(syncOrigin)]:[]),
    ],
    action: { default_title: 'MyLimits',...(spike?{default_popup:'spike.html'}:{}) },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    ...(browser==='firefox'?{browser_specific_settings:{gecko:{id:'mylimits@voiddev011',strict_min_version:'140.0',data_collection_permissions:syncOrigin?{required:[],optional:SYNC_DATA_TYPES}:{required:['none']}}}}:{minimum_chrome_version:'116'}),
  }),
});
