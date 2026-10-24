import { remainingPercent, type Meter } from "./model";
export function meterValue(
  m: Meter,
  mode: "used" | "remaining" = "remaining",
): string {
  if (m.unit === "currency" && !m.currency) return "Unknown currency";
  if (m.unit === "currency") {
    const money = (n: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: m.currency!,
      }).format(n);
    if (mode === "used" && m.used !== null) return `${money(m.used)} spent`;
    if (
      mode === "remaining" &&
      m.remaining !== undefined &&
      m.remaining !== null
    )
      return `${money(m.remaining)} left`;
    if (mode === "remaining" && m.total !== null && m.used !== null)
      return `${money(Math.max(0, m.total - m.used))} left`;
    if (m.used !== null) return `${money(m.used)} spent`;
  }
  if (m.id === "premium-requests" && m.used !== null)
    return `${m.used.toLocaleString()}${m.total === null ? "" : ` / ${m.total.toLocaleString()}`} used`;
  if (m.evidence === "observed") return `${m.used ?? 0} observed`;
  const left = remainingPercent(m);
  if (left !== null)
    return `${Math.round(mode === "used" ? 100 - left : left)}%`;
  const value = m.remaining;
  if (value !== null && value !== undefined)
    return `${m.unit === "currency" ? new Intl.NumberFormat(undefined, { style: "currency", currency: m.currency ?? "USD" }).format(value) : value.toLocaleString()} left`;
  if (m.unit === "currency" && m.used !== null)
    return `${new Intl.NumberFormat(undefined, { style: "currency", currency: m.currency ?? "USD" }).format(m.used)} spent`;
  return "Unknown";
}
