import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhook } from "./stripe.server";

afterEach(() => vi.unstubAllEnvs());
describe("Stripe webhook verification", () => {
  const secret = "test_webhook_signing_secret";
  const body = JSON.stringify({ type: "customer.subscription.created", data: { object: {} } });
  function request(timestamp: string, valid = true) {
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    return new Request("https://example.test/api/public/payments/webhook?env=sandbox", {
      method: "POST", body, headers: { "stripe-signature": `t=${timestamp},v1=${valid ? signature : "0".repeat(64)}` },
    });
  }
  it("accepts a correctly signed notification", async () => {
    vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", secret);
    const event = await verifyWebhook(request(String(Math.floor(Date.now() / 1000))), "sandbox");
    expect(event.type).toBe("customer.subscription.created");
  });
  it("rejects forged notifications", async () => {
    vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", secret);
    await expect(verifyWebhook(request(String(Math.floor(Date.now() / 1000)), false), "sandbox")).rejects.toThrow("Invalid webhook signature");
  });
  it("rejects notifications older than five minutes", async () => {
    vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", secret);
    await expect(verifyWebhook(request(String(Math.floor(Date.now() / 1000) - 301)), "sandbox")).rejects.toThrow("Webhook timestamp too old");
  });
  it("rejects nonnumeric timestamps", async () => {
    vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", secret);
    await expect(verifyWebhook(request("invalid"), "sandbox")).rejects.toThrow("Webhook timestamp too old");
  });
});