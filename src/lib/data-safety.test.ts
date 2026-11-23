import { describe, expect, it } from "vitest";
import { readState, checkWriteResult, actionMessage } from "./data-safety";

const ready = { isPending: false, isError: false, isFetching: false };
describe("verified read states", () => {
  it("loading cannot become a successful zero/empty balance", () => {
    expect(readState([{ ...ready, isPending: true, isFetching: true }])).toBe("loading");
  });
  it("failed reads override cached success and remain errors during retry", () => {
    expect(readState([ready, { ...ready, isError: true }])).toBe("error");
    expect(readState([{ ...ready, isError: true, isFetching: true }])).toBe("error");
  });
  it("a successful empty list is a valid read, and successful retry clears error", () => {
    expect(readState([ready])).toBe("success");
  });
});
describe("confirmed write outcomes", () => {
  it("DB errors never count as successful saves", () => {
    expect(() => checkWriteResult({ error: { code: "23514", message: "private SQL" } })).toThrow();
  });
  it("RPC string errors never count as successful goals", () => {
    expect(() => checkWriteResult({ error: "goal denied" })).toThrow();
  });
  it("zero affected rows cannot count as deletion or update success", () => {
    expect(() => checkWriteResult({ data: [], error: null })).toThrow("write_not_confirmed");
    expect(() => checkWriteResult({ count: 0, error: null })).toThrow("write_not_confirmed");
  });
  it("one affected row confirms success", () => {
    expect(() => checkWriteResult({ data: { id: "owned-row" }, error: null })).not.toThrow();
    expect(() => checkWriteResult({ count: 1, error: null })).not.toThrow();
  });
  it("missing acknowledgement never counts as a successful save", () => {
    for (const result of [undefined, null, {}, { data: null, error: null }, { id: null }]) {
      expect(() => checkWriteResult(result)).toThrow("write_not_confirmed");
    }
  });
  it("deletion failures never use misleading save wording", () => {
    expect(actionMessage({ code: "23514" }, "delete")).toContain("削除");
    expect(actionMessage({ code: "23514" }, "delete")).not.toContain("保存");
  });
  it("never exposes arbitrary SQL, tokens, or RPC text", () => {
    for (const error of [new Error("SQL private_token"), { message: "SQL private_token" }, "SQL private_token"]) {
      expect(actionMessage(error)).not.toContain("private_token");
      expect(actionMessage(error, "delete")).not.toContain("SQL");
    }
  });
});