import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAssets } from "@/lib/data";
import { simulate, yen } from "@/lib/finance";
import { StackedSim } from "@/components/app/Charts";
import { PageHeader, Stat } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/simulation")({
  head: () => ({ meta: [{ title: "将来シミュレーション | Kizuki" }, { name: "description", content: "積立と利回りから将来の資産を試算" }] }),
  component: Sim,
});

function Sim() {
  const { data: assets } = useAssets();
  const [initial, setInitial] = useState(4_000_000);
  const [monthly, setMonthly] = useState(50_000);
  const [rate, setRate] = useState(5);
  const [years, setYears] = useState(10);

  useEffect(() => {
    if (assets?.length) setInitial(assets.reduce((s, a) => s + Number(a.amount), 0));
  }, [assets]);

  const data = useMemo(() => simulate(initial, monthly, rate, years), [initial, monthly, rate, years]);
  const last = data[data.length - 1]!;

  return (
    <div className="space-y-5">
      <PageHeader title="将来シミュレーション" />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card-surface space-y-5 p-5">
          <div className="space-y-1.5"><Label>現在の資産（円）</Label><Input type="number" className="num" value={initial} onChange={(e) => setInitial(Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>毎月の積立額（円）</Label><Input type="number" className="num" value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} /></div>
          <div className="space-y-3"><Label>想定利回り <span className="num ml-1">{rate.toFixed(1)}%</span></Label><Slider min={0} max={10} step={0.5} value={[rate]} onValueChange={(v) => setRate(v[0] ?? 0)} /></div>
          <div className="space-y-3"><Label>期間 <span className="num ml-1">{years}年</span></Label><Slider min={1} max={40} step={1} value={[years]} onValueChange={(v) => setYears(v[0] ?? 1)} /></div>
        </section>
        <section className="card-surface p-5 lg:col-span-2">
          <div className="text-sm text-muted-foreground">{years}年後の予想資産</div>
          <div className="num mt-1 text-4xl font-semibold">{yen(last.total)}</div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat k="元本" v={yen(last.principal)} />
            <Stat k="運用による増加" v={yen(last.gain)} accent />
          </div>
          <div className="mt-5 h-64"><StackedSim data={data} /></div>
        </section>
      </div>
      <p className="rounded-lg bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
        ※ 本シミュレーションは一定の利回りが続くと仮定した概算であり、将来の運用成果を保証するものではありません。実際の運用では元本割れの可能性があり、税金・手数料は考慮していません。
      </p>
    </div>
  );
}
