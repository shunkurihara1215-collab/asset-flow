import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LineChart, PieChart, Target, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kizuki — いくら持っていて、あといくら。資産形成サポートアプリ" },
      { name: "description", content: "総資産・推移・配分・目標・将来シミュレーション・AIアドバイスを一つに。初心者にもわかりやすい資産管理アプリ。" },
      { property: "og:title", content: "Kizuki — 資産形成サポートアプリ" },
      { property: "og:description", content: "自分の資産を10秒で把握。目標までの道のりを可視化します。" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: LineChart, t: "推移を記録", d: "入力するたび月次で自動記録。増え方が見える。" },
  { icon: PieChart, t: "配分を把握", d: "現金・株式・NISAなどの割合をひと目で。" },
  { icon: Target, t: "目標を追う", d: "達成率と、毎月いくら必要かを自動計算。" },
  { icon: Sparkles, t: "AIが分析", d: "あなたのデータから改善ポイントを提案。" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-display font-bold text-gold">K</span>
          <span className="font-display text-lg font-semibold">Kizuki</span>
        </div>
        <Button asChild variant="ghost"><Link to="/auth">ログイン</Link></Button>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-2 lg:pt-20">
        <div>
          <p className="mb-4 text-sm font-medium tracking-widest text-accent-foreground">資産形成サポート</p>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            いくら持っていて、<br />あと、いくら。
          </h1>
          <p className="mt-6 max-w-md text-muted-foreground">
            総資産・推移・配分・目標を一つの画面に。記録から将来のシミュレーションまで、資産形成の道のりを静かに支えます。
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg"><Link to="/auth">無料ではじめる <ArrowRight /></Link></Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />データはアカウントごとに厳密に分離して保管</p>
        </div>

        <div className="bg-hero rounded-3xl p-8 text-primary-foreground shadow-2xl">
          <div className="text-sm opacity-70">総資産</div>
          <div className="num mt-1 text-5xl font-semibold">¥4,000,000</div>
          <div className="mt-3 flex gap-4 text-sm">
            <span>前月比 <span className="num text-gold">+¥120,000</span></span>
            <span>前年比 <span className="num text-gold">+¥680,000</span></span>
          </div>
          <div className="mt-8 rounded-2xl bg-primary-foreground/10 p-5">
            <div className="flex justify-between text-sm"><span>目標 ¥5,000,000</span><span className="num">80%</span></div>
            <div className="mt-3 h-2 rounded-full bg-primary-foreground/15"><div className="h-2 w-4/5 rounded-full bg-gold" /></div>
            <div className="mt-2 text-xs opacity-70">残り ¥1,000,000</div>
          </div>
        </div>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.t}>
              <f.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-3 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="mx-auto flex max-w-6xl gap-6 px-5 py-8 text-xs text-muted-foreground">
        <span>© Kizuki</span>
        <Link to="/terms">利用規約</Link>
        <Link to="/privacy">プライバシーポリシー</Link>
      </footer>
    </div>
  );
}
