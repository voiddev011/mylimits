// Deliberately fictional provider process. Never contact a real provider here.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
const home = process.env.CODEX_HOME ?? process.env.CLAUDE_CONFIG_DIR;
const account = async () => JSON.parse(await readFile(path.join(home, 'proof-fixture.json'), 'utf8'));
if (process.argv.includes('--version')) { console.log('fixture 0.0.1'); process.exit(0); }
if (process.argv.includes('app-server')) {
  for await (const line of readline.createInterface({ input: process.stdin })) {
    const request = JSON.parse(line);
    if (request.id === undefined) continue;
    const value = await account();
    let result;
    if (request.method === 'initialize') result = {};
    else if (request.method === 'account/read') result = { account: { type: 'chatgpt', email: value.email, planType: 'plus' }, secret: 'NEVER_EXPORT_FIXTURE_TOKEN' };
    else if (request.method === 'account/rateLimits/read') result = { rateLimits: { primary: { usedPercent: value.used, windowDurationMins: 300 } } };
    else { console.log(JSON.stringify({ id: request.id, error: { message: 'Not allowed by fixture' } })); continue; }
    console.log(JSON.stringify({ id: request.id, result }));
  }
} else if (process.argv.includes('status')) {
  const value = await account();
  console.log(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', configDirectory: home, email: value.email, secret: 'NEVER_EXPORT_FIXTURE_TOKEN' }));
} else {
  if (!process.stdin.isTTY || !process.stdout.isTTY) process.exit(41);
  process.stdin.setRawMode(true);
  const initial = await account();
  process.stdout.write(initial.mode === 'onboarding' ? 'Do you trust the files in this folder?\r\n' : 'Claude fixture\r\n❯ \r\n');
  let input = '';
  process.stdin.on('data', async chunk => {
    if (chunk.includes(3)) process.exit(0); // Official CLI-style graceful interrupt.
    input += chunk.toString();
    if (!input.includes('\r')) return;
    if (input !== '/usage\r') process.exit(42); // Absolutely no model prompt.
    const value = await account();
    if (value.mode === 'unknown-panel') { process.stdout.write('\x1b[2J\x1b[HContext window\r\n35% used\r\nNEVER_EXPORT_FIXTURE_TOKEN\r\n'); return; }
    process.stdout.write('\x1b[2J\x1b[HCurrent session\r\n  ███ ' + value.used + '% used\r\n\r\nCurrent week (all models)\r\n  0% used\r\n');
  });
}
