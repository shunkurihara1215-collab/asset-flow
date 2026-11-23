import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readBillingState } from "./billing.server";

afterEach(() => vi.unstubAllEnvs());
function client(result: { data: unknown; error: unknown }) {
  const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(async () => result) };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.order.mockReturnValue(chain); chain.limit.mockReturnValue(chain);
  return { instance: { from: () => chain } as unknown as SupabaseClient<Database>, chain };
}
describe("shared billing read", () => {
  it("all consumers use configured test environment and deterministic latest row", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_example");
    const { instance, chain } = client({ data: { plan: "premium", provider: "stripe", status: "active" }, error: null });
    const state = await readBillingState(instance, "test-user");
    expect(state.plan).toBe("premium");
    expect(chain.eq).toHaveBeenCalledWith("environment", "sandbox");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "test-user");
    expect(chain.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(chain.order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(1);
  });
  it("live consumers never read test contracts", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_live_example");
    const { instance, chain } = client({ data: null, error: null });
    expect((await readBillingState(instance, "test-user")).plan).toBe("free");
    expect(chain.eq).toHaveBeenCalledWith("environment", "live");
    expect(chain.eq).not.toHaveBeenCalledWith("environment", "sandbox");
  });
  it("a contract read error cannot grant premium", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_example");
    const { instance } = client({ data: { plan: "premium", status: "active" }, error: { message: "unavailable" } });
    await expect(readBillingState(instance, "test-user")).rejects.toThrow("契約情報を確認できませんでした。");
  });
});