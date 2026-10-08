// Feature gating by plan. Payment provider (e.g. Stripe) updates `subscriptions.plan` server-side.
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
