import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { performAccountDeletion } from "./account-deletion.server";
import { configuredPaymentEnvironment } from "./billing.server";
import type { StripeEnv } from "./stripe.server";

/** Deletes the caller's own account and all their data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const environments: StripeEnv[] = [];
      if (process.env["STRIPE_SANDBOX_API_KEY"]) environments.push("sandbox");
      if (process.env["STRIPE_LIVE_API_KEY"]) environments.push("live");
      if (!environments.includes(configuredPaymentEnvironment())) return { error: "決済設定を確認できないため、退会を中止しました。" };
      await performAccountDeletion(context.userId, environments);
      return { ok: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "退会処理に失敗しました。再度お試しください。" };
    }
  });
