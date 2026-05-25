/** API yenilemede snapshot tarihi: seçili ay sonu veya bugün. */
export type IzlenmeApiDateMode = "view-month" | "today";

/** Liste ve yenileme kapsamı: yalnızca seçili ayın linkleri veya tüm aktif linkler. */
export type IzlenmeLinkScope = "month" | "all";

export function resolveRefreshTargetDate(
  viewMonth: string,
  apiDateMode: IzlenmeApiDateMode
): string | undefined {
  if (apiDateMode === "today") return undefined;
  const [y, mo] = viewMonth.split("-").map(Number);
  if (!y || !mo) return undefined;
  const lastDay = new Date(y, mo, 0).getDate();
  const candidate = `${viewMonth}-${String(lastDay).padStart(2, "0")}`;
  const todayStr = new Date().toISOString().slice(0, 10);
  return candidate < todayStr ? candidate : undefined;
}
