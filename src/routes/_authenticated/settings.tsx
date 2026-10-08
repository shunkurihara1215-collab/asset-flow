import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile, useSubscription, useAction } from "@/lib/data";
import { PLAN_LABEL } from "@/lib/plans";
import { deleteMyAccount } from "@/lib/account.functions";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "設定 | Kizuki" }, { name: "description", content: "プロフィールとアカウント設定" }] }),
  component: Settings,
});

const num = (v: string) => (v === "" ? null : Math.round(Number(v)));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card-surface space-y-4 p-5"><h2 className="font-semibold">{title}</h2>{children}</section>;
}

function Settings() {
  const { data: p } = useProfile();
  const { data: sub } = useSubscription();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const del = useServerFn(deleteMyAccount);
  const [f, setF] = useState({ display_name: "", birth_year: "", monthly_income: "", monthly_expense: "", monthly_investment: "", risk_tolerance: "medium", notify_reminder: true, notify_goal: true });
  const [pw, setPw] = useState({ current: "", next: "" });

  useEffect(() => {
    if (p) setF({
      display_name: p.display_name ?? "", birth_year: p.birth_year?.toString() ?? "",
      monthly_income: p.monthly_income?.toString() ?? "", monthly_expense: p.monthly_expense?.toString() ?? "",
      monthly_investment: p.monthly_investment?.toString() ?? "", risk_tolerance: p.risk_tolerance ?? "medium",
      notify_reminder: p.notify_reminder ?? true, notify_goal: p.notify_goal ?? true,
    });
  }, [p]);

  const save = useAction(async () => supabase.from("profiles").update({
    display_name: f.display_name, birth_year: num(f.birth_year), monthly_income: num(f.monthly_income),
    monthly_expense: num(f.monthly_expense), monthly_investment: num(f.monthly_investment),
    risk_tolerance: f.risk_tolerance, notify_reminder: f.notify_reminder, notify_goal: f.notify_goal,
    updated_at: new Date().toISOString(),
  }).eq("id", p!.id), ["profile"]);

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw.next, current_password: pw.current } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("パスワードを変更しました");
    setPw({ current: "", next: "" });
  }

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function deleteAccount() {
    if (!confirm("アカウントとすべてのデータを削除します。元に戻せません。よろしいですか？")) return;
    const r = await del();
    if ("error" in r && r.error) { toast.error(r.error); return; }
    await signOut();
  }

  const field = (k: keyof typeof f, label: string, type = "number") => (
    <div className="space-y-1.5"><Label>{label}</Label><Input type={type} className={type === "number" ? "num" : ""} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="設定" />
      <Section title="プロフィール・家計">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("display_name", "表示名", "text")}
          {field("birth_year", "生まれ年（西暦）")}
          {field("monthly_income", "月収（手取り・円）")}
          {field("monthly_expense", "月の支出（円）")}
          {field("monthly_investment", "毎月の投資額（円）")}
          <div className="space-y-1.5">
            <Label>リスク許容度</Label>
            <Select value={f.risk_tolerance} onValueChange={(v) => setF({ ...f, risk_tolerance: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="low">低い（安定重視）</SelectItem><SelectItem value="medium">普通</SelectItem><SelectItem value="high">高い（成長重視）</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        {f.monthly_income && f.monthly_expense && (
          <p className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">毎月資産形成に回せる金額の目安：<span className="num font-semibold">¥{(Number(f.monthly_income) - Number(f.monthly_expense)).toLocaleString("ja-JP")}</span></p>
        )}
        <Button onClick={() => save.mutate(undefined, { onSuccess: () => toast.success("保存しました"), onError: (e) => toast.error(e.message) })}>保存</Button>
      </Section>

      <Section title="通知">
        <div className="flex items-center justify-between"><span className="text-sm">資産入力リマインダー</span><Switch checked={f.notify_reminder} onCheckedChange={(v) => setF({ ...f, notify_reminder: v })} /></div>
        <div className="flex items-center justify-between"><span className="text-sm">目標達成のお知らせ</span><Switch checked={f.notify_goal} onCheckedChange={(v) => setF({ ...f, notify_goal: v })} /></div>
        <p className="text-xs text-muted-foreground">変更後は上の「保存」を押してください。</p>
      </Section>

      <Section title="アカウント">
        <div className="text-sm"><span className="text-muted-foreground">メールアドレス：</span>{p?.email}</div>
        <form onSubmit={changePw} className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div className="space-y-1.5"><Label>現在のパスワード</Label><Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>新しいパスワード</Label><Input type="password" minLength={8} required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
          <Button type="submit" variant="outline">パスワード変更</Button>
        </form>
      </Section>

      <Section title="プラン">
        <div className="flex items-center justify-between">
          <div><div className="font-medium">{PLAN_LABEL[sub?.plan ?? "free"]}</div><div className="text-xs text-muted-foreground">有料プラン（月額500〜1,000円予定）は準備中です</div></div>
          <Button variant="outline" disabled>アップグレード</Button>
        </div>
      </Section>

      <div className="card-surface divide-y">
        {([["/contact", "お問い合わせ"], ["/terms", "利用規約"], ["/privacy", "プライバシーポリシー"]] as const).map(([to, l]) => (
          <Link key={to} to={to} className="flex items-center justify-between px-5 py-4 text-sm hover:bg-muted">{l}<ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>
        ))}
        <button onClick={signOut} className="w-full px-5 py-4 text-left text-sm hover:bg-muted">ログアウト</button>
        <button onClick={deleteAccount} className="w-full px-5 py-4 text-left text-sm text-destructive hover:bg-muted">アカウント削除</button>
      </div>
    </div>
  );
}
