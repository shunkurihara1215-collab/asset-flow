import { z } from "zod";
import { createStripeClient, verifyWebhook, type StripeEnv } from "./stripe.server";

const envelope = z.object({
  id: z.string().regex(/^evt_[A-Za-z0-9_]+$/), type: z.string().max(150),
  created: z.number().int().nonnegative(), livemode: z.boolean(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});
const subscriptionEvents = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);
const invoiceEvents = new Set(["invoice.payment_failed", "invoice.paid"]);
const reference = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return undefined;
};

export async function receivePaymentWebhook(request: Request, environment: StripeEnv): Promise<Response> {
  let event: z.infer<typeof envelope>;
  try {
    event = envelope.parse(await verifyWebhook(request, environment));
    if (event.livemode !== (environment === "live")) throw new Error("Event environment mismatch");
  } catch {
    console.warn("payment_webhook", { environment, result: "verification_failed" });
    return new Response("Invalid payment notification", { status: 400 });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const previous = await supabaseAdmin.from("payment_events").select("status").eq("environment", environment).eq("event_id", event.id).maybeSingle();
    if (previous.error) throw new Error("Event read failed");
    if (previous.data && previous.data.status !== "failed") return Response.json({ received: true, result: "duplicate" });
    if (!subscriptionEvents.has(event.type) && !invoiceEvents.has(event.type)) return Response.json({ received: true, result: "unhandled" });
    const object = event.data.object;
    let subscriptionId = subscriptionEvents.has(event.type) ? reference(object["id"]) : reference(object["subscription"]);
    if (!subscriptionId && invoiceEvents.has(event.type)) {
      const parent = object["parent"];
      const parsed = z.object({ subscription_details: z.object({ subscription: z.unknown() }).nullish() }).safeParse(parent);
      if (parsed.success) subscriptionId = reference(parsed.data.subscription_details?.subscription);
    }
    // Non-subscription invoices do not affect subscription access.
    if (!subscriptionId && invoiceEvents.has(event.type)) return Response.json({ received: true, result: "unrelated_invoice" });
    if (!subscriptionId || !/^sub_[A-Za-z0-9_]+$/.test(subscriptionId)) throw new Error("Missing subscription reference");
    const fetchedAt = new Date().toISOString();
    const latest = await createStripeClient(environment).subscriptions.retrieve(subscriptionId);
    if (latest.livemode !== (environment === "live")) throw new Error("Subscription environment mismatch");
    const userId = latest.metadata["userId"];
    if (!userId || !z.string().uuid().safeParse(userId).success) throw new Error("Missing account reference");
    const customerId = reference(latest.customer);
    if (!customerId) throw new Error("Missing customer reference");
    const item = latest.items.data[0];
    const priceId = item?.price.lookup_key || item?.price.metadata["lovable_external_id"] || item?.price.id || "";
    // Missing periods fail closed rather than creating unlimited access.
    const timestamp = (value: number | undefined) => new Date((value ?? 0) * 1000).toISOString();
    const applied = await supabaseAdmin.rpc("apply_payment_event", {
      p_environment: environment, p_event_id: event.id, p_event_type: event.type,
      p_event_created: event.created, p_subscription_id: latest.id, p_user_id: userId,
      p_customer_id: customerId, p_price_id: priceId, p_status: latest.status,
      p_period_start: timestamp(item?.current_period_start), p_period_end: timestamp(item?.current_period_end),
      p_cancel: latest.cancel_at_period_end, p_fetched_at: fetchedAt,
    });
    if (applied.error) throw new Error("Subscription synchronization failed");
    console.info("payment_webhook", { environment, eventId: event.id, type: event.type, result: applied.data });
    return Response.json({ received: true, result: applied.data });
  } catch {
    const saved = await supabaseAdmin.rpc("record_payment_failure", { p_environment: environment, p_event_id: event.id, p_event_type: event.type, p_event_created: event.created });
    console.error("payment_webhook", { environment, eventId: event.id, type: event.type, result: "retry_required", recorded: !saved.error });
    return new Response("Payment notification needs retry", { status: 503 });
  }
}