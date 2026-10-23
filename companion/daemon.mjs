import net from 'node:net';
import { chmod, unlink } from 'node:fs/promises';
import { localToken, authenticated, challenge } from './local-auth.mjs';
import { openAuthBrowser } from './auth-browser.mjs';
import { Connections } from './connections.mjs';
import { dataDir, socketPath } from './paths.mjs';
import { frame, frameReader, validRequest } from './protocol.mjs';

process.umask(0o077);
const companion = new Connections({ directory: dataDir, executable: process.argv[2] || 'codex', launchAuth: openAuthBrowser });

const token = await localToken(dataDir, true);
// Refuse a second daemon; only remove an owner-controlled socket after ECONNREFUSED.
await new Promise((resolve, reject) => {
  const probe = net.connect(socketPath);
  probe.on('connect', () => { probe.destroy(); reject(new Error('MyLimits companion is already running.')); });
  probe.on('error', async error => {
    try {
      if (error.code === 'ECONNREFUSED' && process.platform !== 'win32') await unlink(socketPath);
      else if (error.code === 'ECONNREFUSED') { /* A named pipe has no stale filesystem entry. */ }
      else if (error.code !== 'ENOENT') throw error;
      resolve();
    } catch { reject(new Error('Could not open the companion socket.')); }
  });
});
const sockets = new Set();
const send = (socket, message) => {
  if (socket.destroyed) return;
  if (socket.writableLength > 1024 * 1024) { socket.destroy(); return; }
  socket.write(frame(message));
};
let mutations = Promise.resolve();
let readyResolve, readyReject;
const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
ready.catch(() => {});
const server = net.createServer(socket => {
  const hello = challenge(token); send(socket, hello);
  const authTimer = setTimeout(() => socket.destroy(), 5000);
  socket.on('error', () => {}); socket.on('close', () => { clearTimeout(authTimer); sockets.delete(socket); });
  const read = frameReader(request => {
    if (!sockets.has(socket)) {
      if (!authenticated(request, token, hello.nonce)) { socket.destroy(); return; }
      clearTimeout(authTimer); sockets.add(socket);
      // Browser reopening asks for eligible checks; closing provider tabs is
      // irrelevant. Multiple native clients share account queues/cooldowns.
      void ready.then(()=>companion.refreshAll()).catch(()=>{}); return;
    }
    if (!validRequest(request)) { socket.destroy(); return; }
    // Profile index mutations are serialized, including simultaneous extension windows.
    const execute = async () => {
      try { await ready; send(socket, { id: request.id, ok: true, data: await companion.handle(request) }); }
      catch (error) { send(socket, { id: request.id, ok: false, error: ['cooldown','busy','stale-confirmation','provider-unavailable','logout-unconfirmed','unknown-profile','service-unavailable'].includes(error?.code) ? error.code : 'action-failed' }); }
    };
    if (['add', 'start'].includes(request.method)) { mutations = mutations.then(execute, execute); }
    else void execute();
  });
  socket.on('data', chunk => { try { read(chunk); } catch { socket.destroy(); } });
});
companion.on('snapshot', snapshot => { for (const socket of sockets) send(socket, snapshot); });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
if (process.platform !== 'win32') await chmod(socketPath, 0o600);
try { await companion.load(); readyResolve(); } catch (error) { readyReject(error); throw error; }
const timer = setInterval(() => { if(sockets.size)void companion.refreshAll(); }, 60_000);
async function stop() {
  clearInterval(timer); await companion.close(); for (const socket of sockets) socket.destroy();
  server.close(); if (process.platform !== 'win32') await unlink(socketPath).catch(() => {}); process.exit(0);
}
process.on('SIGTERM', () => void stop()); process.on('SIGINT', () => void stop());
// No credential material or upstream response is logged.
console.error('MyLimits companion is running. Eligible accounts are checked with per-account cooldowns while this computer is awake.');
