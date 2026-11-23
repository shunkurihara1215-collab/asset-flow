import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), retrieve: vi.fn(), rpc: vi.fn(), previous: vi.fn() }));
vi.mock("./stripe.server", () => ({ verifyWebhook: mocks.verify, createStripeClient: () => ({ subscriptions: { retrieve: mocks.retrieve } }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.previous }) }) }) }), rpc: mocks.rpc,
} }));
import { receivePaymentWebhook } from "./payment-webhook.server";

const request = () => new Request("https://example.test/api/public/payments/webhook?env=sandbox", { method: "POST" });
const userId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockResolvedValue({ id: "evt_test", created: 123, type: "customer.subscription.updated", livemode: false, data: { object: { id: "sub_test", status: "active" } } });
  mocks.previous.mockResolvedValue({ data: null, error: null });
  mocks.rpc.mockResolvedValue({ data: "processed", error: null });
  mocks.retrieve.mockResolvedValue({ id: "sub_test", livemode: false, customer: "cus_test", metadata: { userId }, status: "canceled", cancel_at_period_end: false, items: { data: [{ price: { lookup_key: "premium_monthly" }, current_period_start: 100, current_period_end: 200 }] } });
});
describe("payment event processing", () => {
  it("invalid signatures never access stored contracts", async () => {
    mocks.verify.mockRejectedValue(new Error("invalid"));
    expect((await receivePaymentWebhook(request(), "sandbox")).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("test events cannot update live contracts", async () => {
    expect((await receivePaymentWebhook(request(), "live")).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("processed event IDs are skipped", async () => {
    mocks.previous.mockResolvedValue({ data: { status: "processed" }, error: null });
    expect((await receivePaymentWebhook(request(), "sandbox")).status).toBe(200);
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("old active payload uses latest canceled Stripe contract", async () => {
    await receivePaymentWebhook(request(), "sandbox");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_payment_event", expect.objectContaining({ p_status: "canceled", p_environment: "sandbox" }));
  });
  it("updates reconcile through insert-or-update rather than a zero-row update", async () => {
    await receivePaymentWebhook(request(), "sandbox");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_payment_event", expect.objectContaining({ p_subscription_id: "sub_test", p_user_id: userId }));
  });
  it("failed events can be retried", async () => {
    mocks.previous.mockResolvedValue({ data: { status: "failed" }, error: null });
    expect((await receivePaymentWebhook(request(), "sandbox")).status).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalledOnce();
  });
  it("storage failure returns retryable status and records failure", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "database unavailable" } });
    expect((await receivePaymentWebhook(request(), "sandbox")).status).toBe(503);
    expect(mocks.rpc).toHaveBeenLastCalledWith("record_payment_failure", expect.objectContaining({ p_event_id: "evt_test" }));
  });
  it("invoice payment failures use the current subscription status", async () => {
    mocks.verify.mockResolvedValue({ id: "evt_invoice", created: 124, livemode: false, type: "invoice.payment_failed", data: { object: { parent: { subscription_details: { subscription: "sub_test" } } } } });
    await receivePaymentWebhook(request(), "sandbox");
    expect(mocks.retrieve).toHaveBeenCalledWith("sub_test");
  });
  it("missing account identity does not acknowledge a subscription as saved", async () => {
    mocks.retrieve.mockResolvedValue({ livemode: false, metadata: {} });
    expect((await receivePaymentWebhook(request(), "sandbox")).status).toBe(503);
  });
});