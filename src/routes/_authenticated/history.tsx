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
import { monthLabel, shortMonth } from "@/lib/history";
import { TrendArea } from "@/components/app/Charts";
import { PageHeader, Empty } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "推移 | Kizuki" }, { name: "description", content: "月ごとの資産推移と過去資産の登録" }] }),
  component: HistoryPage,
});

const GROUP_KEYS = Object.keys(GROUPS);

function HistoryPage() {
  const { data: hist = [] } = useHistory();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const rows = hist.map((h) => ({ month: h.month, total: Number(h.total), id: h.id, source: h.source, on: h.recorded_on }));
  const now = new Date();
  const maxDate = new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString("sv-SE");

  const save = useAction(async () => {
    const breakdown: Record<string, number> = {};
    for (const k of GROUP_KEYS) { const n = Math.round(Number(vals[k] || 0)); if (n) breakdown[k] = n; }
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    const { data: u } = await supabase.auth.getUser();
    return supabase.from("asset_history").upsert(
      { user_id: u.user!.id, month: `${date.slice(0, 7)}-01`, recorded_on: date, total, breakdown, source: "manual", updated_at: new Date().toISOString() },
      { onConflict: "user_id,month" },
    );
  }, ["history"]);
  const del = useAction(async (id: string) => supabase.from("asset_history").delete().eq("id", id), ["history"]);

  return (
    <div className="space-y-5">
      <PageHeader title="資産推移" sub="今月分は資産の登録で自動記録。過去の資産は日付を指定して登録できます" action={<Button onClick={() => { setDate(""); setVals({}); setOpen(true); }}><Plus />過去の資産を登録</Button>} />
      {rows.length === 0 ? <Empty>まだ記録がありません。過去の資産を登録すると、これまでの推移を確認できます。</Empty> : (
        <>
          <section className="card-surface h-72 p-5"><TrendArea data={rows.map((r) => ({ label: shortMonth(r.month), total: r.total }))} /></section>
          <ul className="card-surface divide-y">
            {[...rows].reverse().map((r, i, arr) => {
              const prev = arr[i + 1];
              const d = prev ? r.total - prev.total : null;
              return (
                <li key={r.month} className="flex items-center gap-3 px-5 py-4">
                  <div className="flex-1">
                    <div className="text-sm">{monthLabel(r.month)}</div>
                    {r.source === "manual" && r.on && <div className="text-xs text-muted-foreground">{new Date(r.on).toLocaleDateString("ja-JP")}時点・手動登録</div>}
                  </div>
                  <div className="text-right">
                    <div className="num font-semibold">{yen(r.total)}</div>
                    {d !== null && <div className={`num text-xs ${d >= 0 ? "text-positive" : "text-negative"}`}>{signedYen(d)}</div>}
                  </div>
                  {r.source === "manual" && <Button size="icon" variant="ghost" aria-label="削除" onClick={() => confirm("この記録を削除しますか？") && del.mutate(r.id)}><Trash2 /></Button>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>過去の資産を登録</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (!date || date > maxDate) { toast.error("先月以前の日付を指定してください"); return; }
            save.mutate(undefined, { onSuccess: () => { setOpen(false); toast.success("登録しました"); }, onError: (er) => toast.error(er.message) });
          }}>
            <div className="space-y-1.5"><Label>いつ時点の資産ですか</Label><Input type="date" required max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">同じ月に登録済みの場合は上書きされます。わかる項目だけ入力してください（円）。</p>
            <div className="grid grid-cols-2 gap-3">
              {GROUP_KEYS.map((k) => (
                <div key={k} className="space-y-1"><Label className="text-xs">{GROUPS[k]!.label}</Label><Input type="number" min={0} inputMode="numeric" className="num" value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></div>
              ))}
            </div>
            <div className="text-sm">合計 <span className="num font-semibold">{yen(GROUP_KEYS.reduce((s, k) => s + Number(vals[k] || 0), 0))}</span></div>
            <Button type="submit" className="w-full" disabled={save.isPending}>登録</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
