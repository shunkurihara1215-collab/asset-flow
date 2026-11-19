import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setDemoPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan: z.enum(["free", "premium"]) }).parse(d))
  .handler(async ({ data, context }) => {
    // Request headers are caller-controlled, so they never decide this. Disabled unless a
    // server-only secret explicitly enables it (not set anywhere by default).
    if (process.env["DEMO_PLAN_SWITCH"] !== "enabled") return { error: "この環境ではプランの切り替えはできません" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = { plan: data.plan, status: "active", provider: "demo", current_period_end: null, updated_at: new Date().toISOString() };
    const { data: paid } = await supabaseAdmin.from("subscriptions").select("id").eq("user_id", context.userId).eq("environment", "sandbox").eq("provider", "stripe").in("status", ["active", "trialing", "past_due", "incomplete"]).limit(1);
    if (paid?.length) return { error: "テスト契約中は、お支払い管理からプランを変更してください" };
    const { data: rows, error } = await supabaseAdmin.from("subscriptions").update(patch).eq("user_id", context.userId).eq("environment", "sandbox").or("provider.is.null,provider.eq.demo").select("id");
    if (error) return { error: "切り替えに失敗しました" };
    if (!rows?.length) {
      const ins = await supabaseAdmin.from("subscriptions").insert({ user_id: context.userId, ...patch });
      if (ins.error) return { error: "切り替えに失敗しました" };
    }
    return { ok: true };
  });
