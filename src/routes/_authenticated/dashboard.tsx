import { DataGate } from "@/components/app/DataState";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, ArrowUpRight, ArrowDownRight, Lightbulb } from "lucide-react";
import { buildInsight } from "@/lib/insight";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAssets, useGoals, useHistory, useProfile, allocation } from "@/lib/data";
import { yen, signedYen, goalProgress } from "@/lib/finance";
import { compareMonths, tokyoMonth, monthLabel, monthlySeries, latestRecordComparison } from "@/lib/history";
import { Donut, Legend, TrendArea } from "@/components/app/Charts";
import { Empty, Stat } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "ホーム | Kizuki" }, { name: "description", content: "あなたの資産状況のダッシュボード" }, { property: "og:title", content: "ホーム | Kizuki" }, { property: "og:description", content: "あなたの資産状況のダッシュボード" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

const RANGES = [
  { k: "1M", m: 1 }, { k: "3M", m: 3 }, { k: "6M", m: 6 }, { k: "1Y", m: 12 }, { k: "全期間", m: null },
] as const;

function Delta({ label, comparison }: { label: string; comparison: { targetMonth: string; amount: number | null; rate: number | null } }) {
  const { amount, rate, targetMonth } = comparison;
  const up = (amount ?? 0) >= 0;
  return (
    <div className="min-w-0">
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-1 text-xs opacity-70">{targetMonth ? `${monthLabel(targetMonth)}との比較` : "記録なし"}</div>
      {amount === null ? <div className="mt-1 text-xs opacity-70">比較データがありません</div> : <>
        <div className={`num mt-1 flex flex-wrap items-center gap-0.5 text-base font-medium ${up ? "text-gold" : "text-negative"}`}>
          {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{signedYen(amount)}
        </div>
        <div className="num mt-0.5 text-xs opacity-70">{rate === null ? "増減率：算出できません（比較元0円）" : `${rate >= 0 ? "+" : ""}${rate.toFixed(1)}%`}</div>
      </>}
    </div>
  );
}

function Dashboard() {
  const assetsQuery = useAssets();
  const { data: assets = [] } = assetsQuery;
  const historyQuery = useHistory();
  const { data: hist = [] } = historyQuery;
  const goalsQuery = useGoals();
  const { data: goals = [] } = goalsQuery;
  const profileQuery = useProfile();
  const { data: profile } = profileQuery;
  const [range, setRange] = useState<(typeof RANGES)[number]["k"]>("6M");

  const total = assets.reduce((s, a) => s + Number(a.amount), 0);
  const rows = hist.map((h) => ({ month: h.month, total: Number(h.total) }));
  const now = new Date();
  const nowKey = tokyoMonth(now);
  const lastComparison = latestRecordComparison(rows, total, now);
  const alloc = allocation(assets);
  const rangeM = (RANGES.find((r) => r.k === range)?.m ?? null);
  const trend = monthlySeries(rows, rangeM, now);
  const goal = goals[0];
  const insight = buildInsight({
    age: profile?.birth_year ? Number(nowKey.slice(0, 4)) - profile.birth_year : null,
    region: profile?.region ?? null,
    total,
    cash: alloc.find((a) => a.key === "cash")?.value ?? 0,
    monthlyExpense: profile?.monthly_expense ? Number(profile.monthly_expense) : null,
    topGroupPct: alloc[0]?.pct ?? 0,
    topGroupLabel: alloc[0]?.label,
  });

  return (
    <DataGate queries={[assetsQuery, historyQuery, goalsQuery, profileQuery]} label="資産データ・履歴・目標・プロフィール">
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{profile?.display_name ? `こんにちは、${profile.display_name}さん` : "こんにちは"}</p>

      <section className="bg-hero rounded-3xl p-6 text-primary-foreground sm:p-8">
        <div className="text-sm opacity-70">総資産</div><div className="mt-1 text-xs opacity-70">{monthLabel(nowKey)}・登録済み資産の現在額</div>
        <div className="num mt-1 text-4xl font-semibold sm:text-6xl">{yen(total)}</div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3 border-t border-primary-foreground/15 pt-5">
          <Delta label="前月比" comparison={compareMonths(rows, total, nowKey, 1)} />
          <Delta label="前年同月比" comparison={compareMonths(rows, total, nowKey, 12)} />
          <Delta label="前回記録比" comparison={lastComparison} />
        </div>
      </section>

      {assets.length > 0 && (
        <section className="card-surface p-5">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4 text-gold" />あなたの資産の総評</h2>
          <p className="font-medium">{insight.headline}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{insight.points.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="mt-3 text-xs text-muted-foreground">※ 年齢・地域・資産から自動で算出した参考情報で、投資助言ではありません。</p>
        </section>
      )}

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
                <Button variant="ghost" size="sm" key={r.k} onClick={() => setRange(r.k)} className={`rounded-md px-2 py-1 text-xs ${range === r.k ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}>{r.k}</Button>
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
    </DataGate>
  );
}

