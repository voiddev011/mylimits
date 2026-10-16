import net from 'node:net';
import { chmod, unlink } from 'node:fs/promises';
import { localToken, authenticated, challenge } from './local-auth.mjs';
import { openAuthBrowser } from './auth-browser.mjs';
import { Companion } from './service.mjs';
import { dataDir, socketPath } from './paths.mjs';
import { frame, frameReader, validRequest } from './protocol.mjs';

process.umask(0o077);
const companion = new Companion({ directory: dataDir, executable: process.argv[2] || 'codex', launchAuth: openAuthBrowser });
await companion.load();
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
const server = net.createServer(socket => {
  const hello = challenge(token); send(socket, hello);
  const authTimer = setTimeout(() => socket.destroy(), 5000);
  socket.on('error', () => {}); socket.on('close', () => { clearTimeout(authTimer); sockets.delete(socket); });
  const read = frameReader(request => {
    if (!sockets.has(socket)) {
      if (!authenticated(request, token, hello.nonce)) { socket.destroy(); return; }
      clearTimeout(authTimer); sockets.add(socket); return;
    }
    if (!validRequest(request)) { socket.destroy(); return; }
    // Profile index mutations are serialized, including simultaneous extension windows.
    const execute = async () => {
      try { send(socket, { id: request.id, ok: true, data: await companion.handle(request) }); }
      catch { send(socket, { id: request.id, ok: false, error: 'OpenAI action failed. Check the companion, finish sign-in, or reconnect. Disconnect failures keep credentials so you can retry.' }); }
    };
    if (['add', 'remove'].includes(request.method)) { mutations = mutations.then(execute, execute); }
    else void execute();
  });
  socket.on('data', chunk => { try { read(chunk); } catch { socket.destroy(); } });
});
companion.on('snapshot', snapshot => { for (const socket of sockets) send(socket, snapshot); });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
if (process.platform !== 'win32') await chmod(socketPath, 0o600);
void companion.refreshAll();
const timer = setInterval(() => void companion.refreshAll(), 60_000);
async function stop() {
  clearInterval(timer); companion.close(); for (const socket of sockets) socket.destroy();
  server.close(); if (process.platform !== 'win32') await unlink(socketPath).catch(() => {}); process.exit(0);
}
process.on('SIGTERM', () => void stop()); process.on('SIGINT', () => void stop());
// No credential material or upstream response is logged.
console.error('MyLimits companion is running. Quotas refresh every 60 seconds while this computer is awake.');
