import {
  accountName,
  isFresh,
  remainingPercent,
  type Account,
  type Settings,
} from "../core/model";

export type LimitSort = "default" | "remaining" | "reset" | "name";

export function selectAccounts(
  accounts: Account[],
  settings: Settings,
  now: number,
  query: string,
  lowOnly: boolean,
  sort: LimitSort,
): Account[] {
  const needle = query.trim().toLocaleLowerCase();
  const freshMeters = (account: Account) =>
    account.meters.filter(
      (meter) =>
        meter.evidence === "reported" &&
        isFresh(account, meter, now, settings.refreshMinutes),
    );
  const remaining = (account: Account) =>
    Math.min(
      ...freshMeters(account).map(
        (meter) => remainingPercent(meter) ?? Infinity,
      ),
    );
  const reset = (account: Account) =>
    Math.min(
      ...freshMeters(account).map((meter) => meter.resetsAt ?? Infinity),
    );
  return accounts
    .filter(
      (account) =>
        (!needle ||
          [
            accountName(account),
            account.provider,
            account.plan ?? "",
            ...account.meters.map((meter) => meter.label),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(needle)) &&
        (!lowOnly ||
          remaining(account) <=
            (account.alertRemaining ?? settings.warningRemaining)),
    )
    .sort((a, b) => {
      if (sort === "name") return accountName(a).localeCompare(accountName(b));
      if (sort === "default") {
        const pinned = Number(!!b.pinned) - Number(!!a.pinned);
        if (pinned) return pinned;
        if (a.order !== undefined || b.order !== undefined)
          return (a.order ?? 9999) - (b.order ?? 9999);
      }
      const difference =
        sort === "remaining"
          ? remaining(a) - remaining(b)
          : sort === "reset"
            ? reset(a) - reset(b)
            : Number(b.connection === "active") -
              Number(a.connection === "active");
      return (
        (Number.isNaN(difference) ? 0 : difference) ||
        accountName(a).localeCompare(accountName(b))
      );
    });
}
