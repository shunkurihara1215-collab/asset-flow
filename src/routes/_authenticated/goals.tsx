import { dateLabel, monthLabel } from "@/lib/history";
import { DataGate, ActionError } from "@/components/app/DataState";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAssets, useGoals, useAction, useSubscription } from "@/lib/data";
import { yen, goalProgress, goalTiming } from "@/lib/finance";
import { canUse, FREE_GOAL_LIMIT } from "@/lib/plans";
import { PageHeader, Empty, Stat } from "@/components/app/AppShell";
import { createGoal } from "@/lib/goals.functions";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "目標 | Kizuki" }, { name: "description", content: "資産目標の設定と進捗" }, { property: "og:title", content: "目標 | Kizuki" }, { property: "og:description", content: "資産目標の設定と進捗" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Goals,
});

type F = { name: string; target: string; deadline: string; monthly: string; rate: string };

function Goals() {
  const goalsQuery = useGoals();
  const { data: goals = [] } = goalsQuery;
  const assetsQuery = useAssets();
  const { data: assets = [] } = assetsQuery;
  const subQuery = useSubscription();
  const { data: sub } = subQuery;
  const [f, setF] = useState<F | null>(null);
  const current = assets.reduce((s, a) => s + Number(a.amount), 0);
  const canAdd = canUse(sub?.plan ?? "free", "multiGoals") || goals.length < FREE_GOAL_LIMIT;

  const add = useAction(async (v: F) => createGoal({ data: {
    name: v.name, target: Math.round(Number(v.target)), deadline: v.deadline,
    monthly: Math.round(Number(v.monthly || 0)), rate: Number(v.rate || 0),
  } }), ["goals"]);
  const del = useAction(async (id: string) => supabase.from("goals").delete().eq("id", id).select("id").single(), ["goals"], "delete");

  return (
    <DataGate queries={[goalsQuery, assetsQuery, subQuery]} label="目標・資産データ・契約情報">
    <div>
      <PageHeader title="目標" sub={`現在の資産 ${yen(current)}`} action={
        <Button disabled={!canAdd || add.isPending || del.isPending} onClick={() => { add.reset(); setF({ name: "", target: "", deadline: "", monthly: "", rate: "3" }); }}><Plus />目標を追加</Button>
      } />
      {!canAdd && <p className="mb-4 text-xs text-muted-foreground">複数の目標はプレミアムプランで利用できます。</p>}
      <ActionError error={del.error} />
      {goals.length === 0 ? <Empty>「30歳までに1,500万円」のような目標を立ててみましょう。</Empty> : (
        <div className="space-y-4">
          {goals.map((g) => {
            const target = Number(g.target_amount);
            const p = goalProgress(current, target);
            const timing = goalTiming(current, target, g.deadline, Number(g.monthly_contribution), Number(g.expected_return));
            const { months, need, eta, onTrack } = timing;
            return (
              <section key={g.id} className="card-surface p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold">{g.name}</h2>
                    <p className="text-xs text-muted-foreground">期限 {dateLabel(g.deadline)}・{timing.status === "achieved" ? "達成済み" : timing.status === "expired" ? "期限を過ぎています" : months === null ? "計算データが不足しています" : `残り${Math.floor(months / 12)}年${months % 12}ヶ月（今月を含む）`}</p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="削除" disabled={del.isPending || add.isPending} onClick={() => confirm("削除しますか？") && del.mutate(g.id, { onSuccess: () => toast.success("削除しました") })}><Trash2 /></Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat k="目標金額" v={Number.isFinite(target) && target > 0 ? yen(target) : "未設定"} />
                  <Stat k="達成率" v={timing.status === "unavailable" ? "算出できません" : `${p.rate.toFixed(0)}%`} accent />
                  <Stat k="残り金額" v={timing.status === "unavailable" ? "算出できません" : yen(p.remaining)} />
                  <Stat k="毎月必要な積立" v={need === null ? "算出できません" : yen(Math.ceil(need))} />
                </div>
                {timing.status !== "unavailable" && <Progress value={p.rate} className="mt-4 h-2" />}
                <p className={`mt-3 text-sm ${onTrack ? "text-positive" : "text-muted-foreground"}`}>
                  {timing.status === "achieved" ? "目標を達成しました" : timing.status === "unavailable" ? "計算に必要なデータが不足しています" : <>毎月{yen(Number(g.monthly_contribution))}・年{Number(g.expected_return)}%の場合：{eta === null || !timing.etaMonth ? "達成の見込みが立ちません" : `${monthLabel(timing.etaMonth)}に達成見込み（${eta}回の積立）${onTrack ? "（期限内）" : "（期限超過）"}`}</>}
                </p>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={!!f} onOpenChange={(o) => { if (!o && !add.isPending) setF(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>目標を追加</DialogTitle></DialogHeader>
          {f && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); add.mutate(f, { onSuccess: () => { setF(null); toast.success("目標を追加しました"); }, onError: (er) => toast.error(er.message) }); }}>
              <div className="space-y-1.5"><Label>目標名称</Label><Input disabled={add.isPending} required placeholder="例：30歳までに1,500万円" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>目標金額（円）</Label><Input disabled={add.isPending} required type="number" min={1} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>目標期限</Label><Input disabled={add.isPending} required type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>毎月の積立予定（円）</Label><Input disabled={add.isPending} type="number" min={0} value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>想定利回り（年%）</Label><Input disabled={add.isPending} type="number" step="0.1" min={0} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></div>
              </div>
              <p className="text-xs text-muted-foreground">現在の資産は登録済み資産の合計（{yen(current)}）を使います。</p>
              <ActionError error={add.error} /><Button type="submit" className="w-full" disabled={add.isPending}>{add.isPending ? "保存しています…" : "追加"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </DataGate>
  );
}
