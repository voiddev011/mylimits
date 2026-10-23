// Developer-only, unauthenticated transport experiment. Never imported by the
// extension/server or registered as a production collector.
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppServer } from '../app-server.mjs';
import { profileEnvironment, cliVersion, command, runCli } from './runtime.mjs';
import { loadTerminalDependencies, stopProbeTerminal } from './claude.mjs';

export function summarizeDeviceStart(value) {
  // Return only an allowlisted observation. The actual code and login ID are
  // deliberately absent, even when the caller embeds other fields/credentials.
  try {
    const url = new URL(value?.verificationUrl);
    return { issued: value?.type === 'chatgptDeviceCode' &&
      typeof value.loginId === 'string' && value.loginId.length > 0 && value.loginId.length < 200 &&
      typeof value.userCode === 'string' && /^[A-Z0-9-]{4,32}$/.test(value.userCode) &&
      url.protocol === 'https:' && url.hostname === 'auth.openai.com' && url.pathname === '/codex/device' &&
      !url.port && !url.username && !url.password && !url.hash && !url.search };
  } catch { return { issued: false }; }
}

// Observe the official managed browser route without opening it or changing it.
// A loopback callback issued on a server cannot complete in a laptop browser.
// This deliberately does not relay codes or substitute a redirect URI.
export function summarizeCodexBrowserStart(value) {
  const rejected = { issued: false, callback: 'unsupported' };
  try {
    const url = new URL(value?.authUrl);
    if (value?.type !== 'chatgpt' || typeof value.loginId !== 'string' ||
        !value.loginId.length || value.loginId.length > 200 ||
        url.protocol !== 'https:' || url.hostname !== 'auth.openai.com' ||
        url.username || url.password || url.port || url.hash ||
        !['/oauth/authorize', '/api/accounts/authorize'].includes(url.pathname) ||
        url.searchParams.get('response_type') !== 'code' ||
        !url.searchParams.get('state') || !url.searchParams.get('code_challenge') ||
        url.searchParams.get('code_challenge_method') !== 'S256') return rejected;
    const redirect = new URL(url.searchParams.get('redirect_uri'));
    const loopback = redirect.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(redirect.hostname) &&
      !!redirect.port && redirect.pathname === '/auth/callback' &&
      !redirect.username && !redirect.password && !redirect.search && !redirect.hash;
    return { issued: true, callback: loopback ? 'loopback' : 'unestablished' };
  } catch { return rejected; }
}

export function classifyClaudeAuthorization(value) {
  try {
    const url = new URL(value);
    const firstParty = url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'claude.ai' && url.pathname === '/oauth/authorize' ||
       url.hostname === 'claude.com' && url.pathname === '/cai/oauth/authorize') &&
      url.searchParams.get('response_type') === 'code' && !!url.searchParams.get('state') && !!url.searchParams.get('code_challenge');
    if (!firstParty) return { firstParty: false, callback: 'unsupported' };
    const redirect = new URL(url.searchParams.get('redirect_uri'));
    const loopback = redirect.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(redirect.hostname) &&
      !!redirect.port && !redirect.username && !redirect.password && redirect.pathname === '/callback';
    const manualCodePage = redirect.protocol === 'https:' && redirect.hostname === 'platform.claude.com' &&
      redirect.pathname === '/oauth/code/callback' && !redirect.username && !redirect.password && !redirect.port;
    return { firstParty: true, callback: loopback ? 'loopback' : manualCodePage ? 'provider-code-page' : 'unsupported' };
  } catch { return { firstParty: false, callback: 'unsupported' }; }
}

async function stopServer(client) {
  const child = client.child;
  if (child.exitCode !== null || child.signalCode) { client.close(); return true; }
  let timer, onExit;
  const stopped = new Promise(resolve => {
    onExit = () => resolve(true); child.once('exit', onExit);
    timer = setTimeout(() => resolve(false), 5000);
  });
  client.close();
  try { return await stopped; } finally { clearTimeout(timer); child.removeListener('exit', onExit); }
}

export async function probeCodexDevice(executable, options = {}) {
  return probeCodexTransport(executable, 'device', options);
}

export async function probeCodexBrowser(executable, options = {}) {
  return probeCodexTransport(executable, 'browser', options);
}

async function probeCodexTransport(executable, mode, { makeClient = options => new AppServer(options), version = cliVersion } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'mylimits-hosted-codex-'));
  const result = { provider: 'openai', version: null, transport: mode === 'browser' ? 'official-managed-browser' : 'official-device-code',
    initialAccountAbsent: false, issued: false, cancelAcknowledged: false,
    shutdownConfirmed: false, authenticated: false, quotaFetched: false, status: 'blocked', errorCode: null };
  if (mode === 'browser') {
    result.callback = 'unobserved';
    result.hostedSuccessPageRequested = true;
  }
  let client, loginId, retainProfile = false;
  try {
    const env = profileEnvironment('openai', root);
    // Force official file storage in this fresh directory; no ambient OS account.
    await writeFile(path.join(root, 'config.toml'), 'cli_auth_credentials_store = "file"\n', { mode: 0o600 });
    result.version = await version(executable, { env, cwd: root });
    client = makeClient({ executable, home: root, environment: env, timeout: 15000 });
    await client.ready;
    const account = await client.request('account/read', { refreshToken: false });
    if (account?.account !== null) throw Object.assign(Error(), { code: 'unexpected-account' });
    result.initialAccountAbsent = true;
    const response = await client.request('account/login/start', mode === 'browser'
      ? { type: 'chatgpt', useHostedLoginSuccessPage: true }
      : { type: 'chatgptDeviceCode' });
    if (typeof response?.loginId === 'string' && response.loginId.length < 200) loginId = response.loginId;
    const summary = mode === 'browser' ? summarizeCodexBrowserStart(response) : summarizeDeviceStart(response);
    result.issued = summary.issued;
    if (mode === 'browser') result.callback = summary.callback;
    if (!result.issued) throw Object.assign(Error(), { code: 'unsupported-response' });
    // Do not open the link, approve anything or request any quota/model operation.
    await client.request('account/login/cancel', { loginId }); loginId = null;
    result.cancelAcknowledged = true;
  } catch (error) {
    retainProfile = error?.code === 'terminal-stop-unconfirmed';
    result.errorCode = ['unexpected-account','unsupported-response','throttled','needs-sign-in','unavailable','terminal-stop-unconfirmed'].includes(error?.code) ? error.code : 'probe-failed';
  } finally {
    if (client) {
      if (loginId) try { await client.request('account/login/cancel', { loginId }); result.cancelAcknowledged = true; } catch {}
      result.shutdownConfirmed = await stopServer(client);
    }
    // Never remove an owned profile while an unconfirmed writer might still run.
    if (!retainProfile && (!client || result.shutdownConfirmed)) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  if (result.issued && result.cancelAcknowledged && result.shutdownConfirmed && !result.errorCode) result.status = 'transport-observed-only';
  return result;
}

export async function probeClaudeCallback(executable) {
  const root = await mkdtemp(path.join(tmpdir(), 'mylimits-hosted-claude-'));
  const result = { provider: 'claude', version: null, transport: 'official-cli-browser-override',
    customCallbackFlagAdvertised: false, firstParty: false, callback: 'unobserved',
    shutdownConfirmed: false, authenticated: false, quotaFetched: false, automaticRemoteLoginProven: false,
    status: 'blocked', errorCode: null };
  let child, exited = false, retainProfile = false;
  try {
    if (process.platform === 'win32') throw Object.assign(Error(), { code: 'linux-host-probe-only' });
    const home = path.join(root, 'profile'), workspace = path.join(root, 'empty');
    await mkdir(home); await mkdir(workspace);
    const env = profileEnvironment('claude', home);
    result.version = await cliVersion(executable, { env, cwd: workspace });
    const help = await runCli(executable, ['auth','login','--help'], { env, cwd: workspace });
    result.customCallbackFlagAdvertised = /--(?:callback|redirect)(?:-uri|-url)?\b/.test(help.output);
    const marker = path.join(root, 'observation.json'), script = path.join(root, 'browser.mjs');
    await writeFile(script, `import {writeFileSync} from 'node:fs';import {classifyClaudeAuthorization} from ${JSON.stringify(import.meta.url)};const v=classifyClaudeAuthorization(process.argv[2]);if(!v.firstParty)process.exit(2);writeFileSync(${JSON.stringify(marker)},JSON.stringify(v),{mode:0o600});`);
    const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
    env.BROWSER = path.join(root, 'browser');
    await writeFile(env.BROWSER, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(script)} "$@"\n`, { mode: 0o700 });
    const { spawnPty } = await loadTerminalDependencies();
    const [file, args] = command(executable, ['auth','login','--claudeai']);
    child = spawnPty(file, args, { env, cwd: workspace, cols: 120, rows: 40, name: 'xterm-256color' });
    let bytes = 0;
    child.onData(data => { bytes += Buffer.byteLength(data); });
    child.onExit(() => { exited = true; });
    const started = Date.now();
    while (Date.now() - started < 15000 && !exited && bytes < 2 * 1024 * 1024) {
      try {
        const observation = JSON.parse(await readFile(marker, 'utf8'));
        if (observation.firstParty === true && ['loopback','provider-code-page','unsupported'].includes(observation.callback)) {
          result.firstParty = true; result.callback = observation.callback; break;
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!result.firstParty) result.errorCode = 'callback-not-observed';
  } catch (error) {
    retainProfile = error?.code === 'terminal-stop-unconfirmed';
    result.errorCode = ['linux-host-probe-only','terminal-stop-unconfirmed'].includes(error?.code) ? error.code : 'probe-failed';
  }
  finally {
    if (child) result.shutdownConfirmed = await stopProbeTerminal(child, exited);
    if (!retainProfile && (!child || result.shutdownConfirmed)) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  if (result.firstParty && result.shutdownConfirmed && !result.errorCode) result.status = 'callback-observed-only';
  return result;
}
