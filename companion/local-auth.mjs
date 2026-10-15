import { randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function localToken(directory, create = false) {
  const file = path.join(directory, 'bridge-token');
  if (create) {
    try { await writeFile(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const token = await readFile(file, 'utf8');
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Local bridge authorization is invalid. Reinstall the companion.');
  return token;
}
const proof = (token, label, nonce) => createHmac('sha256', token).update(`${label}:${nonce}`).digest('hex');
const validHex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const equal = (a, b) => validHex(a) && validHex(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function challenge(token) {
  const nonce = randomBytes(32).toString('hex');
  return { type: 'challenge', nonce, proof: proof(token, 'server', nonce) };
}
export function answer(message, token) {
  if (message?.type !== 'challenge' || !validHex(message.nonce) || !equal(message.proof, proof(token, 'server', message.nonce))) throw new Error('Local companion identity could not be verified.');
  return { type: 'authenticate', nonce: message.nonce, proof: proof(token, 'client', message.nonce) };
}
export function authenticated(message, token, nonce) {
  return validHex(nonce) && message?.type === 'authenticate' && message.nonce === nonce && equal(message.proof, proof(token, 'client', nonce));
}
