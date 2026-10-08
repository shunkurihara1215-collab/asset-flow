export interface HistRow { month: string; total: number }

export const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return `${y}年${Number(mo)}月`;
};
export const shortMonth = (m: string) => {
  const [y = "", mo] = m.split("-");
  return `${y.slice(2)}/${Number(mo)}`;
};

/** Diff of current total vs. the history row N months before current month (closest at-or-before). */
export function diffVsMonthsAgo(rows: HistRow[], current: number, monthsAgo: number, now = new Date()): number | null {

  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  const candidates = rows.filter((r) => r.month.slice(0, 7) <= key);
  if (!candidates.length) return null;
  return current - Number(candidates[candidates.length - 1]!.total);
}

export function filterRange(rows: HistRow[], months: number | null, now = new Date()) {
  if (!months) return rows;
  const from = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const key = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
  return rows.filter((r) => r.month.slice(0, 7) >= key);
}
