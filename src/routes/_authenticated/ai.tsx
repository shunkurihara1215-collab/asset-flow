import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askAdvisor } from "@/lib/ai.functions";
import { useAiHistory, useSubscription } from "@/lib/data";
import { canUse, BETA_ALL_ACCESS } from "@/lib/plans";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({ meta: [{ title: "AIアドバイス | Kizuki" }, { name: "description", content: "AIによる資産状況の分析" }] }),
  component: AiPage,
});

const PRESETS = ["現在の資産状況を総合的に分析して", "目標達成に向けた積立ペースは十分？", "資産配分の偏りはある？", "改善できるポイントを教えて"];

function Answer({ text }: { text: string }) {
  return <div className="whitespace-pre-wrap text-sm leading-7">{text}</div>;
}

function AiPage() {
  const ask = useServerFn(askAdvisor);
  const qc = useQueryClient();
  const { data: sub } = useSubscription();
  const { data: hist = [] } = useAiHistory();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const allowed = canUse(sub?.plan ?? "free", "aiAdvice");

  async function run(question: string) {
    setBusy(true);
    setAnswer(null);
    try {
      const r = await ask({ data: { question } });
      if ("error" in r && r.error) toast.error(r.error);
      else if ("answer" in r) { setAnswer(r.answer ?? ""); qc.invalidateQueries({ queryKey: ["ai"] }); }
    } catch {
      toast.error("AIの応答に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="AIアドバイス" sub="登録データをもとに、分析と情報提供を行います" />
      {BETA_ALL_ACCESS && <p className="text-xs text-muted-foreground">ベータ期間中はすべての方がご利用いただけます（将来はプレミアム機能）。</p>}
      {!allowed ? (
        <div className="card-surface p-6 text-sm">AIアドバイスはプレミアムプランの機能です。<Link to="/settings" className="ml-1 font-medium underline">設定でプレミアムに切り替える（デモ）</Link></div>
      ) : (
        <section className="card-surface space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => <Button key={p} variant="outline" size="sm" disabled={busy} onClick={() => run(p)}>{p}</Button>)}
          </div>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (q.trim()) run(q.trim()); }}>
            <Textarea rows={2} placeholder="自由に質問する" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit" disabled={busy || !q.trim()} className="sm:self-end">{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}質問</Button>
          </form>
          {busy && <p className="text-sm text-muted-foreground">分析しています…</p>}
          {answer && <div className="rounded-xl bg-muted p-5"><Answer text={answer} /></div>}
        </section>
      )}
      {hist.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">これまでのアドバイス</h2>
          {hist.map((h) => (
            <details key={h.id} className="card-surface p-4">
              <summary className="cursor-pointer text-sm"><span className="text-muted-foreground">{new Date(h.created_at).toLocaleDateString("ja-JP")}</span>　{h.question ?? "総合分析"}</summary>
              <div className="mt-3"><Answer text={h.answer} /></div>
            </details>
          ))}
        </section>
      )}
      <p className="text-xs text-muted-foreground">※ AIの回答は情報提供を目的としたもので、特定の投資を推奨するものではありません。</p>
    </div>
  );
}
