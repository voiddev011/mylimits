import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { SYNC_DATA_TYPES } from './src/core/browser-capabilities';
import { validateSyncOrigin,syncPermission } from './src/core/sync-origin';
const syncOrigin=validateSyncOrigin(process.env.MYLIMITS_SYNC_ORIGIN??'');
const desktopSetupURL=process.env.MYLIMITS_DESKTOP_SETUP_URL??'';
if(desktopSetupURL){const url=new URL(desktopSetupURL);if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error('Desktop setup URL must be public HTTPS.');}

export default defineConfig({
  manifestVersion:3,
  modules: ['@wxt-dev/module-react'],
  zip: { zipSources:false,excludeSources:['artifacts/**','local-data/**','server/web-dist/**','**/.env*','**/*.pem','**/*.key'],artifactTemplate: '{{name}}-{{packageVersion}}-{{browser}}.zip' },
  vite: ({browser}) => ({ plugins: [tailwindcss()],define:{__MYLIMITS_SYNC_ORIGIN__:JSON.stringify(syncOrigin),__MYLIMITS_BROWSER__:JSON.stringify(browser),__MYLIMITS_DESKTOP_SETUP_URL__:JSON.stringify(desktopSetupURL)} }),
  manifest: ({browser}) => ({
    name: 'MyLimits',
    version: '3.4.0',
    version_name: '3.4 Desktop accounts preview',
    description: 'Keep your AI accounts, usage limits, and reset times in one place.',
    permissions: ['storage', 'alarms', 'scripting','idle',...(browser==='firefox'?[]:['sidePanel'])],
    optional_permissions: ['notifications','cookies',...(browser==='firefox'?[]:['nativeMessaging'])],
    optional_host_permissions: [
      'https://claude.ai/*',
      'https://chatgpt.com/*',
      'https://gemini.google.com/*',
      'https://grok.com/*',
      'https://www.perplexity.ai/*',
      'https://cursor.com/*',
      ...(syncOrigin?[syncPermission(syncOrigin)]:[]),
    ],
    action: { default_title: 'MyLimits' },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    ...(browser==='firefox'?{browser_specific_settings:{gecko:{id:'mylimits@voiddev011',strict_min_version:'140.0',data_collection_permissions:syncOrigin?{required:[],optional:SYNC_DATA_TYPES}:{required:['none']}}}}:{minimum_chrome_version:'116'}),
  }),
});
