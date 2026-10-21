import { ProbeError } from './errors.mjs';

// Completion can arrive before login/start's response. Buffer only a handful of
// scoped completion flags, never URLs, credentials or arbitrary notifications.
export function codexLoginWaiter(client, signal, timeout = 180_000) {
  let id, timer, resolve, reject;
  const early = [];
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  promise.catch(() => {});
  const complete = event => {
    if (event.loginId !== id) return;
    event.success === true ? resolve() : reject(new ProbeError('login-failed', 'First-party sign-in did not complete.'));
  };
  const onEvent = event => {
    if (event.method !== 'account/login/completed' || typeof event.params?.loginId !== 'string') return;
    const result = { loginId: event.params.loginId, success: event.params.success === true };
    if (!id) { if (early.length < 8) early.push(result); }
    else complete(result);
  };
  const stopped = () => reject(new ProbeError('login-failed', 'Codex stopped during sign-in.'));
  const abort = () => reject(new ProbeError('cancelled', 'Sign-in cancelled.'));
  client.on('notification', onEvent); client.on('stopped', stopped);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  timer = setTimeout(() => reject(new ProbeError('login-failed', 'Sign-in timed out. Retry this profile.')), timeout);
  return { promise,
    setId(value) { id = value; early.forEach(complete); early.length = 0; },
    dispose() { clearTimeout(timer); early.length = 0; client.off('notification', onEvent); client.off('stopped', stopped); signal?.removeEventListener('abort', abort); },
  };
}
