import { timestampLabel } from "@/lib/history";
import { DataGate } from "@/components/app/DataState";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askAdvisor, getAiUsage, getAiRequest } from "@/lib/ai.functions";
import { getStripeEnvironmentSafe } from "@/lib/stripe";
import { useAiHistory } from "@/lib/data";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({ meta: [{ title: "AIアドバイス | Kizuki" }, { name: "description", content: "月ごとの利用枠でAIによる資産状況の分析" }, { property: "og:title", content: "AIアドバイス | Kizuki" }, { property: "og:description", content: "資産状況のAI分析と今月の利用状況" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AiPage,
});

const PRESETS = ["現在の資産状況を総合的に分析して", "目標達成に向けた積立ペースは十分？", "資産配分の偏りはある？", "改善できるポイントを教えて"];
function Answer({ text }: { text: string }) {
  return <div className="whitespace-pre-wrap text-sm leading-7">{text}</div>;
}

function AiPage() {
  const ask = useServerFn(askAdvisor);
  const readUsage = useServerFn(getAiUsage);
  const readRequest = useServerFn(getAiRequest);
  const qc = useQueryClient();
  const usageQuery = useQuery({ queryKey: ["ai", "usage"], queryFn: () => readUsage(), refetchOnWindowFocus: true, refetchInterval: (query) => query.state.data?.pendingRequestId ? 5000 : false, retry: false });
  const usage = usageQuery.data;
  const historyQuery = useAiHistory();
  const { data: hist = [] } = historyQuery;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [requestError, setRequestError] = useState("");
  const [recoveryId, setRecoveryId] = useState<string | null>(null);
  const lock = useRef(false);
  const storageKey = usage ? `kizuki:ai-request:${usage.userId}` : null;
  useEffect(() => {
    setRecoveryId(null);
    if (!storageKey) return;
    try { setRecoveryId(sessionStorage.getItem(storageKey)); } catch { /* Server IDs remain authoritative. */ }
  }, [storageKey]);
  useEffect(() => {
    if (!usage?.month) return;
    const [year, month] = usage.month.split("-").map(Number);
    if (year === undefined || month === undefined) return;
    // Refresh an open page at JST midnight; long waits are capped to avoid timer overflow.
    const delay = Math.max(1000, Math.min(2_147_000_000, Date.UTC(year, month, 1, -9) - Date.now() + 100));
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      if (Date.now() >= Date.UTC(year, month, 1, -9)) void qc.invalidateQueries({ queryKey: ["ai", "usage"] });
      else timer = setTimeout(check, Math.min(2_147_000_000, Date.UTC(year, month, 1, -9) - Date.now() + 100));
    };
    timer = setTimeout(check, delay);
    return () => clearTimeout(timer);
  }, [usage?.month, qc]);
  const blocked = busy || !usage || usageQuery.isError || !!usage.pendingRequestId || !!recoveryId || usage.remaining === 0;
  function remember(id: string | null) {
    setRecoveryId(id);
    if (!storageKey) return;
    try { if (id) sessionStorage.setItem(storageKey, id); else sessionStorage.removeItem(storageKey); } catch { /* Persistence is best effort; quota is server-side. */ }
  }
  async function refresh() { await qc.invalidateQueries({ queryKey: ["ai"] }); }
  async function confirmResult() {
    const requestId = recoveryId ?? usage?.pendingRequestId;
    if (!requestId || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const r = await readRequest({ data: { requestId } });
      if (r.answer) { setAnswer(r.answer); setRequestError(""); }
      else setRequestError(r.error ?? "分析結果を確認しています…");
      if (!r.pending) remember(null);
      await refresh();
    } catch { setRequestError("送信結果を確認できませんでした。時間をおいてご確認ください。"); }
    finally { lock.current = false; setBusy(false); }
  }
  async function run(question: string) {
    if (lock.current || blocked) return;
    lock.current = true; setBusy(true); setRequestError("");
    const requestId = crypto.randomUUID();
    remember(requestId);
    try {
      const r = await ask({ data: { question, environment: getStripeEnvironmentSafe(), requestId } });
      if (r.error) { setRequestError(r.error); toast.error(r.error); }
      else if (r.answer) setAnswer(r.answer);
      if (!r.pending) remember(null);
    } catch {
      setRequestError("送信結果を確認できませんでした。再実行せず、送信結果をご確認ください。");
    } finally {
      await refresh(); setBusy(false); lock.current = false;
    }
  }
  return (
    <DataGate queries={[historyQuery, usageQuery]} label="アドバイス履歴・AI利用状況">
      <div className="space-y-5">
        <PageHeader title="AIアドバイス" sub="登録データをもとに、分析と情報提供を行います" />
        {usage && <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
          <p className="text-sm text-muted-foreground">{usage.month.replace("-", "年")}月 · {usage.limit === 10 ? "プレミアム" : "無料プラン"}</p>
          <p className="text-sm">今月 <strong className="font-num">{usage.used} / {usage.limit}</strong> 回 · 残り <strong className="font-num">{usage.remaining}</strong> 回</p>
        </div>}
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => <Button key={p} variant="outline" size="sm" disabled={blocked} onClick={() => run(p)}>{p}</Button>)}
          </div>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (q.trim()) run(q.trim()); }}>
            <Textarea rows={2} maxLength={1000} placeholder="自由に質問する" value={q} disabled={busy} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit" disabled={blocked || !q.trim()} className="sm:self-end">{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}質問</Button>
          </form>
          {busy && <p role="status" className="text-sm text-muted-foreground">分析・送信結果を確認しています…</p>}
          {!busy && usage?.pendingRequestId && <p role="status" className="text-sm text-muted-foreground">分析が処理中、または結果の確認待ちです。</p>}
          {usage?.remaining === 0 && <p className="text-sm text-muted-foreground">今月の利用上限に達しました。翌月1日午前0時（日本時間）に利用枠が更新されます。</p>}
          {(recoveryId || usage?.pendingRequestId) && <Button variant="outline" disabled={busy} onClick={confirmResult}><RefreshCw />送信結果を確認</Button>}
          {requestError && <p role="alert" className="text-sm text-destructive">{requestError}</p>}
          {answer && <div className="border-l-2 border-primary bg-muted p-5"><Answer text={answer} /></div>}
        </section>
        <p className="text-xs text-muted-foreground">利用枠は毎月1日午前0時（日本時間）に更新されます。AI実行開始後の失敗・確認待ちも1回に含まれます。制限導入前の回答は今月の回数に含みません。</p>
        {hist.length > 0 && <section className="space-y-3">
          <h2 className="font-semibold">これまでのアドバイス</h2>
          {hist.map((h) => <details key={h.id} className="card-surface p-4">
            <summary className="cursor-pointer text-sm"><span className="text-muted-foreground">{timestampLabel(h.created_at)}</span>　{h.question ?? "総合分析"}</summary>
            <div className="mt-3"><Answer text={h.answer} /></div>
          </details>)}
        </section>}
        <p className="text-xs text-muted-foreground">※ AIの回答は情報提供を目的としたもので、特定の投資を推奨するものではありません。</p>
      </div>
    </DataGate>
  );
}
