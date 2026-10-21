// Run only with explicit official CLI binaries. This experiment starts/cancels
// unauthenticated first-party login and reports metadata; it cannot sign in users.
import path from 'node:path';
import { probeCodexDevice, probeClaudeCallback } from '../companion/proof/hosted-login.mjs';
const args = process.argv.slice(2), selected = new Map();
for (let i = 0; i < args.length; i += 2) {
  if (!['--codex','--claude'].includes(args[i]) || !args[i+1] || !path.isAbsolute(args[i+1]) || selected.has(args[i])) {
    console.error('Usage: node scripts/probe-hosted-login.mjs --codex /official/codex --claude /official/claude'); process.exit(2);
  }
  selected.set(args[i], args[i+1]);
}
if (!selected.size) { console.error('Supply an absolute official CLI path. No account or credential is required.'); process.exit(2); }
const results = [];
if (selected.has('--codex')) results.push(await probeCodexDevice(selected.get('--codex')));
if (selected.has('--claude')) results.push(await probeClaudeCallback(selected.get('--claude')));
console.log(JSON.stringify({ kind: 'unauthenticated-hosted-transport-trial', overall: 'not-live-account-verified', results }, null, 2));
if (results.some(r => r.status === 'blocked' || !r.shutdownConfirmed)) process.exitCode = 1;
