import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'MyLimits',
    version_name: '2.0 Phase 1 preview',
    description: 'Keep your AI accounts, usage limits, and reset times in one place.',
    permissions: ['storage', 'alarms', 'scripting', 'sidePanel'],
    optional_permissions: ['notifications', 'nativeMessaging'],
    optional_host_permissions: [
      'https://claude.ai/*',
      'https://chatgpt.com/*',
      'https://gemini.google.com/*',
      'https://grok.com/*',
      'https://www.perplexity.ai/*',
    ],
    action: { default_title: 'MyLimits' },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    minimum_chrome_version: '116',
  },
});
