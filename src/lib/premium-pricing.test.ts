import { describe, expect, it } from "vitest";
import { assertPremiumPrice, PREMIUM_PRICING } from "./premium-pricing";

const price = {
  lookup_key: "premium_monthly", active: true, unit_amount: 550,
  currency: "jpy", tax_behavior: "inclusive", type: "recurring",
  recurring: { interval: "month", interval_count: 1 },
};

describe("Premium checkout pricing", () => {
  it("accepts exactly 550 yen", () => {
    expect(PREMIUM_PRICING.amount).toBe(550);
    expect(() => assertPremiumPrice(price)).not.toThrow();
    expect(() => assertPremiumPrice({ ...price, unit_amount: 500 })).toThrow();
    expect(() => assertPremiumPrice({ ...price, unit_amount: 551 })).toThrow();
  });
  it("includes tax instead of adding it", () => {
    expect(() => assertPremiumPrice({ ...price, tax_behavior: "exclusive" })).toThrow();
    expect(() => assertPremiumPrice({ ...price, tax_behavior: "unspecified" })).toThrow();
  });
  it("requires JPY billed once per month", () => {
    expect(() => assertPremiumPrice({ ...price, currency: "usd" })).toThrow();
    expect(() => assertPremiumPrice({ ...price, recurring: { interval: "year", interval_count: 1 } })).toThrow();
    expect(() => assertPremiumPrice({ ...price, recurring: { interval: "month", interval_count: 2 } })).toThrow();
  });
  it("requires the active permanent price key", () => {
    expect(() => assertPremiumPrice({ ...price, lookup_key: "other" })).toThrow();
    expect(() => assertPremiumPrice({ ...price, active: false })).toThrow();
  });
});