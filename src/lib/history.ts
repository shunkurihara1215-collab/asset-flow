export interface HistRow { month: string; total: number }

const JST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
export function tokyoDate(now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error("invalid_date");
  const parts = JST.formatToParts(now);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export const tokyoMonth = (now = new Date()) => tokyoDate(now).slice(0, 7);

export function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 100 || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function monthIndex(value: string): number | null {
  const date = parseDateOnly(value.length === 7 ? `${value}-01` : value);
  return date ? date.year * 12 + date.month - 1 : null;
}
export function shiftMonth(month: string, offset: number): string {
  const index = monthIndex(month);
  if (index === null || !Number.isInteger(offset)) throw new Error("invalid_month");
  const next = index + offset;
  return `${Math.floor(next / 12)}-${String(((next % 12) + 12) % 12 + 1).padStart(2, "0")}`;
}
export const monthLabel = (month: string) => {
  const index = monthIndex(month);
  return index === null ? "年月不明" : `${Math.floor(index / 12)}年${index % 12 + 1}月`;
};
export const shortMonth = (month: string) => {
  const index = monthIndex(month);
  return index === null ? "—" : `${String(Math.floor(index / 12)).slice(2)}/${index % 12 + 1}`;
};
export function dateLabel(value: string): string {
  const date = parseDateOnly(value);
  return date ? `${date.year}/${date.month}/${date.day}` : "日付不明";
}
export function timestampLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateLabel(tokyoDate(date)) : "日付不明";
}
export function previousMonthEnd(now = new Date()): string {
  const month = tokyoMonth(now);
  const date = parseDateOnly(`${month}-01`);
  if (!date) throw new Error("invalid_date");
  return new Date(Date.UTC(date.year, date.month - 1, 0)).toISOString().slice(0, 10);
}
export function isPastMonthDate(value: string, now = new Date()): boolean {
  const date = parseDateOnly(value);
  const index = monthIndex(value), current = monthIndex(tokyoMonth(now));
  return !!date && index !== null && current !== null && index < current;
}

/** Ambiguous duplicates are excluded rather than arbitrarily choosing a total. */
export function uniqueHistory<T extends HistRow>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (monthIndex(row.month) === null || !Number.isFinite(row.total) || row.total < 0) continue;
    const key = row.month.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].filter((group) => group.length === 1).flat().sort((a, b) => (monthIndex(a.month) ?? 0) - (monthIndex(b.month) ?? 0));
}

export interface Comparison { targetMonth: string; amount: number | null; rate: number | null }
export function compareMonths(rows: HistRow[], current: number, month: string, monthsAgo: number): Comparison {
  const targetMonth = shiftMonth(month, -monthsAgo);
  const candidates = rows.filter((row) => monthIndex(row.month) === monthIndex(targetMonth));
  const row = candidates.length === 1 ? candidates[0] : undefined;
  if (!Number.isInteger(monthsAgo) || monthsAgo <= 0 || !row || !Number.isFinite(current) || current < 0 || !Number.isFinite(row.total) || row.total < 0) {
    return { targetMonth, amount: null, rate: null };
  }
  const amount = current - row.total;
  return { targetMonth, amount, rate: row.total === 0 ? null : amount / row.total * 100 };
}

/** Exact previous calendar month / same month last year; never closest older row. */
export function diffVsMonthsAgo(rows: HistRow[], current: number, monthsAgo: number, now = new Date()): number | null {
  return compareMonths(rows, current, tokyoMonth(now), monthsAgo).amount;
}

export function latestRecordComparison(rows: HistRow[], current: number, now = new Date()): Comparison {
  const month = tokyoMonth(now), index = monthIndex(month);
  const row = uniqueHistory(rows).filter((r) => (monthIndex(r.month) ?? Infinity) < (index ?? 0)).at(-1);
  return row && index !== null ? compareMonths(rows, current, month, index - (monthIndex(row.month) ?? index)) : { targetMonth: "", amount: null, rate: null };
}

/** Range means elapsed calendar months including the current endpoint (1Y has 13 ticks). */
export function filterRange<T extends HistRow>(rows: T[], months: number | null, now = new Date()): T[] {
  const end = monthIndex(tokyoMonth(now));
  if (end === null) return [];
  return uniqueHistory(rows).filter((row) => {
    const index = monthIndex(row.month);
    return index !== null && index <= end && (months === null || index >= end - months);
  });
}

/** Null marks unknown months; it is not a zero-valued snapshot. */
export function monthlySeries(rows: HistRow[], months: number | null = null, now = new Date()): { month: string; label: string; total: number | null }[] {
  const filtered = filterRange(rows, months, now);
  if (!filtered.length) return [];
  const end = tokyoMonth(now);
  const start = months === null ? filtered[0]?.month.slice(0, 7) : shiftMonth(end, -months);
  if (!start) return [];
  const size = (monthIndex(end) ?? 0) - (monthIndex(start) ?? 0);
  const totals = new Map(filtered.map((row) => [row.month.slice(0, 7), row.total]));
  return Array.from({ length: size + 1 }, (_, offset) => {
    const month = shiftMonth(start, offset);
    return { month, label: shortMonth(month), total: totals.get(month) ?? null };
  });
}