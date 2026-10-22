import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { command, runCli } from './runtime.mjs';

import { ProbeError } from './errors.mjs';
export { ProbeError } from './errors.mjs';

// Read only documented auth metadata. Never open .credentials.json or a keychain.
export function claudeIdentity(value, expectedDirectory, platform = process.platform) {
  if (!value || value.loggedIn !== true) throw new ProbeError('needs-sign-in', 'Sign in through the official CLI for this profile first.');
  if (value.authMethod !== 'claude.ai') throw new ProbeError('unsupported-auth', 'Only a Claude subscription login is supported by this proof. API keys, Console and injected tokens are excluded.');
  const paths = platform === 'win32' ? path.win32 : path;
  const normalize = file => platform === 'win32' ? paths.resolve(file).toLowerCase() : paths.resolve(file);
  if (typeof value.configDirectory !== 'string' || normalize(value.configDirectory) !== normalize(expectedDirectory)) {
    throw new ProbeError('unverified-profile', 'Claude did not confirm the expected config directory. Update Claude Code (2.1.268+) and retry.');
  }
  const email = typeof value.email === 'string' && /^[^\s@]+@[^\s@]+$/.test(value.email) ? value.email.trim().toLowerCase() : null;
  if (!email) throw new ProbeError('unverified-identity', 'The official auth status did not expose a usable account identity.');
  // These are optional official metadata, not IDs inferred from an email.
  const org = typeof value.orgId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value.orgId) ? value.orgId : null;
  const plan = ['pro', 'max', 'team', 'enterprise'].includes(value.subscriptionType) ? value.subscriptionType : null;
  return { binding: JSON.stringify([email, org]), display: email, organizationId: org, confidence: org ? 'email-and-organization' : 'email-only', plan };
}

export async function readClaudeIdentity({ executable, home, workspace, env, signal, trackProcess }) {
  const { code, output } = await runCli(executable, ['auth', 'status'], { env, cwd: workspace, signal,trackProcess });
  if (code !== 0) throw new ProbeError('needs-sign-in', 'Claude Code is not signed into this proof profile.');
  let value;
  try { value = JSON.parse(output); } catch { throw new ProbeError('unsupported-format', 'Claude auth status returned an unsupported format.'); }
  return claudeIdentity(value, home);
}

const windows = [
  { heading: /^Current session$/i, id: 'session', label: 'Current session', windowMinutes: 300 },
  { heading: /^Current week \(all models\)$/i, id: 'week-all', label: 'Current week · all models', windowMinutes: 10080 },
  { heading: /^Current week \(Opus only\)$/i, id: 'week-opus', label: 'Current week · Opus', windowMinutes: 10080 },
  { heading: /^Current week \(Sonnet only\)$/i, id: 'week-sonnet', label: 'Current week · Sonnet', windowMinutes: 10080 },
];

/** Parse a rendered screen, never a raw ANSI transcript or a status-line cache. */
export function parseClaudeUsage(screen) {
  const lines = screen.split(/\r?\n/).map(line => line.trim());
  if (lines.some(line=>/(?:rate.limit|too many requests|\b429\b)/i.test(line))) {
    throw new ProbeError('throttled','Claude asked to wait before another usage check.');
  }
  if (lines.some(line => /(?:failed|unable) to (?:load|fetch).*usage|(?:rate.limit|too many requests|\b429\b)|usage (?:is )?(?:unavailable|not available)/i.test(line))) {
    throw new ProbeError('unavailable', 'Claude could not provide usage. Wait before checking again.');
  }
  const meters = [];
  for (const window of windows) {
    const starts = lines.flatMap((line, i) => window.heading.test(line) ? [i] : []);
    if (starts.length > 1) throw new ProbeError('unsupported-format', 'Ambiguous Claude usage panel.');
    if (!starts.length) continue;
    const start = starts[0];
    let end = start + 5;
    for (let i = start + 1; i < Math.min(lines.length, end); i++) {
      if (/^Current (?:session|week)\b|^Extra usage\b|^Usage limit\b/i.test(lines[i])) { end = i; break; }
    }
    const matches = lines.slice(start + 1, end).flatMap(line => [...line.matchAll(/(?:^|\s)(\d{1,3}(?:\.\d+)?)%\s+used(?:\s|$)/g)]);
    if (matches.length !== 1) continue;
    const usedPercent = Number(matches[0][1]);
    if (usedPercent > 100) throw new ProbeError('unsupported-format', 'Claude usage percentage is outside the supported range.');
    meters.push({ id: window.id, label: window.label, scope: 'claude-subscription', windowMinutes: window.windowMinutes,
      usedPercent, resetsAt: null, source: 'Claude Code · /usage panel' });
  }
  return meters;
}

export function claudeProbeArguments() {
  return ['--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '',
    '--settings', '{"disableAllHooks":true,"remoteControlAtStartup":false}', '--session-id', randomUUID()];
}

export async function loadTerminalDependencies() {
  try {
    const [pty, xterm] = await Promise.all([import('node-pty'), import('@xterm/headless')]);
    return { spawnPty: (pty.default ?? pty).spawn, Terminal: (xterm.default ?? xterm).Terminal };
  } catch { throw new ProbeError('missing-terminal', 'Terminal support is unavailable. Install optional dependencies: npm install --include=optional.'); }
}

export function stopProbeTerminal(child, alreadyExited = false, timeout = 7000, platform = process.platform) {
  return new Promise(resolve => {
    let exited = alreadyExited, closed = false, finished = false;
    const pid = child.pid;
    const subscription = child.onExit(() => { exited = true; });
    const timer = setTimeout(() => finish(false), timeout);
    const interval = setInterval(check, 50);
    const secondInterrupt = setTimeout(() => { if (!exited) try { child.write('\x03'); } catch {} }, 150);
    const close = () => { if (!closed) { child.kill(); closed = true; } };
    const forceStop = setTimeout(() => { if (!exited) try { close(); } catch {} }, 500);
    function finish(stopped) {
      if (finished) return; finished = true;
      clearTimeout(timer); clearInterval(interval); clearTimeout(secondInterrupt); clearTimeout(forceStop); subscription.dispose();
      // On Windows, observing process exit is not equivalent to disposing the
      // PTY. node-pty's OS-ConPTY backend retains its drain worker/input handle
      // after a natural exit until kill() closes the terminal. This matters for
      // successful auth login as well as cancelled probes in a long-lived host.
      // Use its public cleanup API, once, only after the CLI is confirmed gone.
      if (stopped && platform === 'win32') try { close(); } catch { stopped = false; }
      resolve(stopped);
    }
    function check() {
      let alive = false;
      if (Number.isInteger(pid) && pid > 0) {
        try { process.kill(pid, 0); alive = true; } catch (error) { alive = error.code !== 'ESRCH'; }
      }
      if (exited && !alive) finish(true);
    }
    // Let the unmodified CLI handle Ctrl+C before closing ConPTY handles. This
    // avoids a Windows console-enumeration race and sends no text/model prompt.
    if (!alreadyExited) try { child.write('\x03'); } catch {}
    check();
  });
}

/** A fresh process per explicit check. Only /usage and terminal replies are sent. */
export async function probeClaudeUsage({ executable, workspace, env, timeout = 30_000, settleMs = 800, dependencies, signal, trackProcess }) {
  const { spawnPty, Terminal } = dependencies ?? await loadTerminalDependencies();
  if (signal?.aborted) throw new ProbeError('cancelled', 'Check cancelled.');
  const [file, args] = command(executable, claudeProbeArguments());
  const terminal = new Terminal({ cols: 120, rows: 50, scrollback: 0, allowProposedApi: true });
  let child;
  try { child = spawnPty(file, args, { name: 'xterm-256color', cols: 120, rows: 50, cwd: workspace, env, useConpty: true }); }
  catch { terminal.dispose(); throw new ProbeError('terminal-unavailable', 'Could not start the Claude terminal. See diagnostic setup instructions.'); }
  const ownership=Promise.resolve(trackProcess?.(child,file));
  ownership.catch(()=>{});
  return new Promise((resolve, reject) => {
    let done = false, sent = false, size = 0, settling, exited = false;
    const subscriptions = [];
    const finish = (error, result) => {
      if (done) return; done = true;
      clearTimeout(timer); clearTimeout(settling); signal?.removeEventListener('abort', abort);
      for (const subscription of subscriptions) subscription.dispose();
      terminal.dispose();
      // kill() is asynchronous on Windows. Do not hand a result to the caller
      // or release its ownership lock while the profile process still runs.
      void stopProbeTerminal(child, exited).then(async stopped => {
        if (!stopped) reject(new ProbeError('terminal-stop-unconfirmed', 'Could not confirm the probe terminal stopped. Close the diagnostic and check its owned processes before restarting.'));
        else {try{const release=await ownership;await release?.();}catch{reject(new ProbeError('terminal-stop-unconfirmed','Desktop process recovery requires setup repair.'));return;}error ? reject(error) : resolve(result);}
      });
    };
    const abort = () => finish(new ProbeError('cancelled', 'Check cancelled.'));
    const timer = setTimeout(() => finish(new ProbeError('unsupported-panel', 'No supported /usage panel appeared. Complete first-party CLI setup in the isolated profile, or report the CLI version.')), timeout);
    signal?.addEventListener('abort', abort, { once: true });
    const screen = () => {
      const buffer = terminal.buffer.active;
      return Array.from({ length: buffer.length }, (_, i) => buffer.getLine(i)?.translateToString(true) ?? '').join('\n');
    };
    subscriptions.push(terminal.onData(data => { if (!done) child.write(data); }));
    subscriptions.push(child.onData(data => {
      if (done) return;
      size += Buffer.byteLength(data);
      if (size > 2 * 1024 * 1024) { finish(new ProbeError('output-limit', 'Claude exceeded the diagnostic output limit.')); return; }
      // In-memory terminal only: raw output is never written, printed or exported.
      terminal.write(data, () => {
        if (done) return;
        const text = screen();
        if (/trust this folder|trust the files|select.*login|choose.*theme|choose the text style|select.*text style|sign in to (?:Claude|your account)/i.test(text)) {
          finish(new ProbeError('needs-setup', 'Complete official Claude Code onboarding in this isolated probe workspace first.')); return;
        }
        if (!sent && /(?:^|\n)\s*[❯>]\s*(?:\n|$)/u.test(text)) {
          sent = true; child.write('/usage\r'); return;
        }
        if (!sent) return;
        clearTimeout(settling);
        // Wait for a quiet, fully rendered panel; do not accept a partial redraw.
        settling = setTimeout(() => {
          try {
            const meters = parseClaudeUsage(screen());
            if (meters.length) finish(null, { meters, source: 'claude-cli-panel', providerObservedAt: null,
              freshness: 'panel-read; upstream freshness requires live comparison' });
          } catch (error) { finish(error); }
        }, settleMs);
      });
    }));
    subscriptions.push(child.onExit(() => { exited = true; finish(new ProbeError('cli-stopped', 'Claude stopped before a supported usage panel could be read.')); }));
    void ownership.catch(()=>finish(new ProbeError('terminal-stop-unconfirmed','Desktop process recovery requires setup repair.')));
  });
}
