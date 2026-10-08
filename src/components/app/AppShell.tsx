import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Home, Wallet, LineChart, Target, PieChart, Sparkles, Settings, LogOut, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/lib/data";
import { PLAN_LABEL } from "@/lib/plans";

const NAV = [
  { to: "/dashboard", label: "ホーム", icon: Home },
  { to: "/assets", label: "資産", icon: Wallet },
  { to: "/history", label: "推移", icon: LineChart },
  { to: "/goals", label: "目標", icon: Target },
  { to: "/analysis", label: "分析", icon: PieChart },
  { to: "/simulation", label: "試算", icon: Calculator, desktopOnly: true },
  { to: "/ai", label: "AI", icon: Sparkles },
  { to: "/settings", label: "設定", icon: Settings },
] as const;

export function AppShell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: sub } = useSubscription();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground lg:flex">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary font-display font-bold text-sidebar-primary-foreground">K</span>
          <span className="font-display text-lg font-semibold tracking-tight text-sidebar-accent-foreground">Kizuki</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
            >
              <n.icon className="h-4 w-4" />
              {n.label === "試算" ? "シミュレーション" : n.label}
            </Link>
          ))}
        </nav>
        <div className="rounded-lg border border-sidebar-border px-3 py-3 text-xs">
          <div className="text-sidebar-foreground/70">ご利用中</div>
          <div className="mt-0.5 font-medium text-sidebar-primary">{PLAN_LABEL[sub?.plan ?? "free"]}</div>
        </div>
        <button onClick={signOut} className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" /> ログアウト
        </button>
      </aside>

      <div className="flex-1 pb-24 lg:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary font-display text-sm font-bold text-gold">K</span>
            <span className="font-display font-semibold">Kizuki</span>
          </Link>
          <Link to="/simulation" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calculator className="h-4 w-4" />試算
          </Link>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.filter((n) => !("desktopOnly" in n)).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground"
            activeProps={{ className: "text-primary font-semibold" }}
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card-surface p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className={`num mt-0.5 text-lg font-semibold ${accent ? "text-accent-foreground" : ""}`}>{v}</div>
    </div>
  );
}
