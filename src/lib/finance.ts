// Pure finance helpers — UI-independent, unit tested.

export const yen = (n: number) =>
  "¥" + Math.round(n).toLocaleString("ja-JP");

export const signedYen = (n: number) => (n >= 0 ? "+" : "−") + yen(Math.abs(n));

export const pct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

export interface SimPoint {
  year: number;
  principal: number;
  gain: number;
  total: number;
}

/** Monthly compounding simulation. Contributions at month end. */
export function simulate(initial: number, monthly: number, annualRatePct: number, years: number): SimPoint[] {
  const r = annualRatePct / 100 / 12;
  let total = initial;
  let principal = initial;
  const out: SimPoint[] = [{ year: 0, principal, gain: 0, total }];
  for (let m = 1; m <= years * 12; m++) {
    total = total * (1 + r) + monthly;
    principal += monthly;
    if (m % 12 === 0) out.push({ year: m / 12, principal, gain: total - principal, total });
  }
  return out;
}

/** Monthly contribution required to reach target in `months` at annual rate. */
export function requiredMonthly(current: number, target: number, months: number, annualRatePct = 0): number {
  if (months <= 0) return Math.max(0, target - current);
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.max(0, (target - current) / months);
  const fvCurrent = current * Math.pow(1 + r, months);
  const factor = (Math.pow(1 + r, months) - 1) / r;
  return Math.max(0, (target - fvCurrent) / factor);
}

/** Months until target reached with given monthly contribution; null if > 100 years. */
export function monthsToTarget(current: number, target: number, monthly: number, annualRatePct = 0): number | null {
  if (current >= target) return 0;
  const r = annualRatePct / 100 / 12;
  let t = current;
  for (let m = 1; m <= 1200; m++) {
    t = t * (1 + r) + monthly;
    if (t >= target) return m;
  }
  return null;
}

export function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function goalProgress(current: number, target: number) {
  const rate = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return { rate, remaining: Math.max(0, target - current) };
}
