import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openAuthBrowser } from './auth-browser.mjs';
import { safeAuthUrl } from './protocol.mjs';

// Executed only by the official CLI's documented BROWSER override. No OAuth
// exchange, credential read or auth URL logging. The first-party callback stays
// in Claude Code. The marker contains no URL/state/code/token.
export async function routeClaudeBrowser(url, env = process.env, launch = openAuthBrowser) {
  const directory = env.MYLIMITS_AUTH_BROWSER_DIRECTORY;
  if (!directory || !path.isAbsolute(directory) || !safeAuthUrl(url, 'claude')) throw new Error('Unsupported provider browser request.');
  await launch({ directory, url, provider: 'claude' });
  await writeFile(path.join(directory, 'route-result.json'), JSON.stringify({ opened: true }), { mode: 0o600 });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, input, ...extra] = process.argv.slice(2);
    if (!['--raw','--encoded'].includes(mode) || !input || extra.length) throw new Error();
    const url = mode === '--encoded' ? Buffer.from(input, 'base64').toString('utf8') : input;
    await routeClaudeBrowser(url);
  } catch { process.exitCode = 1; } // Never print URL, provider output or environment.
}
