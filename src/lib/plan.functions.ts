import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Demo only: lets the signed-in user switch their own plan until billing launches. */
export const setDemoPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan: z.enum(["free", "premium"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("subscriptions")
      .update({ plan: data.plan, provider: "demo", updated_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .select("id");
    if (!error && !rows?.length) {
      const ins = await supabaseAdmin.from("subscriptions").insert({ user_id: context.userId, plan: data.plan, provider: "demo" });
      if (ins.error) return { error: "切り替えに失敗しました" };
    } else if (error) return { error: "切り替えに失敗しました" };
    return { ok: true };
  });
