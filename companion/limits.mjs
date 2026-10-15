// Explicit allowlist: no credentials, email, arbitrary upstream fields or inferred caps.
export function parseLimits(response) {
  const buckets = response?.rateLimitsByLimitId && typeof response.rateLimitsByLimitId === 'object'
    ? Object.entries(response.rateLimitsByLimitId) : response?.rateLimits ? [[response.rateLimits.limitId ?? 'codex', response.rateLimits]] : [];
  const meters = [];
  for (const [id, bucket] of buckets.slice(0, 15)) {
    if (!bucket || typeof bucket !== 'object' || !/^[a-zA-Z0-9_-]{1,70}$/.test(id)) continue;
    for (const key of ['primary', 'secondary']) {
      const window = bucket[key];
      if (!window || typeof window.usedPercent !== 'number' || !Number.isFinite(window.usedPercent) || window.usedPercent < 0 || window.usedPercent > 1000) continue;
      const mins = window.windowDurationMins;
      const duration = typeof mins === 'number' && Number.isFinite(mins) && mins > 0 ? (mins % 1440 === 0 ? `${mins / 1440}d` : mins % 60 === 0 ? `${mins / 60}h` : `${mins}m`) : key;
      const reset = window.resetsAt;
      meters.push({ id: `${id}-${key}`, label: `${id} · ${duration}`.slice(0, 120), scope: 'work-codex', evidence: 'reported', usedPercent: window.usedPercent,
        used: null, total: null, unit: 'percent', resetsAt: typeof reset === 'number' && Number.isFinite(reset) && reset > 0 ? reset * 1000 : null,
        source: 'OpenAI Codex App Server · account/rateLimits/read' });
    }
  }
  return meters;
}
