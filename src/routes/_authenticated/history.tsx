import { createFileRoute } from "@tanstack/react-router";
import { useHistory } from "@/lib/data";
import { yen, signedYen } from "@/lib/finance";
import { monthLabel, shortMonth } from "@/lib/history";
import { TrendArea } from "@/components/app/Charts";
import { PageHeader, Empty } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "推移 | Kizuki" }, { name: "description", content: "月ごとの資産推移" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data: hist = [] } = useHistory();
  const rows = hist.map((h) => ({ month: h.month, total: Number(h.total) }));
  return (
    <div className="space-y-5">
      <PageHeader title="資産推移" sub="資産を登録・更新すると、その月の総資産が自動で記録されます" />
      {rows.length === 0 ? <Empty>まだ記録がありません。</Empty> : (
        <>
          <section className="card-surface h-72 p-5"><TrendArea data={rows.map((r) => ({ label: shortMonth(r.month), total: r.total }))} /></section>
          <ul className="card-surface divide-y">
            {[...rows].reverse().map((r, i, arr) => {
              const prev = arr[i + 1];
              const d = prev ? r.total - prev.total : null;
              return (
                <li key={r.month} className="flex items-center justify-between px-5 py-4">
                  <span className="text-sm">{monthLabel(r.month)}</span>
                  <div className="text-right">
                    <div className="num font-semibold">{yen(r.total)}</div>
                    {d !== null && <div className={`num text-xs ${d >= 0 ? "text-positive" : "text-negative"}`}>{signedYen(d)}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
