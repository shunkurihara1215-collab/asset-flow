import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAssets, useGoals, useHistory, useProfile, allocation } from "@/lib/data";
import { yen, signedYen, goalProgress } from "@/lib/finance";
import { diffVsMonthsAgo, filterRange, shortMonth } from "@/lib/history";
import { Donut, Legend, TrendArea } from "@/components/app/Charts";
import { Empty } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "ホーム | Kizuki" }, { name: "description", content: "あなたの資産状況のダッシュボード" }] }),
  component: Dashboard,
});

const RANGES = [
  { k: "1M", m: 1 }, { k: "3M", m: 3 }, { k: "6M", m: 6 }, { k: "1Y", m: 12 }, { k: "全期間", m: null },
] as const;

function Delta({ label, v }: { label: string; v: number | null }) {
  const up = (v ?? 0) >= 0;
  return (
    <div>
      <div className="text-xs opacity-70">{label}</div>
      {v === null ? (
        <div className="num mt-0.5 text-base opacity-60">—</div>
      ) : (
        <div className={`num mt-0.5 flex items-center gap-0.5 text-base font-medium ${up ? "text-gold" : "text-negative"}`}>
          {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          {signedYen(v)}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const { data: assets = [] } = useAssets();
  const { data: hist = [] } = useHistory();
  const { data: goals = [] } = useGoals();
  const { data: profile } = useProfile();
  const [range, setRange] = useState<(typeof RANGES)[number]["k"]>("6M");

  const total = assets.reduce((s, a) => s + Number(a.amount), 0);
  const rows = hist.map((h) => ({ month: h.month, total: Number(h.total) }));
  const nowKey = new Date().toISOString().slice(0, 7);
  const prevRows = rows.filter((r) => r.month.slice(0, 7) < nowKey);
  const lastInput = prevRows.length ? total - prevRows[prevRows.length - 1].total : null;
  const alloc = allocation(assets);
  const rangeM = RANGES.find((r) => r.k === range)!.m;
  const trend = filterRange(rows, rangeM).map((r) => ({ label: shortMonth(r.month), total: r.total }));
  const goal = goals[0];

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">こんにちは、{profile?.display_name ?? ""}さん</p>

      <section className="bg-hero rounded-3xl p-6 text-primary-foreground sm:p-8">
        <div className="text-sm opacity-70">総資産</div>
        <div className="num mt-1 text-4xl font-semibold sm:text-6xl">{yen(total)}</div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-primary-foreground/15 pt-5">
          <Delta label="前月比" v={diffVsMonthsAgo(rows, total, 1)} />
          <Delta label="前年比" v={diffVsMonthsAgo(rows, total, 12)} />
          <Delta label="前回記録比" v={lastInput} />
        </div>
      </section>

      {assets.length === 0 && (
        <Empty>
          まだ資産が登録されていません。
          <div className="mt-3"><Button asChild><Link to="/assets"><Plus />資産を登録する</Link></Button></div>
        </Empty>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card-surface p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">資産推移</h2>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {RANGES.map((r) => (
                <button key={r.k} onClick={() => setRange(r.k)} className={`rounded-md px-2 py-1 text-xs ${range === r.k ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}>{r.k}</button>
              ))}
            </div>
          </div>
          <div className="h-56">{trend.length ? <TrendArea data={trend} /> : <p className="pt-20 text-center text-sm text-muted-foreground">記録が増えるとグラフが表示されます</p>}</div>
        </section>

        <section className="card-surface p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">資産配分</h2>
          {alloc.length ? (
            <>
              <div className="mx-auto h-40 w-40"><Donut data={alloc} /></div>
              <div className="mt-4"><Legend items={alloc.slice(0, 5)} /></div>
            </>
          ) : <p className="text-sm text-muted-foreground">資産を登録すると表示されます</p>}
        </section>
      </div>

      <section className="card-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">目標</h2>
          <Link to="/goals" className="text-sm text-muted-foreground">すべて見る →</Link>
        </div>
        {goal ? (() => {
          const g = goalProgress(total, Number(goal.target_amount));
          return (
            <div>
              <div className="text-sm text-muted-foreground">{goal.name}</div>
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat k="目標" v={yen(Number(goal.target_amount))} />
                <Stat k="現在" v={yen(total)} />
                <Stat k="達成率" v={`${g.rate.toFixed(0)}%`} accent />
                <Stat k="残り" v={yen(g.remaining)} />
              </div>
              <Progress value={g.rate} className="mt-4 h-2" />
            </div>
          );
        })() : (
          <p className="text-sm text-muted-foreground">目標を設定すると進捗が表示されます。<Link to="/goals" className="ml-1 font-medium text-foreground underline">目標を作る</Link></p>
        )}
      </section>
    </div>
  );
}

export function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className={`num mt-0.5 text-lg font-semibold ${accent ? "text-accent-foreground" : ""}`}>{v}</div>
    </div>
  );
}
