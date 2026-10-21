import path from 'node:path';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { EventEmitter } from 'node:events';

// Only this process speaks to Codex. Raw responses and stderr never go to Chrome.
export class AppServer extends EventEmitter {
  constructor({ executable = 'codex', home, timeout = 30_000, spawnProcess = spawn, environment = process.env }) {
    super();
    this.pending = new Map(); this.nextId = 0; this.timeout = timeout;
    const script = /\.m?js$/i.test(executable);
    this.child = spawnProcess(script ? process.execPath : executable, [...(script ? [executable] : []), 'app-server', '--listen', 'stdio://'], {
      env: { ...environment, PATH: `${path.dirname(process.execPath)}${path.delimiter}${environment.PATH ?? environment.Path ?? ''}`, CODEX_HOME: home }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buffered = ''; const decoder = new StringDecoder('utf8');
    this.child.stdout.on('data', chunk => {
      buffered += decoder.write(chunk);
      if (Buffer.byteLength(buffered) > 4 * 1024 * 1024) { this.close(); return; }
      let end;
      while ((end = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, end); buffered = buffered.slice(end + 1);
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          if (message.id !== undefined && this.pending.has(message.id)) {
            const pending = this.pending.get(message.id); this.pending.delete(message.id); clearTimeout(pending.timer);
            message.error ? pending.reject(upstreamError(message.error)) : pending.resolve(message.result);
          } else if (typeof message.method === 'string' && message.id === undefined) this.emit('notification', message);
          else if (message.id !== undefined) {
            // This tracker never approves tool calls, commands or other server requests.
            this.child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Unsupported by usage tracker' } }) + '\n');
          }
        } catch { this.close(); return; }
      }
    });
    this.child.stderr.on('data', () => {});
    this.child.stdin.on('error', () => this.fail());
    this.child.on('error', () => this.fail());
    this.child.on('exit', () => this.fail());
    this.ready = this.request('initialize', { clientInfo: { name: 'mylimits', title: 'MyLimits', version: '0.1.0' }, capabilities: {} })
      .then(() => { this.child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n'); });
    this.ready.catch(() => {});
  }
  fail() {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Codex App Server stopped. Check the companion installation.')); }
    this.pending.clear(); this.emit('stopped');
  }
  request(method, params) {
    return new Promise((resolve, reject) => {
      if (this.child.killed || this.child.exitCode !== null) { reject(new Error('Codex App Server is unavailable.')); return; }
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('OpenAI request timed out.')); }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) }) + '\n', error => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(new Error('Codex App Server is unavailable.')); }
      });
    });
  }
  close() { this.fail(); this.child.kill(); }
}

// Preserve only explicit structured retry/status hints. No raw provider text,
// credentials or arbitrary error data escape this transport. Some CLI versions
// do not expose upstream Retry-After; then the service uses conservative backoff.
export function upstreamError(value, now = Date.now()) {
  const data = value?.data;
  const status = data?.status ?? data?.statusCode;
  const error = new Error('OpenAI could not complete this request. Reconnect if authorization expired.');
  error.code = status === 401 ? 'needs-sign-in' : status === 429 ? 'throttled' : 'unavailable';
  const seconds = data?.retryAfterSeconds;
  const milliseconds = data?.retryAfterMs;
  let retryAt = typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 ? now + seconds * 1000
    : typeof milliseconds === 'number' && Number.isFinite(milliseconds) && milliseconds >= 0 ? now + milliseconds : null;
  const header = data?.headers?.['retry-after'];
  if (typeof header === 'string' && header.length < 100) {
    const parsed = /^\d+(?:\.\d+)?$/.test(header) ? now + Number(header) * 1000 : Date.parse(header);
    if (Number.isFinite(parsed) && parsed >= now) retryAt = Math.max(retryAt ?? 0, parsed);
  }
  if (Number.isFinite(data?.retryAt) && data.retryAt >= now) retryAt = Math.max(retryAt ?? 0, data.retryAt);
  if (retryAt !== null && retryAt <= 8.64e15) error.retryAt = retryAt;
  return error;
}
