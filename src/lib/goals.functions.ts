import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAccountAvailable, readBillingState } from "./billing.server";

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    name: z.string().min(1), target: z.number().int(), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    monthly: z.number().int(), rate: z.number(),
  }).parse(input))
  .handler(async ({ context, data }) => {
    try {
      await assertAccountAvailable(context.userId);
      const state = await readBillingState(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // The transaction's trigger serializes concurrent creates and rechecks the same latest contract.
      const result = await supabaseAdmin.rpc("create_goal_for_environment", {
        p_user_id: context.userId, p_environment: state.environment, p_name: data.name,
        p_target: data.target, p_deadline: data.deadline, p_monthly: data.monthly, p_rate: data.rate,
      });
      if (result.error) return { error: result.error.message };
      return { id: result.data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "目標を保存できませんでした。" };
    }
  });