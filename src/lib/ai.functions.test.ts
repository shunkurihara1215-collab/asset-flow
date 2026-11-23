import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ billing: vi.fn(), available: vi.fn(), insert: vi.fn(), fetch: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./billing.server", () => ({ assertAccountAvailable: mocks.available, readBillingState: mocks.billing }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ insert: mocks.insert }) } }));
import { askAdvisor } from "./ai.functions";

type Result = { answer?: string; error?: string };
const call = askAdvisor as unknown as (args: { data: { question: string; environment: "sandbox" }; context: { userId: string; supabase: unknown } }) => Promise<Result>;
function client(fail = false) {
  const results: Record<string, unknown> = {
    profiles: { data: { birth_year: 1990 }, error: null },
    assets: { data: fail ? null : [], error: fail ? { message: "private_sql" } : null },
    goals: { data: [], error: null },
  };
  return { from: (table: string) => { const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => results[table], then: (resolve: (value: unknown) => unknown) => Promise.resolve(results[table]).then(resolve) }; return chain; } };
}
const run = (fail = false) => call({ data: { question: "test", environment: "sandbox" }, context: { userId: "test-user", supabase: client(fail) } });
function stream(events: unknown[]) {
  // Split frames mid-JSON and leave final completed frame without a trailing newline.
  const text = events.map((event) => `data: ${JSON.stringify(event)}`).join("\n\n");
  return new Response(new ReadableStream({ start(controller) {
    const encoder = new TextEncoder();
    for (let i = 0; i < text.length; i += 7) controller.enqueue(encoder.encode(text.slice(i, i + 7)));
    controller.close();
  } }), { status: 200 });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("LOVABLE_API_KEY", "test-only"); vi.stubGlobal("fetch", mocks.fetch);
  mocks.billing.mockResolvedValue({ plan: "premium", environment: "sandbox" });
  mocks.available.mockResolvedValue(undefined); mocks.insert.mockResolvedValue({ error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("AI verified data and persistence", () => {
  it("AI age uses the same Japanese year as home across New Year", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-31T15:00:00Z"));
    mocks.fetch.mockResolvedValue(stream([{ type: "response.output_text.delta", delta: "test" }, { type: "response.completed" }]));
    await run();
    const args = mocks.fetch.mock.calls[0];
    const request = args?.[1] as { body: string } | undefined;
    if (!request) throw new Error("AI request was not issued");
    const body = JSON.parse(request.body) as { input: string };
    const context = JSON.parse(body.input.split("\n\n")[0]?.replace("ユーザーデータ(JSON): ", "") ?? "{}") as { age?: number };
    expect(context.age).toBe(37);
  });
  it("failed asset read stops analysis before provider call", async () => {
    const result = await run(true);
    expect(result.error).toContain("取得できませんでした");
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
    expect(result.error).not.toContain("private_sql");
  });
  it("incomplete output cannot be saved or returned as successful analysis", async () => {
    mocks.fetch.mockResolvedValue(stream([{ type: "response.output_text.delta", delta: "partial" }]));
    const result = await run(); expect(result.answer).toBeUndefined();
    expect(result.error).toContain("完了できませんでした"); expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("split SSE frames and a final non-newline completion save the complete answer", async () => {
    mocks.fetch.mockResolvedValue(stream([{ type: "response.output_text.delta", delta: "complete answer" }, { type: "response.completed" }]));
    expect(await run()).toEqual({ answer: "complete answer" });
    expect(mocks.insert).toHaveBeenCalledWith({ user_id: "test-user", question: "test", answer: "complete answer" });
  });
  it("save failure never returns a successful saved answer", async () => {
    mocks.fetch.mockResolvedValue(stream([{ type: "response.output_text.delta", delta: "answer" }, { type: "response.completed" }]));
    mocks.insert.mockResolvedValue({ error: { message: "private_sql" } });
    const result = await run(); expect(result.answer).toBeUndefined(); expect(result.error).toContain("保存できませんでした");
  });
  it("failed stream event wins over a completed event", async () => {
    mocks.fetch.mockResolvedValue(stream([{ type: "response.output_text.delta", delta: "partial" }, { type: "response.failed" }, { type: "response.completed" }]));
    expect((await run()).error).toContain("完了できませんでした"); expect(mocks.insert).not.toHaveBeenCalled();
  });
});