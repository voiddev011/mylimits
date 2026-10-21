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
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.id)) return false;
  const allowed = {
    status: [], capabilities: [], list: [], add: ['provider', 'alias'], start: ['provider', 'alias'],
    cancel: ['profile'], reconnect: ['profile'], rename: ['profile', 'alias'],
    remove: ['profile'], disconnect: ['profile'], refresh: ['profile'],
  };
  if (!Object.hasOwn(allowed, value.method) || Object.keys(value).some(k => !['id', 'method', ...allowed[value.method]].includes(k))) return false;
  if (['cancel','reconnect','rename','remove','disconnect'].includes(value.method) && !value.profile) return false;
  if (value.profile !== undefined && (typeof value.profile !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.profile))) return false;
  if (value.provider !== undefined && !['openai','claude'].includes(value.provider)) return false;
  if (value.method === 'rename' && value.alias === undefined) return false;
  return value.alias === undefined || typeof value.alias === 'string' && value.alias.length <= 60 && !/[\x00-\x1f\x7f]/.test(value.alias);
}
export function safeAuthUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['auth.openai.com', 'chatgpt.com'].includes(url.hostname) && !url.username && !url.password && (!url.port || url.port === '443');
  } catch { return false; }
}
