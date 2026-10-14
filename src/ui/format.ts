export function countdown(timestamp: number | null, now: number): string {
  if (timestamp === null) return 'Reset not reported';
  const minutes = Math.ceil((timestamp - now) / 60_000);
  if (minutes <= 0) return 'Refresh to check reset';
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}
export function age(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes === 0) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
