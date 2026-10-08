import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Demo only: lets the signed-in user switch their own plan until billing launches. */
export const setDemoPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan: z.enum(["free", "premium"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert({ user_id: context.userId, plan: data.plan, provider: "demo", updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) {
      const { error: e2 } = await supabaseAdmin.from("subscriptions").update({ plan: data.plan, provider: "demo" }).eq("user_id", context.userId);
      if (e2) return { error: "切り替えに失敗しました" };
    }
    return { ok: true };
  });
