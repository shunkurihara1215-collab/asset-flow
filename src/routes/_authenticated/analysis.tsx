import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useAssets, allocation } from "@/lib/data";
import { Donut, Legend } from "@/components/app/Charts";
import { PageHeader, Empty } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/analysis")({
  head: () => ({ meta: [{ title: "分析 | Kizuki" }, { name: "description", content: "資産配分の分析" }] }),
  component: Analysis,
});

function Analysis() {
  const { data: assets = [] } = useAssets();
  const alloc = allocation(assets);
  if (!alloc.length) return (<><PageHeader title="資産配分" /><Empty>資産を登録すると配分が表示されます。</Empty></>);
  return (
    <div className="space-y-5">
      <PageHeader title="資産配分" sub="カテゴリー別の割合" />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card-surface p-6"><div className="mx-auto h-64 w-64"><Donut data={alloc} /></div></section>
        <section className="card-surface p-6"><Legend items={alloc} /></section>
      </div>
      <section className="card-surface space-y-3 p-6">
        <h2 className="font-semibold">割合バー</h2>
        {alloc.map((a) => (
          <div key={a.key}>
            <div className="mb-1 flex justify-between text-sm"><span>{a.label}</span><span className="num">{a.pct.toFixed(1)}%</span></div>
            <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full" style={{ width: `${a.pct}%`, background: a.color }} /></div>
          </div>
        ))}
      </section>
      <Link to="/ai" className="card-surface flex items-center gap-3 p-5 hover:bg-accent">
        <Sparkles className="h-5 w-5 text-gold" />
        <div className="flex-1"><div className="font-medium">AIに配分を分析してもらう</div><div className="text-xs text-muted-foreground">年齢・目標・リスク許容度をもとにコメントします</div></div>→
      </Link>
    </div>
  );
}
