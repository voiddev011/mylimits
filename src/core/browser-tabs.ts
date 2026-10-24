export interface TabIdentity {
  id?: number;
  incognito?: boolean;
  cookieStoreId?: string;
  active?: boolean;
  url?: string;
}
export function isNormalTab(tab: TabIdentity) {
  return (
    tab.incognito === false &&
    (!tab.cookieStoreId || tab.cookieStoreId === "firefox-default")
  );
}
export function pickNormalTab<T extends TabIdentity>(
  tabs: T[],
  owned: (id: number) => boolean = () => false,
): T | undefined {
  const normal = tabs.filter(
    (t) => t.id !== undefined && isNormalTab(t) && !owned(t.id),
  );
  return normal.find((t) => t.active) ?? normal[0];
}
