import { describe, expect, it } from "vitest";
import { compareMonths, diffVsMonthsAgo, filterRange, isPastMonthDate, monthlySeries, parseDateOnly, previousMonthEnd, shiftMonth, tokyoDate, tokyoMonth, uniqueHistory } from "./history";

describe("Japanese calendar boundaries", () => {
  it("UTC February 28 15:00 is JST March 1, in leap year too", () => {
    expect(tokyoDate(new Date("2025-02-28T15:00:00Z"))).toBe("2025-03-01");
    expect(tokyoMonth(new Date("2024-02-29T15:00:00Z"))).toBe("2024-03");
    expect(tokyoMonth(new Date("2024-02-29T14:59:59Z"))).toBe("2024-02");
  });
  it("December to January uses Japanese year", () => {
    expect(tokyoDate(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
  });
  it("previous month ends include leap day and exclude current month", () => {
    expect(previousMonthEnd(new Date("2024-03-01T00:00:00Z"))).toBe("2024-02-29");
    expect(previousMonthEnd(new Date("2025-03-01T00:00:00Z"))).toBe("2025-02-28");
    expect(isPastMonthDate("2024-02-29", new Date("2024-02-29T15:00:00Z"))).toBe(true);
    expect(isPastMonthDate("2024-03-01", new Date("2024-02-29T15:00:00Z"))).toBe(false);
    expect(parseDateOnly("2025-02-29")).toBeNull();
  });
});
describe("exact monthly comparisons", () => {
  const rows = [{ month: "2025-11-01", total: 100 }, { month: "2026-08-01", total: 150 }, { month: "2026-10-01", total: 200 }, { month: "2026-11-01", total: 300 }];
  it("previous month means October, not current November", () => {
    expect(compareMonths(rows, 300, "2026-11", 1)).toEqual({ targetMonth: "2026-10", amount: 100, rate: 50 });
  });
  it("missing month never uses an older month", () => {
    expect(compareMonths(rows, 200, "2026-10", 1).amount).toBeNull();
    expect(compareMonths([{ month: "2026-07-01", total: 50 }], 300, "2026-11", 1).amount).toBeNull();
  });
  it("January previous month is previous December", () => {
    expect(compareMonths([{ month: "2026-12-01", total: 200 }], 300, "2027-01", 1).amount).toBe(100);
  });
  it("year comparison selects exactly the same month, including mid-year", () => {
    expect(compareMonths(rows, 300, "2026-11", 12)).toEqual({ targetMonth: "2025-11", amount: 200, rate: 200 });
    expect(compareMonths([{ month: "2025-05-01", total: 100 }], 200, "2026-06", 12).amount).toBeNull();
    expect(compareMonths([{ month: "2025-06-01", total: 100 }], 200, "2026-06", 12).amount).toBe(100);
  });
  it("zero baseline keeps amount but rate is undefined", () => {
    expect(compareMonths([{ month: "2026-10-01", total: 0 }], 100, "2026-11", 1)).toEqual({ targetMonth: "2026-10", amount: 100, rate: null });
  });
  it("unfetched/nonfinite current assets do not produce comparisons", () => {
    expect(compareMonths(rows, NaN, "2026-11", 1).amount).toBeNull();
  });
  it("timezone-independent public diff uses JST month", () => {
    expect(diffVsMonthsAgo([{ month: "2026-11-01", total: 100 }], 200, 1, new Date("2026-11-30T15:00:00Z"))).toBe(100);
  });
  it("ambiguous duplicate months are not selected", () => {
    const duplicate = [{ month: "2026-10-01", total: 100 }, { month: "2026-10-01", total: 200 }];
    expect(compareMonths(duplicate, 300, "2026-11", 1).amount).toBeNull();
    expect(uniqueHistory(duplicate)).toEqual([]);
  });
  it("annual graph includes same month last year and does not interpolate missing months", () => {
    const now = new Date("2026-11-23T00:00:00Z");
    const series = monthlySeries(rows, 12, now);
    expect(series).toHaveLength(13);
    expect(series[0]).toEqual({ month: "2025-11", label: "25/11", total: 100 });
    expect(series.find((point) => point.month === "2026-09")?.total).toBeNull();
    expect(series.at(-1)?.total).toBe(300);
    expect(filterRange([...rows, { month: "2027-01-01", total: 999 }], null, now)).toHaveLength(4);
  });
});