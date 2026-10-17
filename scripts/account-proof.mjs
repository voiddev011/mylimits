import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';
import { ProofStore } from '../companion/proof/store.mjs';
import { AccountProof, manualChecks } from '../companion/proof/service.mjs';
import { proofDirectory, runCli } from '../companion/proof/runtime.mjs';
import { claudeProbeArguments } from '../companion/proof/claude.mjs';

const help = `MyLimits account proof (developer diagnostic, not a released connection)
  npm run account-proof           Interactive local checks
  npm run account-proof -- --report   Export cached, redacted evidence; no provider calls
  npm run account-proof -- --help     Show this help

Uses a separate private MyLimitsAccountProof directory, never your normal CLI
profiles. Requires official Codex / Claude Code installed for the chosen provider.
See docs/ACCOUNT-PROOF.md for setup and the pending real-account checks.
No credentials, authorization URLs or transcripts belong in a report or chat.`;

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) { console.log(help); return; }
  if (args.some(arg => arg !== '--report')) throw new Error('Unknown option. Use --help.');
  if (!args.includes('--report') && (!stdin.isTTY || !stdout.isTTY)) throw new Error('Open an interactive terminal, or use --report for cached evidence.');
  const service = new AccountProof({ store: new ProofStore(proofDirectory()) });
  let rl;
  const interfaceAgain = () => { rl = createInterface({ input: stdin, output: stdout }); };
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; rl?.close(); await service.close(); };
  const interrupt = () => { void stop(); };
  await service.load();
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    if (args.includes('--report')) { console.log(await service.exportReport()); return; }
    console.log(help); interfaceAgain();
    const question = text => rl.question(text);
    const profile = async () => {
      const profiles = service.store.profiles;
      if (!profiles.length) throw new Error('Add a proof profile first.');
      profiles.forEach((p, i) => console.log(`${i + 1}. ${p.provider} · ${p.alias}`));
      const input = await question('Profile number: ');
      const index = /^\d{1,2}$/.test(input) ? Number(input) - 1 : -1;
      if (!profiles[index]) throw new Error('Choose a listed profile number.');
      return profiles[index];
    };
    const show = () => {
      for (const p of service.report().profiles) {
        console.log(`${p.provider} · ${p.alias} — ${p.status} (${p.identityGroup ?? 'identity not checked'})`);
        if (p.last) {
          console.log(`  Checked ${new Date(p.last.retrievedAt).toLocaleString()}; upstream freshness not yet proven`);
          p.last.meters.forEach(m => console.log(`  ${m.label}: ${m.usedPercent}% used`));
        }
      }
    };
    const withTerminal = async task => {
      rl.close();
      try { return await task(); } finally { if (!stopping) interfaceAgain(); }
    };
    while (!stopping) {
      const choice = (await question('\n[a] Add  [l] Login  [i] Claude onboarding  [c] Check  [s] Status  [e] Evidence  [r] Report  [o] Sign out  [q] Quit\n> ')).trim().toLowerCase();
      try {
        if (choice === 'q') break;
        if (choice === 'a') {
          const provider = (await question('Provider (openai / claude): ')).trim().toLowerCase();
          const alias = (await question('Nickname, e.g. Personal or Work (no email): ')).trim();
          const p = await service.store.create(provider, alias);
          console.log(`Created isolated ${p.provider} profile: ${p.alias}. Sign-in has not started.`);
        } else if (choice === 'l') {
          const p = await profile();
          if (p.provider === 'claude') {
            console.log('Experimental manual test: Claude Code opens its own sign-in. Automatic fresh-browser routing is NOT verified.');
            console.log('Do not sign out your normal browser account. Use a provider account chooser if offered; cancel if B cannot be selected.');
            if (await question('Run official CLI login anyway? Type manual to continue: ') !== 'manual') continue;
            await withTerminal(() => service.login(p.id, { manualClaudeBrowser: true }));
          } else {
            console.log('Opening a separate browser profile. Complete OpenAI sign-in there; leave your primary browser unchanged.');
            await service.login(p.id);
          }
          console.log(`CLI identity (local display only): ${service.identities.get(p.id)?.display ?? 'unverified'}`);
          show();
        } else if (choice === 'i') {
          const p = await profile();
          if (p.provider !== 'claude') throw new Error('Onboarding applies only to Claude profiles.');
          console.log('First-party Claude onboarding in an empty profile-owned workspace. Complete setup/trust prompts, then /exit.');
          console.log('Do not enter a model prompt. MyLimits does not record this terminal. This is a diagnostic step only.');
          if (await question('Type setup to continue: ') !== 'setup') continue;
          const context = await service.context(p);
          await withTerminal(() => runCli(context.executable, claudeProbeArguments(), { env: context.env, cwd: context.workspace, inherit: true, timeout: 180_000 }));
        } else if (choice === 'c') {
          const p = await profile();
          await service.check(p.id);
          console.log(`CLI identity (local display only): ${service.identities.get(p.id)?.display ?? 'unverified'}`);
          show();
        } else if (choice === 'o') {
          const p = await profile();
          if (await question(`Sign out only the isolated ${p.alias} CLI profile? Type logout: `) !== 'logout') continue;
          await service.logout(p.id); console.log('Official CLI confirmed logout. Dated quota remains saved.');
        } else if (choice === 's') show();
        else if (choice === 'e') {
          const provider = (await question('Provider (openai / claude): ')).trim();
          manualChecks.forEach((name, i) => console.log(`${i + 1}. ${name}`));
          const index = Number(await question('Check number: ')) - 1;
          const result = (await question('Your actual result (pass / fail / pending): ')).trim();
          await service.observe(provider, manualChecks[index], result);
          console.log('Recorded as user-reported evidence. Overall gate still requires review.');
          console.log(await service.exportReport());
        } else if (choice === 'r') console.log(await service.exportReport());
        else console.log('Choose a listed action.');
      } catch (error) {
        // Only our fixed messages, never raw CLI output, may be shown here.
        console.log(error.code ? `${error.code}: ${error.message}` : 'Operation could not complete. Check the diagnostic instructions and installed CLI.');
      }
    }
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    await stop();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Account proof could not start. Check docs/ACCOUNT-PROOF.md; no provider output was logged.'); process.exitCode = 1; });
}
