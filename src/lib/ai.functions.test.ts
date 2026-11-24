import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ billing: vi.fn(), available: vi.fn(), rpc: vi.fn(), fetch: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./billing.server", () => ({ assertAccountAvailable: mocks.available, readBillingState: mocks.billing }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
import { askAdvisor } from "./ai.functions";
import type { AiResult } from "./ai-quota";

const id = "72bb49c8-cba7-49ba-848b-6b6f517d823b";
const call = askAdvisor as unknown as (args: { data: { question: string; environment: "sandbox"; requestId: string }; context: { userId: string; supabase: unknown } }) => Promise<AiResult>;
function client(fail = false, previous: unknown = null) {
  const results: Record<string, unknown> = {
    profiles: { data: { birth_year: 1990 }, error: null },
    assets: { data: fail ? null : [], error: fail ? { message: "private_sql" } : null },
    goals: { data: [], error: null },
    ai_usage_requests: { data: previous, error: null },
  };
  return { from: (table: string) => { const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => results[table], then: (resolve: (value: unknown) => unknown) => Promise.resolve(results[table]).then(resolve) }; return chain; } };
}
const run = (fail = false, requestId = id, previous: unknown = null) => call({ data: { question: "test", environment: "sandbox", requestId }, context: { userId: "test-user", supabase: client(fail, previous) } });
function stream(events: unknown[]) {
  const text = events.map((event) => `data: ${JSON.stringify(event)}`).join("\n\n");
  return new Response(new ReadableStream({ start(controller) {
    const encoder = new TextEncoder();
    for (let i = 0; i < text.length; i += 7) controller.enqueue(encoder.encode(text.slice(i, i + 7)));
    controller.close();
  } }), { status: 200 });
}
const complete = () => stream([{ type: "response.output_text.delta", delta: "complete answer" }, { type: "response.completed" }]);
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("LOVABLE_API_KEY", "test-only"); vi.stubGlobal("fetch", mocks.fetch);
  mocks.billing.mockResolvedValue({ plan: "premium", environment: "sandbox" }); mocks.available.mockResolvedValue(undefined);
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "reserve_ai_request" ? { status: "reserved" } : true, error: null }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("AI verified data and persistence", () => {
  it("age uses the Japanese New Year", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-31T15:00:00Z")); mocks.fetch.mockResolvedValue(complete()); await run();
    const request = mocks.fetch.mock.calls[0]?.[1] as { body: string } | undefined;
    if (!request) throw new Error("AI request missing");
    const body = JSON.parse(request.body) as { input: string };
    const context = JSON.parse(body.input.split("\n\n")[0]?.replace("ユーザーデータ(JSON): ", "") ?? "{}") as { age?: number };
    expect(context.age).toBe(37);
  });
  it("failed data read consumes no quota and calls no provider", async () => {
    const result = await run(true); expect(result.error).toContain("取得できませんでした");
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled(); expect(result.error).not.toContain("private_sql");
  });
  it("missing key consumes no quota", async () => {
    vi.stubEnv("LOVABLE_API_KEY", ""); await run(); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("incomplete stream is finalized as failed, never saved as an answer", async () => {
    mocks.fetch.mockResolvedValue(stream([{ type: "response.output_text.delta", delta: "partial" }]));
    const result = await run(); expect(result.answer).toBeUndefined(); expect(result.error).toContain("完了できませんでした");
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_ai_request", expect.objectContaining({ p_answer: "", p_error: expect.any(String) }));
  });
  it("split frames and final non-newline completion save atomically", async () => {
    mocks.fetch.mockResolvedValue(complete()); expect(await run()).toEqual({ answer: "complete answer" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_ai_request", { p_user_id: "test-user", p_request_id: id, p_question: "test", p_answer: "complete answer", p_error: "" });
  });
  it("save failure stays pending and never returns a successful answer", async () => {
    mocks.fetch.mockResolvedValue(complete()); mocks.rpc.mockImplementation(async (name: string) => name === "reserve_ai_request"
      ? { data: { status: "reserved" }, error: null } : { data: null, error: { message: "private_sql" } });
    const result = await run(); expect(result.answer).toBeUndefined(); expect(result.pending).toBe(true); expect(result.error).toContain("保存を確認できませんでした");
  });
  it("failed event wins over completed", async () => {
    mocks.fetch.mockResolvedValue(stream([{ type: "response.output_text.delta", delta: "partial" }, { type: "response.failed" }, { type: "response.completed" }]));
    expect((await run()).answer).toBeUndefined();
  });
  it("network-unknown reservation is never refunded or retried", async () => {
    mocks.fetch.mockRejectedValue(new Error("private transport")); expect((await run()).pending).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledTimes(1); expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
describe("server quota and replay", () => {
  it("Premium requests reserve 10 not client-provided quota", async () => {
    mocks.fetch.mockResolvedValue(complete()); await run(); expect(mocks.rpc).toHaveBeenCalledWith("reserve_ai_request", expect.objectContaining({ p_limit: 10 }));
  });
  it("Free requests reserve 1 and can receive a saved answer", async () => {
    mocks.billing.mockResolvedValue({ plan: "free", environment: "sandbox" }); mocks.fetch.mockResolvedValue(complete());
    expect((await run()).answer).toBe("complete answer"); expect(mocks.rpc).toHaveBeenCalledWith("reserve_ai_request", expect.objectContaining({ p_limit: 1 }));
  });
  it.each(["limit", "busy", "pending", "conflict", "retired", "failed"])("%s cannot invoke the provider", async (status) => {
    mocks.rpc.mockResolvedValue({ data: { status }, error: null }); expect((await run()).answer).toBeUndefined(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("completed retry returns same answer without API or history write", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "completed", answer: "original" }, error: null }); expect(await run()).toEqual({ answer: "original" });
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("two racing copies issue only one API call", async () => {
    let claimed = false;
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name !== "reserve_ai_request") return { data: true, error: null };
      if (claimed) return { data: { status: "pending" }, error: null };
      claimed = true; return { data: { status: "reserved" }, error: null };
    });
    mocks.fetch.mockResolvedValue(complete());
    const results = await Promise.all([run(), run()]); expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.answer)).toHaveLength(1);
    expect(mocks.rpc.mock.calls.filter((args) => args[0] === "finish_ai_request")).toHaveLength(1);
  });
  it("uncertain reservation write prevents provider call", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private_sql" } }); expect((await run()).pending).toBe(true); expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
