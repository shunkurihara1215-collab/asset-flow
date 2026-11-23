export const PREMIUM_PRICING = {
  priceId: "premium_monthly",
  amount: 550,
  currency: "jpy",
  taxBehavior: "inclusive",
  interval: "month",
  label: "月額550円（税込）",
} as const;

type CheckoutPrice = {
  lookup_key: string | null;
  active: boolean;
  unit_amount: number | null;
  currency: string;
  tax_behavior?: string | null;
  type: string;
  recurring: { interval: string; interval_count: number } | null;
};

// Fail closed if a catalog/environment sync has not completed: never overcharge.
export function assertPremiumPrice(price: CheckoutPrice): void {
  if (
    price.lookup_key !== PREMIUM_PRICING.priceId ||
    !price.active ||
    price.unit_amount !== PREMIUM_PRICING.amount ||
    price.currency !== PREMIUM_PRICING.currency ||
    price.tax_behavior !== PREMIUM_PRICING.taxBehavior ||
    price.type !== "recurring" ||
    price.recurring?.interval !== PREMIUM_PRICING.interval ||
    price.recurring.interval_count !== 1
  ) {
    throw new Error("料金設定が月額550円（税込）と一致しないため、お申し込みを停止しました。");
  }
}