import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { effectivePlan } from "./plans";
import { paymentEnvironment } from "./billing-lifecycle";

/** Build-owned public configuration, never a request header or caller argument. */
export function configuredPaymentEnvironment() {
  return paymentEnvironment(import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined);
}

export async function readBillingState(client: SupabaseClient<Database>, userId: string) {
  const environment = configuredPaymentEnvironment();
  const { data: row, error } = await client.from("subscriptions").select("*")
    .eq("user_id", userId).eq("environment", environment)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("契約情報を確認できませんでした。");
  return { environment, row, plan: effectivePlan(row) };
}

export async function assertAccountAvailable(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("account_deletion_jobs").select("status").eq("user_id", userId).maybeSingle();
  if (error || data) throw new Error("退会処理中です。退会を再実行するか、時間をおいてお試しください。");
}