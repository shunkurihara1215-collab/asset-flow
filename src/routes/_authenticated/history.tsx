import { DataGate, ActionError } from "@/components/app/DataState";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useHistory, useAction, GROUPS } from "@/lib/data";
import { yen, signedYen } from "@/lib/finance";
import { monthLabel, monthlySeries, previousMonthEnd, isPastMonthDate, dateLabel, compareMonths, uniqueHistory } from "@/lib/history";
import { TrendArea } from "@/components/app/Charts";
import { PageHeader, Empty } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "推移 | Kizuki" }, { name: "description", content: "月ごとの資産推移と過去資産の登録" }, { property: "og:title", content: "推移 | Kizuki" }, { property: "og:description", content: "月ごとの資産推移と過去資産の登録" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: HistoryPage,
});

const GROUP_KEYS = Object.keys(GROUPS);

function HistoryPage() {
  const historyQuery = useHistory();
  const { data: hist = [] } = historyQuery;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const rawRows = hist.map((h) => ({ month: h.month, total: Number(h.total), id: h.id, source: h.source, on: h.recorded_on }));
  const now = new Date();
  const rows = uniqueHistory(rawRows);
  const series = monthlySeries(rawRows, null, now);
  const maxDate = previousMonthEnd(now);

  const save = useAction(async () => {
    const breakdown: Record<string, number> = {};
    for (const k of GROUP_KEYS) { const n = Math.round(Number(vals[k] || 0)); if (n) breakdown[k] = n; }
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    const { data: u, error } = await supabase.auth.getUser();
    if (error || !u.user) throw new Error("auth_required");
    return supabase.from("asset_history").upsert(
      { user_id: u.user.id, month: `${date.slice(0, 7)}-01`, recorded_on: date, total, breakdown, source: "manual", updated_at: new Date().toISOString() },
      { onConflict: "user_id,month" },
    ).select("id").single();
  }, ["history"]);
  const del = useAction(async (id: string) => supabase.from("asset_history").delete().eq("id", id).select("id").single(), ["history"], "delete");

  return (
    <DataGate queries={[historyQuery]} label="資産履歴">
    <div className="space-y-5">
      <PageHeader title="資産推移" sub="今月分は資産の登録で自動記録。過去の資産は日付を指定して登録できます" action={<Button disabled={save.isPending || del.isPending} onClick={() => { save.reset(); setDate(""); setVals({}); setOpen(true); }}><Plus />過去の資産を登録</Button>} />
      <ActionError error={del.error} />
      {rows.length === 0 ? <Empty>まだ記録がありません。過去の資産を登録すると、これまでの推移を確認できます。</Empty> : (
        <>
          <section className="card-surface h-72 p-5"><TrendArea data={series} /></section>
          <ul className="card-surface divide-y">
            {[...rows].reverse().map((r) => {
              const comparison = compareMonths(rawRows, r.total, r.month.slice(0, 7), 1);
              const d = comparison.amount;
              return (
                <li key={r.month} className="flex items-center gap-3 px-5 py-4">
                  <div className="flex-1">
                    <div className="text-sm">{monthLabel(r.month)}</div>
                    {r.source === "auto" && <div className="text-xs text-muted-foreground">自動記録・登録済み資産</div>}
                    {r.source === "manual" && r.on && <div className="text-xs text-muted-foreground">{dateLabel(r.on)}時点・手動登録</div>}
                  </div>
                  <div className="text-right">
                    <div className="num font-semibold">{yen(r.total)}</div>
                    <div className="text-xs text-muted-foreground">{monthLabel(comparison.targetMonth)}比</div>
                    {d === null ? <div className="text-xs text-muted-foreground">比較データがありません</div> : <div className={`num text-xs ${d >= 0 ? "text-positive" : "text-negative"}`}>{signedYen(d)}{comparison.rate === null ? "（増減率なし）" : `（${comparison.rate >= 0 ? "+" : ""}${comparison.rate.toFixed(1)}%）`}</div>}
                  </div>
                  {r.source === "manual" && <Button size="icon" variant="ghost" aria-label="削除" disabled={del.isPending || save.isPending} onClick={() => confirm("この記録を削除しますか？") && del.mutate(r.id, { onSuccess: () => toast.success("削除しました") })}><Trash2 /></Button>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!save.isPending) setOpen(o); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>過去の資産を登録</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (!isPastMonthDate(date, now)) { toast.error("先月以前の日付を指定してください"); return; }
            save.mutate(undefined, { onSuccess: () => { setOpen(false); toast.success("登録しました"); }, onError: (er) => toast.error(er.message) });
          }}>
            <div className="space-y-1.5"><Label>いつ時点の資産ですか</Label><Input disabled={save.isPending} type="date" required max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">同じ月に登録済みの場合は上書きされます。わかる項目だけ入力してください（円）。</p>
            <div className="grid grid-cols-2 gap-3">
              {GROUP_KEYS.map((k) => (
                <div key={k} className="space-y-1"><Label className="text-xs">{GROUPS[k]?.label ?? k}</Label><Input disabled={save.isPending} type="number" min={0} inputMode="numeric" className="num" value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></div>
              ))}
            </div>
            <div className="text-sm">合計 <span className="num font-semibold">{yen(GROUP_KEYS.reduce((s, k) => s + Number(vals[k] || 0), 0))}</span></div>
            <ActionError error={save.error} /><Button type="submit" className="w-full" disabled={save.isPending}>{save.isPending ? "登録しています…" : "登録"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </DataGate>
  );
}
