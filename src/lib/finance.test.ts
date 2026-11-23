import { describe, it, expect } from "vitest";
import { simulate, requiredMonthly, goalProgress, monthsToTarget, remainingGoalMonths, goalTiming, simulationPeriod } from "./finance";

describe("finance", () => {
  it("goal progress: 4,000,000 of 5,000,000 is 80% with 1,000,000 left", () => {
    expect(goalProgress(4_000_000, 5_000_000)).toEqual({ rate: 80, remaining: 1_000_000 });
  });
  it("simulation with 0% keeps principal only", () => {
    const last = simulate(4_000_000, 50_000, 0, 10).at(-1);
    expect(last?.total).toBe(10_000_000);
    expect(last?.gain).toBe(0);
  });
  it("simulation at 5% for 10 years grows beyond principal", () => {
    const last = simulate(4_000_000, 50_000, 5, 10).at(-1);
    expect(last?.principal).toBe(10_000_000);
    if (!last) throw new Error("missing simulation");
    expect(Math.round(last.total)).toBeGreaterThan(14_000_000);
  });
  it("required monthly at 0% is linear", () => {
    expect(requiredMonthly(4_000_000, 5_000_000, 10)).toBe(100_000);
  });
  it("months to target at 0%", () => {
    expect(monthsToTarget(0, 1_000_000, 100_000)).toBe(10);
  });
});

describe("goal calendar periods", () => {
  it("one-year simulation includes this month and exactly 12 deposits", () => {
    expect(simulationPeriod(1, new Date("2026-11-30T15:00:00Z"))).toEqual({ firstMonth: "2026-12", lastMonth: "2027-11", contributions: 12 });
    expect(simulate(0,100,0,1).at(-1)?.total).toBe(1200);
  });
  it("invalid simulation data is not replaced with a zero balance", () => {
    expect(simulate(NaN,100,0,1)).toEqual([]);
    expect(simulate(100,-1,0,1)).toEqual([]);
    expect(simulationPeriod(0)).toBeNull();
  });
  it("this month is included at both month start and month end", () => {
    expect(remainingGoalMonths("2026-11-30", new Date("2026-11-01T00:00:00Z"))).toBe(1);
    expect(remainingGoalMonths("2026-11-30", new Date("2026-11-30T14:59:00Z"))).toBe(1);
  });
  it("year crossing and leap month include the deadline month", () => {
    expect(remainingGoalMonths("2027-01-31", new Date("2026-12-01T00:00:00Z"))).toBe(2);
    expect(remainingGoalMonths("2024-02-29", new Date("2024-02-01T00:00:00Z"))).toBe(1);
  });
  it("passed deadline is zero periods, not remaining asset amount as monthly need", () => {
    expect(remainingGoalMonths("2026-11-22", new Date("2026-11-23T00:00:00Z"))).toBe(0);
    expect(requiredMonthly(100, 200, 0)).toBeNull();
    expect(goalTiming(100, 200, "2026-11-22", 10, 0, new Date("2026-11-23T00:00:00Z")).status).toBe("expired");
  });
  it("achieved target takes priority even with a future/past deadline", () => {
    expect(goalTiming(200, 100, "2027-01-31", 0, 0).status).toBe("achieved");
    expect(goalTiming(200, 200, "2020-01-31", 0, 0).months).toBe(0);
  });
  it("missing or invalid amounts/dates cannot be simulated", () => {
    expect(goalTiming(undefined, 100, "2027-01-31", 10, 0).status).toBe("unavailable");
    expect(goalTiming(100, null, "2027-01-31", 10, 0).status).toBe("unavailable");
    expect(goalTiming(100, 0, "2027-01-31", 10, 0).status).toBe("unavailable");
    expect(goalTiming(100, 200, "2025-02-29", 10, 0).status).toBe("unavailable");
    expect(monthsToTarget(NaN, 100, 10)).toBeNull();
  });
  it("zero contribution and no growth is unattainable", () => {
    expect(monthsToTarget(100, 200, 0, 0)).toBeNull();
  });
  it("monthly need, contribution count and achievement month agree", () => {
    const timing = goalTiming(0, 200, "2027-01-31", 100, 0, new Date("2026-12-01T00:00:00Z"));
    expect(timing.months).toBe(2); expect(timing.need).toBe(100);
    expect(timing.eta).toBe(2); expect(timing.etaMonth).toBe("2027-01"); expect(timing.onTrack).toBe(true);
  });
});
