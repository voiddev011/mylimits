import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import path from 'node:path';
export function companionPaths(platform, home, localAppData) {
  if (platform === 'win32') {
    const directory = path.win32.join(localAppData || path.win32.join(home, 'AppData', 'Local'), 'MyLimitsCompanion');
    const hash = createHash('sha256').update(directory.toLowerCase()).digest('hex').slice(0, 24);
    return { dataDir: directory, socketPath: `\\\\.\\pipe\\mylimits-${hash}` };
  }
  const directory = path.join(home, '.local', 'share', 'mylimits-companion');
  return { dataDir: directory, socketPath: path.join(directory, 'companion.sock') };
}
export const { dataDir, socketPath } = companionPaths(process.platform, homedir(), process.env.LOCALAPPDATA);
export const hostName = 'com.mylimits.openai';
