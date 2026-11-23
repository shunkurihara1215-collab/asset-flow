export type ReadState = { isPending: boolean; isError: boolean; isFetching: boolean };

/** Errors win over cached success: never present stale balances as current. */
export function readState(queries: ReadState[]): "loading" | "error" | "success" {
  if (queries.some((q) => q.isError)) return "error";
  if (queries.some((q) => q.isPending)) return "loading";
  return "success";
}

export function checkWriteResult(result: unknown): void {
  if (!result || typeof result !== "object") throw new Error("write_not_confirmed");
  if ("error" in result && result.error) throw result.error;
  if (("count" in result && result.count === 0) ||
      ("data" in result && Array.isArray(result.data) && result.data.length === 0)) {
    throw new Error("write_not_confirmed");
  }
  const confirmed = ("data" in result && result.data !== null && result.data !== undefined) ||
    ("count" in result && typeof result.count === "number" && result.count > 0) ||
    ("id" in result && typeof result.id === "string" && result.id.length > 0);
  if (!confirmed) throw new Error("write_not_confirmed");
}

export function actionMessage(error: unknown, kind: "save" | "delete" = "save"): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (kind === "delete") return "削除の完了を確認できませんでした。表示は変更していません。再取得して確認し、必要に応じて再度お試しください。";
  if (code === "23505") return "同じデータがすでに登録されています。登録内容をご確認ください。";
  if (code === "23514" || code === "22P02") return "入力内容を確認し、もう一度お試しください。保存は完了していません。";
  if (code === "42501" || code === "PGRST301") return "操作を完了できませんでした。ログイン状態をご確認のうえ、再度お試しください。";
  // Only this known business error may cross the UI boundary; never echo arbitrary SQL/RPC errors.
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (message.includes("フリープラン") && message.includes("目標")) return "フリープランで登録できる目標は1件です。登録済みの目標をご確認ください。";
  return "保存の完了を確認できませんでした。入力内容は保持しています。通信状況と登録済みデータをご確認のうえ、再度お試しください。";
}