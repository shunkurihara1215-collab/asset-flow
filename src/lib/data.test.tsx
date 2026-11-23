import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("./billing.functions", () => ({ getBillingState: vi.fn() }));
import { useAction } from "./data";

function setup(fn: (value: string) => Promise<unknown>, kind: "save" | "delete" = "save") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...renderHook(() => useAction(fn, ["assets", "history"], kind), { wrapper }), invalidate };
}

describe("safe mutation lifecycle", () => {
  it("consecutive submit operations issue exactly one save", async () => {
    let finish: ((value: unknown) => void) | undefined;
    const fn = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = setup(fn);
    act(() => { result.current.mutate("same-row"); result.current.mutate("same-row"); });
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    await act(async () => { finish?.({ data: { id: "row" }, error: null }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
  it("save failure never calls success or invalidates data; manual retry can succeed", async () => {
    const fn = vi.fn().mockResolvedValueOnce({ error: { message: "SQL private" } }).mockResolvedValueOnce({ data: { id: "row" }, error: null });
    const success = vi.fn();
    const { result, invalidate } = setup(fn);
    act(() => result.current.mutate("input", { onSuccess: success }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(success).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled();
    expect(result.current.error?.message).not.toContain("SQL");
    act(() => result.current.mutate("input", { onSuccess: success }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fn).toHaveBeenLastCalledWith("input");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["assets"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["history"] });
    expect(success).toHaveBeenCalledTimes(1);
  });
  it("failed deletion and zero-row deletion never invalidate or signal success", async () => {
    const fn = vi.fn().mockResolvedValueOnce({ error: { message: "denied" } }).mockResolvedValueOnce({ data: [], error: null });
    const { result, invalidate } = setup(fn, "delete");
    act(() => { result.current.mutate("owned-row"); result.current.mutate("owned-row"); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fn).toHaveBeenCalledTimes(1); expect(invalidate).not.toHaveBeenCalled();
    act(() => result.current.mutate("owned-row"));
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});