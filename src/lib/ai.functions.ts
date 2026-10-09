import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canUse, effectivePlan } from "@/lib/plans";

const SYSTEM = `あなたは日本の個人向け資産形成アプリのアシスタントです。
ユーザーのデータに基づき、現在の資産状況・目標達成状況・積立ペース・資産配分・改善ポイント・将来シミュレーションについて、情報提供と分析を中心に日本語で簡潔に回答してください。
特定の金融商品の購入を断定的に勧めたり、将来の利益を保証する表現は絶対に避けてください。見出しと箇条書きを使い、最後に「本内容は情報提供であり投資助言ではありません」と添えてください。`;

export const askAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().max(1000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [profile, assets, goals, sub] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("assets").select("name, amount, category:asset_categories(name)"),
      supabase.from("goals").select("name, target_amount, deadline, monthly_contribution"),
      supabase.from("subscriptions").select("plan, status, current_period_end").maybeSingle(),
    ]);
    if (!canUse(effectivePlan(sub.data), "aiAdvice")) return { error: "AI分析はプレミアムプランの機能です。" };

    const p = profile.data;
    const ctx = {
      age: p?.birth_year ? new Date().getFullYear() - p.birth_year : null,
      monthly_income: p?.monthly_income,
      monthly_expense: p?.monthly_expense,
      monthly_investment: p?.monthly_investment,
      risk_tolerance: p?.risk_tolerance,
      region: p?.region,
      assets: assets.data,
      goals: goals.data,
    };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { error: "AI機能が設定されていません。" };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: SYSTEM,
        input: `ユーザーデータ(JSON): ${JSON.stringify(ctx)}\n\n質問: ${data.question || "現在の資産状況を総合的に分析してください。"}`,
      }),
    });
    if (res.status === 429) return { error: "混み合っています。しばらくしてからお試しください。" };
    if (res.status === 402) return { error: "AIの利用枠を超えました。" };
    if (!res.ok || !res.body) {
      console.error("AI gateway", res.status, await res.text());
      return { error: "AIの応答に失敗しました。" };
    }
    // Consume SSE stream and accumulate output text.
    let answer = "";
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) answer += ev.delta;
        } catch {
          /* ignore partial */
        }
      }
    }
    if (!answer) return { error: "AIの応答が空でした。" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_advice_history").insert({ user_id: userId, question: data.question ?? null, answer });
    return { answer };
  });
