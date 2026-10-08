import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Deletes the caller's own account and all their data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    for (const t of ["assets", "asset_history", "goals", "income_expenses", "subscriptions", "ai_advice_history", "notifications", "asset_categories"] as const) {
      await supabaseAdmin.from(t).delete().eq("user_id", uid);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) return { error: "削除に失敗しました" };
    return { ok: true };
  });
