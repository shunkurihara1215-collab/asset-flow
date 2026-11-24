import type { StripeEnv } from "./stripe.server";
import { createStripeClient } from "./stripe.server";
import { cancelBeforeDelete, confirmCancellations } from "./billing-lifecycle";

const USER_TABLES = ["assets", "asset_history", "goals", "income_expenses", "subscriptions", "ai_usage_requests", "ai_advice_history", "notifications", "inquiries", "asset_categories", "user_roles"] as const;

export async function performAccountDeletion(userId: string, environments: StripeEnv[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const claim = await supabaseAdmin.rpc("claim_account_deletion", { p_user_id: userId });
  if (claim.error) throw new Error("退会の準備に失敗しました。再度お試しください。");
  if (!claim.data) throw new Error("退会処理は実行中です。しばらくしてからご確認ください。");
  let phase = "cancellation";
  try {
    const stored = await supabaseAdmin.from("subscriptions").select("environment,stripe_customer_id,stripe_subscription_id").eq("user_id", userId).eq("provider", "stripe");
    if (stored.error) throw new Error("契約情報の読み込みに失敗しました。");
    if (stored.data.some((row) => !environments.includes(row.environment as StripeEnv))) {
      throw new Error("契約のある決済環境を確認できないため、退会を中止しました。");
    }
    await cancelBeforeDelete(async () => {
      for (const environment of environments) {
        const stripe = createStripeClient(environment);
        const customers = new Set(stored.data.filter((r) => r.environment === environment).flatMap((r) => r.stripe_customer_id ? [r.stripe_customer_id] : []));
        for await (const customer of stripe.customers.search({ query: `metadata['userId']:'${userId}'` })) customers.add(customer.id);
        await confirmCancellations({
          list: async () => {
            const subscriptions = new Map<string, { id: string; status: string }>();
            for (const customer of customers) {
              for await (const sub of stripe.subscriptions.list({ customer, status: "all", limit: 100 })) subscriptions.set(sub.id, sub);
              // Open checkout sessions must not create a new subscription after retirement.
              for await (const session of stripe.checkout.sessions.list({ customer, status: "open", limit: 100 })) {
                await stripe.checkout.sessions.expire(session.id);
              }
            }
            for (const row of stored.data.filter((r) => r.environment === environment)) {
              if (row.stripe_subscription_id && !subscriptions.has(row.stripe_subscription_id)) {
                const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
                subscriptions.set(sub.id, sub);
              }
            }
            return [...subscriptions.values()];
          },
          cancel: (id) => stripe.subscriptions.cancel(id, { invoice_now: false, prorate: false }, { idempotencyKey: `delete-account:${userId}:${environment}:${id}` }),
          retrieve: (id) => stripe.subscriptions.retrieve(id),
        });
      }
    }, async () => {
      phase = "deletion";
      for (const table of USER_TABLES) {
        const result = await supabaseAdmin.from(table).delete().eq("user_id", userId);
        if (result.error) throw new Error("データ削除に失敗しました。");
      }
      const profile = await supabaseAdmin.from("profiles").delete().eq("id", userId);
      if (profile.error) throw new Error("プロフィール削除に失敗しました。");
      const result = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (result.error) throw new Error("アカウント削除に失敗しました。");
    });
    const completed = await supabaseAdmin.from("account_deletion_jobs").update({ status: "completed", lease_until: null, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (completed.error) console.error("account_deletion", { phase: "completion_record_failed" });
  } catch (error) {
    await supabaseAdmin.from("account_deletion_jobs").update({ status: "failed", lease_until: null, updated_at: new Date().toISOString() }).eq("user_id", userId);
    console.error("account_deletion", { phase, result: "failed" });
    if (phase === "cancellation") throw new Error("契約の解約を確認できなかったため、アカウントの削除は行っていません。時間をおいて退会を再実行してください。");
    throw new Error("契約の停止確認は完了しましたが、データ削除が途中で止まりました。退会を再実行してください。");
  }
}