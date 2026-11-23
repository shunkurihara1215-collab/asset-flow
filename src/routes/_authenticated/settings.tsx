import { DataGate, ActionError } from "@/components/app/DataState";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { setDemoPlan } from "@/lib/plan.functions";
import { createPortalSession, getCheckoutStatus } from "@/lib/payments.functions";
import { getStripeEnvironmentSafe } from "@/lib/stripe";
import { PREFECTURES } from "@/lib/insight";
import { PageHeader } from "@/components/app/AppShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StripeEmbeddedCheckout } from "@/components/app/StripeEmbeddedCheckout";
import { PREMIUM_PRICING } from "@/lib/premium-pricing";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "設定 | Kizuki" }, { name: "description", content: "プロフィールとアカウント設定" }, { property: "og:title", content: "設定 | Kizuki" }, { property: "og:description", content: "プロフィール・契約・アカウントを管理" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Settings,
});

const num = (v: string) => (v === "" ? null : Math.round(Number(v)));

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="card-surface space-y-4 p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">{title}</h2>{action}</div>{children}</section>;
}

function Settings() {
  const profileQuery = useProfile();
  const { data: p } = profileQuery;
  const subQuery = useSubscription();
  const { data: sub } = subQuery;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const del = useServerFn(deleteMyAccount);
  const switchPlan = useServerFn(setDemoPlan);
  const checkoutStatus = useServerFn(getCheckoutStatus);
  const [editing, setEditing] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const dirty = useRef(false);
  const [f, setDraft] = useState({ display_name: "", birth_year: "", monthly_income: "", monthly_expense: "", monthly_investment: "", risk_tolerance: "medium", region: "", notify_reminder: true, notify_goal: true });
  const setF = (value: typeof f) => { dirty.current = true; setDraft(value); };
  // Demo plan switching is disabled; premium comes only from a verified Stripe subscription.
  const demoAllowed = false;
  const [pw, setPw] = useState({ current: "", next: "" });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletionMessage, setDeletionMessage] = useState("");

  // Returning from checkout: refresh the plan and close the dialog.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const sessionId = search.get("session_id");
    if (search.get("checkout") === "done" && sessionId) {
      setCheckoutOpen(false);
      checkoutStatus({ data: { sessionId, environment: getStripeEnvironmentSafe() } }).then((result) => {
        if ("error" in result) { toast.error(result.error); return; }
        if (result.complete) {
          qc.invalidateQueries({ queryKey: ["subscription"] });
          toast.success("お支払いが完了しました。プランを更新しています。");
        } else toast.info("お支払いはまだ完了していません。");
      }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "お支払い状況を確認できませんでした"));
      window.history.replaceState(null, "", "/settings");
      const poll = window.setInterval(() => qc.invalidateQueries({ queryKey: ["subscription"] }), 1500);
      const stop = window.setTimeout(() => window.clearInterval(poll), 30000);
      return () => { window.clearInterval(poll); window.clearTimeout(stop); };
    }
    return undefined;
  }, [qc, checkoutStatus]);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const r = await createPortalSession({ data: { returnUrl: window.location.href, environment: getStripeEnvironmentSafe() } });
      if ("error" in r && r.error) { toast.error(r.error); return; }
      if ("url" in r) window.open(r.url, "_blank");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "お支払い管理を開けませんでした");
    } finally {
      setPortalLoading(false);
    }
  }

  useEffect(() => {
    if (p && !dirty.current) setDraft({
      display_name: p.display_name ?? "", birth_year: p.birth_year?.toString() ?? "",
      monthly_income: p.monthly_income?.toString() ?? "", monthly_expense: p.monthly_expense?.toString() ?? "",
      monthly_investment: p.monthly_investment?.toString() ?? "", risk_tolerance: p.risk_tolerance ?? "medium", region: p.region ?? "",
      notify_reminder: p.notify_reminder ?? true, notify_goal: p.notify_goal ?? true,
    });
  }, [p]);

  const save = useAction(async () => {
    if (!p?.id) throw new Error("プロフィールを読み込んでいます");
    return supabase.from("profiles").update({
    display_name: f.display_name, birth_year: num(f.birth_year), monthly_income: num(f.monthly_income),
    monthly_expense: num(f.monthly_expense), monthly_investment: num(f.monthly_investment),
    risk_tolerance: f.risk_tolerance, region: f.region || null, notify_reminder: f.notify_reminder, notify_goal: f.notify_goal,
    updated_at: new Date().toISOString(),
  }).eq("id", p.id).select("id").single();
  }, ["profile"]);

  const password = useAction(async () => supabase.auth.updateUser({ password: pw.next, current_password: pw.current } as never), []);
  function changePw(e: React.FormEvent) {
    e.preventDefault();
    password.mutate(undefined, { onSuccess: () => {
      toast.success("パスワードを変更しました");
      setPw({ current: "", next: "" }); setPwOpen(false);
    }, onError: (error) => toast.error(error.message) });
  }

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function deleteAccount() {
    if (deleting || !confirm("有効な契約は即時解約し、確認後にアカウントとデータを削除します。自動返金はありません。元に戻せません。よろしいですか？")) return;
    setDeleting(true);
    setDeletionMessage("契約の停止を確認してから、アカウントを削除しています…");
    try {
      const r = await del();
      if ("error" in r && r.error) { setDeletionMessage(r.error); toast.error(r.error); return; }
      await signOut();
    } catch {
      setDeletionMessage("退会の結果を確認できませんでした。時間をおいて再度お試しください。");
    } finally { setDeleting(false); }
  }

  const field = (k: keyof typeof f, label: string, type = "number") => (
    <div className="space-y-1.5"><Label>{label}</Label><Input disabled={save.isPending} type={type} className={type === "number" ? "num" : ""} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );

  return (
    <DataGate queries={[profileQuery, subQuery]} label="プロフィール・契約情報">
    <div className="space-y-5">
      <PageHeader title="設定" />
      <Section title="プロフィール・家計" action={!editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>編集</Button>}>
        {editing ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("display_name", "表示名", "text")}
              {field("birth_year", "生まれ年（西暦）")}
              <div className="space-y-1.5">
                <Label>住んでいる地域</Label>
                <Select disabled={save.isPending} value={f.region} onValueChange={(v) => setF({ ...f, region: v })}>
                  <SelectTrigger><SelectValue placeholder="都道府県を選択" /></SelectTrigger>
                  <SelectContent>{PREFECTURES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {field("monthly_income", "月収（手取り・円）")}
              {field("monthly_expense", "月の支出（円）")}
              {field("monthly_investment", "毎月の投資額（円）")}
              <div className="space-y-1.5">
                <Label>リスク許容度</Label>
                <Select disabled={save.isPending} value={f.risk_tolerance} onValueChange={(v) => setF({ ...f, risk_tolerance: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">低い（安定重視）</SelectItem><SelectItem value="medium">普通</SelectItem><SelectItem value="high">高い（成長重視）</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button disabled={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => { dirty.current = false; toast.success("保存しました"); setEditing(false); }, onError: (e) => toast.error(e.message) })}>保存</Button>
              <Button disabled={save.isPending} variant="ghost" onClick={() => { dirty.current = false; setEditing(false); qc.resetQueries({ queryKey: ["profile"] }); }}>キャンセル</Button>
            </div>
          </>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {([
              ["表示名", p?.display_name], ["生まれ年", p?.birth_year && `${p.birth_year}年`], ["住んでいる地域", p?.region],
              ["月収（手取り）", p?.monthly_income != null && `¥${Number(p.monthly_income).toLocaleString("ja-JP")}`],
              ["月の支出", p?.monthly_expense != null && `¥${Number(p.monthly_expense).toLocaleString("ja-JP")}`],
              ["毎月の投資額", p?.monthly_investment != null && `¥${Number(p.monthly_investment).toLocaleString("ja-JP")}`],
              ["リスク許容度", { low: "低い（安定重視）", medium: "普通", high: "高い（成長重視）" }[p?.risk_tolerance ?? "medium"] ?? p?.risk_tolerance],
            ] as const).map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="num mt-0.5">{v || "未設定"}</dd></div>
            ))}
          </dl>
        )}
        {f.monthly_income && f.monthly_expense && (
          <p className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">毎月資産形成に回せる金額の目安：<span className="num font-semibold">¥{(Number(f.monthly_income) - Number(f.monthly_expense)).toLocaleString("ja-JP")}</span></p>
        )}
      </Section>

      <ActionError error={save.error} />
      <Section title="通知">
        <div className="flex items-center justify-between"><span className="text-sm">資産入力リマインダー</span><Switch disabled={save.isPending} checked={f.notify_reminder} onCheckedChange={(v) => setF({ ...f, notify_reminder: v })} /></div>
        <div className="flex items-center justify-between"><span className="text-sm">目標達成のお知らせ</span><Switch disabled={save.isPending} checked={f.notify_goal} onCheckedChange={(v) => setF({ ...f, notify_goal: v })} /></div>
        <Button size="sm" variant="outline" disabled={save.isPending || editing} onClick={() => save.mutate(undefined, { onSuccess: () => { dirty.current = false; toast.success("通知設定を保存しました"); }, onError: (e) => toast.error(e.message) })}>通知設定を保存</Button>
      </Section>

      <Section title="アカウント">
        <div className="text-sm"><span className="text-muted-foreground">メールアドレス：</span>{p?.email}</div>
        {pwOpen ? (
          <form onSubmit={changePw} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>現在のパスワード</Label><Input disabled={password.isPending} type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>新しいパスワード（8文字以上）</Label><Input disabled={password.isPending} type="password" minLength={8} required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
            <div className="flex gap-2 sm:col-span-2"><ActionError error={password.error} /><Button type="submit" disabled={password.isPending}>{password.isPending ? "変更しています…" : "変更を確定"}</Button><Button type="button" disabled={password.isPending} variant="ghost" onClick={() => { setPwOpen(false); setPw({ current: "", next: "" }); }}>キャンセル</Button></div>
          </form>
        ) : (
          <Button variant="outline" onClick={() => setPwOpen(true)}>パスワードを変更</Button>
        )}
      </Section>

      <Section title="プラン">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">{PLAN_LABEL[sub?.plan ?? "free"]}</div>
            {sub?.row?.cancel_at_period_end && sub?.row?.current_period_end && (
              <div className="text-xs text-muted-foreground">解約予定：{new Date(sub.row.current_period_end).toLocaleDateString("ja-JP")}まで利用できます</div>
            )}
            {!sub?.row?.cancel_at_period_end && sub?.plan === "premium" && sub?.row?.current_period_end && (
              <div className="text-xs text-muted-foreground">次回更新日：{new Date(sub.row.current_period_end).toLocaleDateString("ja-JP")}</div>
            )}
          </div>
          {sub?.plan !== "premium" && (
            <Button onClick={() => setCheckoutOpen(true)}>プレミアムに申し込む</Button>
          )}
          {sub?.row?.provider === "stripe" && (
            <Button variant="outline" onClick={openPortal} disabled={portalLoading}>
              {portalLoading ? "開いています…" : "お支払い・解約の管理"}
            </Button>
          )}
        </div>
        {sub?.plan !== "premium" && (
          <p className="text-xs text-muted-foreground">プレミアム（{PREMIUM_PRICING.label}）ではAIアドバイス・複数の目標・詳細なシミュレーションが使えます。</p>
        )}
        {demoAllowed && sub?.row?.provider !== "stripe" && (
          <div className="rounded-lg border border-dashed p-3">
            <div className="mb-2 text-xs text-muted-foreground">プレビュー環境専用のデモ切り替えです（課金は発生しません）</div>
            <div className="flex rounded-lg bg-muted p-1">
              {(["free", "premium"] as const).map((pl) => (
                <button key={pl} onClick={async () => {
                  if (sub?.plan === pl) return;
                  const r = await switchPlan({ data: { plan: pl } });
                  if ("error" in r && r.error) { toast.error(r.error); return; }
                  await qc.invalidateQueries({ queryKey: ["subscription"] });
                  toast.success(`${PLAN_LABEL[pl]}に切り替えました`);
                }} className={`rounded-md px-3 py-1.5 text-sm ${sub?.plan === pl ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}>{PLAN_LABEL[pl]}</button>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>プレミアムプランのお申し込み</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{PREMIUM_PRICING.label}</p>
          {checkoutOpen && (
            <StripeEmbeddedCheckout
              priceId={PREMIUM_PRICING.priceId}
               returnUrl={`${window.location.origin}/settings?checkout=done&session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="card-surface divide-y">
        {([["/contact", "お問い合わせ"], ["/terms", "利用規約"], ["/privacy", "プライバシーポリシー"]] as const).map(([to, l]) => (
          <Link key={to} to={to} className="flex items-center justify-between px-5 py-4 text-sm hover:bg-muted">{l}<ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>
        ))}
        <button onClick={signOut} className="w-full px-5 py-4 text-left text-sm hover:bg-muted">ログアウト</button>
        <Button variant="ghost" disabled={deleting} onClick={deleteAccount} className="w-full justify-start px-5 py-4 text-destructive">{deleting ? "退会処理中…" : "アカウント削除"}</Button>
        {deletionMessage && <p role="status" className="px-5 py-3 text-sm text-muted-foreground">{deletionMessage}</p>}
      </div>
    </div>
    </DataGate>
  );
}
