import { describe, expect, it, vi } from "vitest";
import { assertPaymentEnvironment, cancelBeforeDelete, confirmCancellations, paymentEnvironment } from "./billing-lifecycle";

describe("trusted payment environment", () => {
  it("test configuration cannot select live", () => {
    expect(paymentEnvironment("pk_test_example")).toBe("sandbox");
    expect(() => assertPaymentEnvironment("live", paymentEnvironment("pk_test_example"))).toThrow();
  });
  it("live configuration cannot select sandbox", () => {
    expect(paymentEnvironment("pk_live_example")).toBe("live");
    expect(() => assertPaymentEnvironment("sandbox", paymentEnvironment("pk_live_example"))).toThrow();
  });
  it("unknown configuration fails closed", () => expect(() => paymentEnvironment(undefined)).toThrow());
});

describe("account cancellation order", () => {
  it("cancellation failure never deletes personal data", async () => {
    const remove = vi.fn();
    await expect(cancelBeforeDelete(async () => { throw new Error("Stripe unavailable"); }, remove)).rejects.toThrow();
    expect(remove).not.toHaveBeenCalled();
  });
  it("unconfirmed cancellation never deletes personal data", async () => {
    const remove = vi.fn();
    await expect(cancelBeforeDelete(() => confirmCancellations({
      list: async () => [{ id: "sub_test", status: "active" }],
      cancel: async () => ({ status: "canceled" }), retrieve: async () => ({ status: "active" }),
    }), remove)).rejects.toThrow();
    expect(remove).not.toHaveBeenCalled();
  });
  it("canceled and expired contracts are not canceled twice", async () => {
    const cancel = vi.fn();
    await confirmCancellations({ list: async () => [{ id: "sub_a", status: "canceled" }, { id: "sub_b", status: "incomplete_expired" }], cancel, retrieve: vi.fn() });
    expect(cancel).not.toHaveBeenCalled();
  });
  it("no contracts allows deletion", async () => {
    const remove = vi.fn();
    await cancelBeforeDelete(() => confirmCancellations({ list: async () => [], cancel: vi.fn(), retrieve: vi.fn() }), remove);
    expect(remove).toHaveBeenCalledOnce();
  });
  it("incomplete contracts are canceled and confirmed", async () => {
    const steps: string[] = [];
    await cancelBeforeDelete(() => confirmCancellations({
      list: async () => [{ id: "sub_pending", status: "incomplete" }],
      cancel: async () => { steps.push("cancel"); return { status: "canceled" }; },
      retrieve: async () => { steps.push("confirm"); return { status: "canceled" }; },
    }), async () => { steps.push("delete"); });
    expect(steps).toEqual(["cancel", "confirm", "delete"]);
  });
  it("retry after a partial deletion skips already canceled subscriptions", async () => {
    let status = "active";
    const cancel = vi.fn(async () => { status = "canceled"; return { status }; });
    const port = { list: async () => [{ id: "sub_retry", status }], cancel, retrieve: async () => ({ status }) };
    await expect(cancelBeforeDelete(() => confirmCancellations(port), async () => { throw new Error("Delete failed"); })).rejects.toThrow();
    const remove = vi.fn();
    await cancelBeforeDelete(() => confirmCancellations(port), remove);
    expect(cancel).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });
});