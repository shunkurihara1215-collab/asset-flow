import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canUse } from "@/lib/plans";
import { assertAccountAvailable, readBillingState } from "./billing.server";
import { assertPaymentEnvironment } from "./billing-lifecycle";
import { tokyoMonth } from "./history";
import { aiMonthlyLimit, aiQuotaRemaining, reservationResult, type AiResult } from "./ai-quota";

const SYSTEM = `あなたは日本の個人向け資産形成アプリのアシスタントです。
ユーザーのデータに基づき、現在の資産状況・目標達成状況・積立ペース・資産配分・改善ポイント・将来シミュレーションについて、情報提供と分析を中心に日本語で簡潔に回答してください。
特定の金融商品の購入を断定的に勧めたり、将来の利益を保証する表現は絶対に避けてください。見出しと箇条書きを使い、最後に「本内容は情報提供であり投資助言ではありません」と添えてください。`;

export const getAiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAccountAvailable(context.userId);
    const billing = await readBillingState(context.supabase, context.userId);
    const month = tokyoMonth();
    const [monthly, pending] = await Promise.all([
      context.supabase.from("ai_usage_requests").select("request_id", { count: "exact", head: true }).eq("user_id", context.userId).eq("month", month),
      context.supabase.from("ai_usage_requests").select("request_id").eq("user_id", context.userId).eq("status", "pending").maybeSingle(),
    ]);
    if (monthly.error || pending.error || monthly.count === null) throw new Error("AI利用状況を確認できませんでした。");
    return { userId: context.userId, month, limit: aiMonthlyLimit(billing.plan), used: monthly.count, remaining: aiQuotaRemaining(billing.plan, monthly.count), pendingRequestId: pending.data?.request_id ?? null };
  });

export const getAiRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AiResult> => {
    const result = await context.supabase.from("ai_usage_requests").select("status,answer,error_message")
      .eq("user_id", context.userId).eq("request_id", data.requestId).maybeSingle();
    if (result.error) return { error: "送信結果を確認できませんでした。時間をおいてご確認ください。", pending: true };
    if (!result.data) return { error: "この送信の利用記録はありません。" };
    return reservationResult({ status: result.data.status, answer: result.data.answer, error: result.data.error_message }) ?? { pending: true };
  });

export const askAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().max(1000).optional(), environment: z.enum(["sandbox", "live"]), requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AiResult> => {
    const { supabase, userId } = context;
    let billing;
    try {
      await assertAccountAvailable(userId);
      billing = await readBillingState(supabase, userId);
      assertPaymentEnvironment(data.environment, billing.environment);
    } catch { return { error: "契約情報を確認できません。時間をおいて再度お試しください。" }; }
    if (!canUse(billing.plan, "aiAdvice")) return { error: "AI分析を利用できません。" };
    const question = data.question?.trim() || "現在の資産状況を総合的に分析してください。";
    const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(question)));
    const hash = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    // Read an existing request before data collection: replay never generates new work.
    const previous = await supabase.from("ai_usage_requests").select("status,request_hash,answer,error_message").eq("user_id", userId).eq("request_id", data.requestId).maybeSingle();
    if (previous.error) return { error: "送信記録を確認できませんでした。", pending: true };
    if (previous.data) return reservationResult({ status: previous.data.request_hash === hash ? previous.data.status : "conflict", answer: previous.data.answer, error: previous.data.error_message }) ?? { pending: true };

    const [profile, assets, goals] = await Promise.all([
      supabase.from("profiles").select("birth_year,monthly_income,monthly_expense,monthly_investment,risk_tolerance,region").eq("id", userId).maybeSingle(),
      supabase.from("assets").select("name, amount, category:asset_categories(name)"),
      supabase.from("goals").select("name, target_amount, deadline, monthly_contribution"),
    ]);
    if (profile.error || assets.error || goals.error || !profile.data || !assets.data || !goals.data) {
      return { error: "分析に必要なデータを取得できませんでした。通信状況をご確認のうえ、再度お試しください。" };
    }
    const p = profile.data;
    const ctx = {
      age: p.birth_year ? Number(tokyoMonth().slice(0, 4)) - p.birth_year : null,
      monthly_income: p.monthly_income, monthly_expense: p.monthly_expense,
      monthly_investment: p.monthly_investment, risk_tolerance: p.risk_tolerance, region: p.region,
      assets: assets.data, goals: goals.data,
    };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { error: "AI機能が設定されていません。" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reservation = await supabaseAdmin.rpc("reserve_ai_request", { p_user_id: userId, p_request_id: data.requestId, p_request_hash: hash, p_limit: aiMonthlyLimit(billing.plan) });
    if (reservation.error) return { error: "利用枠の確保を確認できませんでした。送信結果をご確認ください。", pending: true };
    const replay = reservationResult(reservation.data);
    if (replay) return replay;
    const finish = async (answer: string | null, error: string | null): Promise<AiResult> => {
      const saved = await supabaseAdmin.rpc("finish_ai_request", { p_user_id: userId, p_request_id: data.requestId, p_question: data.question ?? "", p_answer: answer ?? "", p_error: error ?? "" });
      if (saved.error || saved.data !== true) return { error: "分析結果の保存を確認できませんでした。再実行せず、送信結果をご確認ください。", pending: true };
      return answer !== null ? { answer } : { error: error ?? "AIの分析に失敗しました。" };
    };
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" }, instructions: SYSTEM, input: `ユーザーデータ(JSON): ${JSON.stringify(ctx)}\n\n質問: ${question}` }),
      });
      if (res.status === 429) return await finish(null, "AIが混み合っているため分析できませんでした。この実行は1回に含まれます。時間をおいてお試しください。");
      if (res.status === 402) return await finish(null, "AI提供側の利用枠が不足しています。管理者による利用枠の確認が必要です。");
      if (res.status === 403) return await finish(null, "AI提供側で利用が拒否されました。管理者による利用権限の確認が必要です。");
      if (!res.ok || !res.body) return await finish(null, "AIの応答に失敗しました。この実行は1回に含まれます。");
      let answer = "";
      let completed = false;
      let failed = false;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const consume = (line: string) => {
        if (!line.startsWith("data:")) return;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") return;
        try {
          const ev = JSON.parse(payload) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) answer += ev.delta;
          if (ev.type === "response.completed") completed = true;
          if (ev.type === "response.failed" || ev.type === "response.incomplete" || ev.type === "error" || ev.type === "response.refusal.delta") failed = true;
        } catch { failed = true; }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) consume(line);
      }
      consume(buf + dec.decode());
      if (!completed || failed || !answer) return await finish(null, "AIの分析を完了できませんでした。この実行は1回に含まれます。");
      return await finish(answer, null);
    } catch {
      // Network outcome is unknown: do not expire the reservation or repeat the API call.
      return { error: "AIの実行結果を確認できませんでした。再実行せず、送信結果をご確認ください。", pending: true };
    }
  });
