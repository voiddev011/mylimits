import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { SYNC_DATA_TYPES } from './src/core/browser-capabilities';
import { validateSyncOrigin,syncPermission } from './src/core/sync-origin';
const syncOrigin=validateSyncOrigin(process.env.MYLIMITS_SYNC_ORIGIN??'');

export default defineConfig({
  manifestVersion:3,
  modules: ['@wxt-dev/module-react'],
  zip: { artifactTemplate: '{{name}}-{{packageVersion}}-{{browser}}.zip' },
  vite: ({browser}) => ({ plugins: [tailwindcss()],define:{__MYLIMITS_SYNC_ORIGIN__:JSON.stringify(syncOrigin),__MYLIMITS_BROWSER__:JSON.stringify(browser)} }),
  manifest: ({browser}) => ({
    name: 'MyLimits',
    version: '2.0.0',
    version_name: '2.0 Phase 1 preview',
    description: 'Keep your AI accounts, usage limits, and reset times in one place.',
    permissions: ['storage', 'alarms', 'scripting',...(browser==='firefox'?[]:['sidePanel'])],
    optional_permissions: ['notifications',...(browser==='firefox'?[]:['nativeMessaging'])],
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
