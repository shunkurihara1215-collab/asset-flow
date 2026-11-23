// Pure finance helpers — UI-independent, unit tested.
import { monthIndex, tokyoDate, tokyoMonth, parseDateOnly, shiftMonth } from "./history";

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
  if (![initial, monthly, annualRatePct, years].every(Number.isFinite) || initial < 0 || monthly < 0 || annualRatePct < 0 || !Number.isInteger(years) || years < 1 || years > 100) return [];
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

export function simulationPeriod(years: number, now = new Date()): { firstMonth: string; lastMonth: string; contributions: number } | null {
  if (!Number.isInteger(years) || years < 1 || years > 100) return null;
  const firstMonth = tokyoMonth(now);
  return { firstMonth, lastMonth: shiftMonth(firstMonth, years * 12 - 1), contributions: years * 12 };
}

/** Monthly contribution required to reach target in `months` at annual rate. */
export function requiredMonthly(current: number, target: number, months: number, annualRatePct = 0): number | null {
  if (![current, target, months, annualRatePct].every(Number.isFinite) || current < 0 || target <= 0 || annualRatePct < 0) return null;
  if (current >= target) return 0;
  if (months <= 0 || !Number.isInteger(months)) return null;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.max(0, (target - current) / months);
  const fvCurrent = current * Math.pow(1 + r, months);
  const factor = (Math.pow(1 + r, months) - 1) / r;
  return Math.max(0, (target - fvCurrent) / factor);
}

/** Months until target reached with given monthly contribution; null if > 100 years. */
export function monthsToTarget(current: number, target: number, monthly: number, annualRatePct = 0): number | null {
  if (![current, target, monthly, annualRatePct].every(Number.isFinite) || current < 0 || target <= 0 || monthly < 0 || annualRatePct < 0) return null;
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
  return (monthIndex(tokyoMonth(to)) ?? 0) - (monthIndex(tokyoMonth(from)) ?? 0);
}

/** Monthly contribution opportunities include this month and the deadline month (paid by deadline). */
export function remainingGoalMonths(deadline: string, now = new Date()): number | null {
  const date = parseDateOnly(deadline);
  const end = monthIndex(deadline), start = monthIndex(tokyoMonth(now));
  if (!date || end === null || start === null) return null;
  if (deadline < tokyoDate(now)) return 0; // ISO date-only values are validated before ordering.
  return Math.max(0, end - start + 1);
}

export function goalTiming(current: number | null | undefined, target: number | null | undefined, deadline: string, monthly: number, rate: number, now = new Date()) {
  const months = remainingGoalMonths(deadline, now);
  if (current == null || target == null || !Number.isFinite(current) || !Number.isFinite(target) || current < 0 || target <= 0 || months === null || !Number.isFinite(monthly) || monthly < 0 || !Number.isFinite(rate) || rate < 0) {
    return { status: "unavailable" as const, months: null, need: null, eta: null, etaMonth: null, onTrack: false };
  }
  if (current >= target) return { status: "achieved" as const, months: 0, need: 0, eta: 0, etaMonth: null, onTrack: true };
  const eta = monthsToTarget(current, target, monthly, rate);
  return {
    status: months === 0 ? "expired" as const : "active" as const,
    months, need: requiredMonthly(current, target, months, rate), eta,
    etaMonth: eta === null ? null : shiftMonth(tokyoMonth(now), eta - 1),
    onTrack: eta !== null && months > 0 && eta <= months,
  };
}

export function goalProgress(current: number, target: number) {
  const rate = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return { rate, remaining: Math.max(0, target - current) };
}
