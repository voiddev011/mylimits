import net from 'node:net';
import { localToken, answer } from './local-auth.mjs';
import { dataDir, socketPath } from './paths.mjs';
import { frameReader, frame, validRequest } from './protocol.mjs';

// The Chrome manifest allowlists the extension; the OS protects the local socket.
let token;
try { token = await localToken(dataDir); } catch { process.exit(1); }
const socket = net.connect(socketPath);
const finish = () => { socket.destroy(); process.exit(0); };
socket.on('error', finish); socket.on('end', finish);
const read = frameReader(request => {
  if (!validRequest(request)) { finish(); return; }
  socket.write(frame({ id: request.id, method: request.method, ...(request.method === 'remove' ? { profile: request.profile } : {}) }));
});
let verified = false;
const receive = frameReader(message => {
  if (!verified) {
    socket.write(frame(answer(message, token))); verified = true;
    process.stdin.on('data', chunk => { try { read(chunk); } catch { finish(); } });
    return;
  }
  if (!process.stdout.write(frame(message))) socket.pause();
});
process.stdin.on('end', finish); process.stdin.on('error', finish);
// Mutual challenge/response keeps the bridge secret off the pipe and out of Chrome.
socket.on('data', chunk => { try { receive(chunk); } catch { finish(); } });
process.stdout.on('drain', () => socket.resume()); process.stdout.on('error', finish);
