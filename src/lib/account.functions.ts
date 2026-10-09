import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Every user-owned table keyed by user_id. profiles/user_roles also cascade from the auth user. */
const USER_TABLES = ["assets", "asset_history", "goals", "income_expenses", "subscriptions", "ai_advice_history", "notifications", "inquiries", "asset_categories", "user_roles"] as const;

/** Deletes the caller's own account and all their data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    for (const t of USER_TABLES) {
      const { error } = await supabaseAdmin.from(t).delete().eq("user_id", uid);
      if (error) { console.error("delete", t, error.message); return { error: "削除に失敗しました。時間をおいて再度お試しください。" }; }
    }
    const p = await supabaseAdmin.from("profiles").delete().eq("id", uid);
    if (p.error) return { error: "削除に失敗しました。時間をおいて再度お試しください。" };
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) return { error: "削除に失敗しました" };
    return { ok: true };
  });
