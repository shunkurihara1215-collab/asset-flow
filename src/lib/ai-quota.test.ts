import { describe, expect, it } from "vitest";
import { aiMonthlyLimit, aiQuotaRemaining, reservationResult } from "./ai-quota";
import { canUse } from "./plans";
import { tokyoMonth } from "./history";

describe("AI monthly limits", () => {
  it("Premium has exactly 10 executions per month", () => {
    expect(aiMonthlyLimit("premium")).toBe(10);
    expect(aiQuotaRemaining("premium", 9)).toBe(1);
    expect(aiQuotaRemaining("premium", 10)).toBe(0);
    expect(aiQuotaRemaining("premium", 11)).toBe(0);
  });
  it("Free can use AI exactly once per month", () => {
    expect(canUse("free", "aiAdvice")).toBe(true);
    expect(aiMonthlyLimit("free")).toBe(1);
    expect(aiQuotaRemaining("free", 0)).toBe(1);
    expect(aiQuotaRemaining("free", 1)).toBe(0);
  });
  it("month changes at midnight Japan, not UTC", () => {
    expect(tokyoMonth(new Date("2026-11-30T14:59:59Z"))).toBe("2026-11");
    expect(tokyoMonth(new Date("2026-11-30T15:00:00Z"))).toBe("2026-12");
  });
  it("only a new reservation can start an API call", () => {
    expect(reservationResult({ status: "reserved" })).toBeNull();
    for (const status of ["pending", "busy", "limit", "conflict", "retired", "failed"]) {
      expect(reservationResult({ status })).not.toBeNull();
    }
  });
  it("completed replay returns the original answer", () => {
    expect(reservationResult({ status: "completed", answer: "original" })).toEqual({ answer: "original" });
  });
});
