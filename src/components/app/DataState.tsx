import { useRef, type ReactNode } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readState, type ReadState } from "@/lib/data-safety";

type QueryState = ReadState & { refetch: () => Promise<unknown> };

export function DataGate({ queries, label, children }: { queries: QueryState[]; label: string; children: ReactNode }) {
  const priorError = useRef(false);
  const current = readState(queries);
  const fetching = queries.some((q) => q.isFetching);
  if (current === "error") priorError.current = true;
  if (current === "success" && !fetching) priorError.current = false;
  const state = priorError.current ? "error" : current;
  if (state === "success") return <>{children}</>;
  return (
    <div className="space-y-3 py-8" role={state === "error" ? "alert" : "status"} aria-live="polite">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        {state === "error" ? <AlertCircle className="h-5 w-5 shrink-0" /> : <Loader2 className="h-5 w-5 shrink-0 animate-spin" />}
        {state === "error" ? `${label}を取得できませんでした。通信状況をご確認のうえ、再度お試しください。` : `${label}を取得しています…`}
      </p>
      {state === "error" && <>
        <p className="text-xs text-muted-foreground">最新の状態を確認できないため、金額や登録済みデータの表示を停止しています。</p>
        <Button variant="outline" disabled={fetching} onClick={() => { void Promise.all(queries.map((q) => q.refetch())); }}>
          {fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}{fetching ? "再取得しています…" : "再試行"}
        </Button>
      </>}
    </div>
  );
}

export function ActionError({ error }: { error: Error | null }) {
  return error ? <p role="alert" className="my-3 text-sm text-destructive">{error.message}</p> : null;
}