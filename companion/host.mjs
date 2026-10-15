import net from 'node:net';
import { socketPath } from './paths.mjs';
import { frameReader, frame, validRequest } from './protocol.mjs';

// The Chrome manifest allowlists the extension; the OS protects the local socket.
const socket = net.connect(socketPath);
const finish = () => { socket.destroy(); process.exit(0); };
socket.on('error', finish); socket.on('end', finish);
const read = frameReader(request => {
  if (!validRequest(request)) { finish(); return; }
  socket.write(frame({ id: request.id, method: request.method, ...(request.method === 'remove' ? { profile: request.profile } : {}) }));
});
process.stdin.on('data', chunk => { try { read(chunk); } catch { finish(); } });
process.stdin.on('end', finish); process.stdin.on('error', finish);
// Only the daemon's sanitized frames pass back. stdout is reserved for native messages.
socket.on('data', chunk => { if (!process.stdout.write(chunk)) socket.pause(); });
process.stdout.on('drain', () => socket.resume()); process.stdout.on('error', finish);
