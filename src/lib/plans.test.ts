import { describe, it, expect } from "vitest";
import { effectivePlan } from "./plans";

const now = new Date("2026-10-10T00:00:00Z");
describe("effectivePlan", () => {
  it("no subscription is free", () => expect(effectivePlan(null, now)).toBe("free"));
  it("active premium is premium", () => expect(effectivePlan({ plan: "premium", status: "active", current_period_end: "2026-11-01T00:00:00Z" }, now)).toBe("premium"));
  it("canceled premium is free", () => expect(effectivePlan({ plan: "premium", status: "canceled" }, now)).toBe("free"));
  it("premium past period end is free", () => expect(effectivePlan({ plan: "premium", status: "active", current_period_end: "2026-10-01T00:00:00Z" }, now)).toBe("free"));
});
