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
const defaults = companionPaths(process.platform, homedir(), process.env.LOCALAPPDATA);
// Explicit operator/test relocation; never accepted from an extension request.
const relocated = process.env.MYLIMITS_DESKTOP_DATA_DIR;
if (relocated && !path.isAbsolute(relocated)) throw new Error('Desktop data directory must be absolute.');
export const dataDir = relocated || defaults.dataDir;
export const socketPath = !relocated ? defaults.socketPath : process.platform === 'win32'
  ? `\\\\.\\pipe\\mylimits-${createHash('sha256').update(dataDir.toLowerCase()).digest('hex').slice(0,24)}`
  : path.join(dataDir,'companion.sock');
export const hostName = 'com.mylimits.openai';
