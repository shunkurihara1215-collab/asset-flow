import { describe, it, expect } from "vitest";
import { ageBenchmark, buildInsight } from "./insight";

describe("insight", () => {
  it("30s benchmark is 3,000,000", () => {
    expect(ageBenchmark(35)).toBe(3_000_000);
  });
  it("metro region needs 6 months of cash", () => {
    const r = buildInsight({ age: 35, region: "東京都", total: 4_000_000, cash: 1_000_000, monthlyExpense: 200_000, topGroupPct: 40 });
    expect(r.points.some((p) => p.includes("6ヶ月"))).toBe(true);
  });
  it("non-metro region needs 4 months of cash", () => {
    const r = buildInsight({ age: 35, region: "長野県", total: 4_000_000, cash: 1_000_000, monthlyExpense: 200_000, topGroupPct: 40 });
    expect(r.points.some((p) => p.includes("4ヶ月"))).toBe(true);
  });
  it("flags concentration at 70% or more", () => {
    const r = buildInsight({ age: null, region: null, total: 1, cash: 0, monthlyExpense: null, topGroupPct: 80, topGroupLabel: "米国株" });
    expect(r.points.some((p) => p.includes("米国株"))).toBe(true);
  });
});
