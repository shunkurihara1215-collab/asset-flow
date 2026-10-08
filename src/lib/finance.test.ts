import { describe, it, expect } from "vitest";
import { simulate, requiredMonthly, goalProgress, monthsToTarget } from "./finance";

describe("finance", () => {
  it("goal progress: 4,000,000 of 5,000,000 is 80% with 1,000,000 left", () => {
    expect(goalProgress(4_000_000, 5_000_000)).toEqual({ rate: 80, remaining: 1_000_000 });
  });
  it("simulation with 0% keeps principal only", () => {
    const last = simulate(4_000_000, 50_000, 0, 10).at(-1)!;
    expect(last.total).toBe(10_000_000);
    expect(last.gain).toBe(0);
  });
  it("simulation at 5% for 10 years grows beyond principal", () => {
    const last = simulate(4_000_000, 50_000, 5, 10).at(-1)!;
    expect(last.principal).toBe(10_000_000);
    expect(Math.round(last.total)).toBeGreaterThan(14_000_000);
  });
  it("required monthly at 0% is linear", () => {
    expect(requiredMonthly(4_000_000, 5_000_000, 10)).toBe(100_000);
  });
  it("months to target at 0%", () => {
    expect(monthsToTarget(0, 1_000_000, 100_000)).toBe(10);
  });
});
