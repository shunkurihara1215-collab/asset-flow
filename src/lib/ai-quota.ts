import type { Plan } from "./plans";

export const AI_MONTHLY_LIMIT: Record<Plan, number> = { free: 1, premium: 10 };

export function aiMonthlyLimit(plan: Plan): number {
  return AI_MONTHLY_LIMIT[plan];
}

export function aiQuotaRemaining(plan: Plan, used: number): number {
  return Math.max(0, aiMonthlyLimit(plan) - used);
}

export type AiResult = { answer?: string; error?: string; pending?: boolean };

export function reservationResult(value: unknown): AiResult | null {
  if (!value || typeof value !== "object" || !("status" in value)) {
    return { error: "利用枠を確認できませんでした。再度ご確認ください。", pending: true };
  }
  const r = value as { status: unknown; answer?: unknown; error?: unknown };
  switch (r.status) {
    case "reserved": return null;
    case "completed": return typeof r.answer === "string" && r.answer.length > 0
      ? { answer: r.answer } : { error: "保存済みの回答を確認できませんでした。", pending: true };
    case "failed": return { error: typeof r.error === "string" ? r.error : "AIの分析に失敗しました。" };
    case "pending": return { error: "この分析は処理中、または結果の確認待ちです。再実行せず、送信結果をご確認ください。", pending: true };
    case "busy": return { error: "別の分析が処理中、または確認待ちです。送信結果をご確認ください。" };
    case "limit": return { error: "今月のAI利用上限に達しました。翌月1日（日本時間）に利用枠が更新されます。" };
    case "conflict": return { error: "同じ送信番号で質問を変更することはできません。" };
    case "retired": return { error: "退会処理中のためAI分析を利用できません。" };
    default: return { error: "利用枠を確認できませんでした。", pending: true };
  }
}