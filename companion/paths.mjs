import { homedir } from 'node:os';
import path from 'node:path';
export const dataDir = path.join(homedir(), '.local', 'share', 'mylimits-companion');
export const socketPath = path.join(dataDir, 'companion.sock');
export const hostName = 'com.mylimits.openai';
