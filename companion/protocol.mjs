// Chrome's native protocol uses a 32-bit little-endian byte length, not characters.
export const MAX_FRAME = 512 * 1024;
export function frame(value) {
  const body = Buffer.from(JSON.stringify(value));
  if (body.length > MAX_FRAME) throw new Error('Message too large.');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  return Buffer.concat([header, body]);
}
export function frameReader(onMessage) {
  let buffer = Buffer.alloc(0);
  return chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE();
      if (!length || length > MAX_FRAME) throw new Error('Invalid native message size.');
      if (buffer.length < length + 4) return;
      const value = JSON.parse(buffer.subarray(4, length + 4).toString('utf8'));
      buffer = buffer.subarray(length + 4);
      onMessage(value);
    }
  };
}
export function validRequest(value) {
  return value && typeof value.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value.id)
    && ['status', 'add', 'remove', 'refresh'].includes(value.method)
    && (value.method !== 'remove' || typeof value.profile === 'string' && /^[a-f0-9-]{36}$/.test(value.profile));
}
export function safeAuthUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['auth.openai.com', 'chatgpt.com'].includes(url.hostname) && !url.username && !url.password && (!url.port || url.port === '443');
  } catch { return false; }
}
