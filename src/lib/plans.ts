// Feature gating by plan. Only server code writes `subscriptions`; effectivePlan() derives access from it.
export type Plan = "free" | "premium";

export type Feature = "basic" | "multiGoals" | "aiAdvice" | "advancedSimulation" | "advancedAnalysis";

const FEATURE_PLAN: Record<Feature, Plan> = {
  basic: "free",
  multiGoals: "premium",
  aiAdvice: "premium",
  advancedSimulation: "premium",
  advancedAnalysis: "premium",
};

/** When true, premium features are open to everyone (beta). */
export const BETA_ALL_ACCESS = false;

export const FREE_GOAL_LIMIT = 1;

export function canUse(plan: Plan, feature: Feature): boolean {
  if (BETA_ALL_ACCESS) return true;
  return FEATURE_PLAN[feature] === "free" || plan === "premium";
}

export const PLAN_LABEL: Record<Plan, string> = { free: "無料プラン", premium: "プレミアム" };

export type SubscriptionLike = { plan?: string | null; status?: string | null; current_period_end?: string | null } | null | undefined;

const ACTIVE = new Set(["active", "trialing", "past_due"]);

/** Plan the user is actually entitled to: premium only while the contract is active and not past period end. */
export function effectivePlan(sub: SubscriptionLike, now: Date = new Date()): Plan {
  if (!sub || sub.plan !== "premium") return "free";
  if (!ACTIVE.has(sub.status ?? "active")) return "free";
  if (sub.current_period_end && new Date(sub.current_period_end).getTime() < now.getTime()) return "free";
  return "premium";
}
