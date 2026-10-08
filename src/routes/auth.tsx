import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "ログイン・新規登録 | Kizuki" },
      { name: "description", content: "Kizukiにログイン、または無料で新規登録。" },
      { property: "og:title", content: "ログイン | Kizuki" },
      { property: "og:description", content: "資産形成サポートアプリKizukiにログイン。" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { display_name: name } },
        });
        if (error) throw error;
        setSent("確認メールを送信しました。メール内のリンクから登録を完了してください。");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("パスワード再設定用のメールを送信しました。");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Googleでのログインに失敗しました");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-hero hidden flex-col justify-between p-12 text-primary-foreground lg:flex">
        <Link to="/" className="font-display text-xl font-semibold">Kizuki</Link>
        <div>
          <p className="font-display text-4xl font-semibold leading-snug">記録して、見える化して、<br />目標に近づく。</p>
          <p className="mt-4 opacity-70">あなたの資産データは、あなただけのものです。</p>
        </div>
        <span className="text-xs opacity-50">© Kizuki</span>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold">
            {mode === "signin" ? "ログイン" : mode === "signup" ? "新規登録" : "パスワード再設定"}
          </h1>
          {sent ? (
            <div className="card-surface mt-6 p-5 text-sm">
              {sent}
              <Button variant="link" className="mt-2 px-0" onClick={() => { setSent(null); setMode("signin"); }}>ログインへ戻る</Button>
            </div>
          ) : (
            <>
              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5"><Label>表示名</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                )}
                <div className="space-y-1.5"><Label>メールアドレス</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                {mode !== "forgot" && (
                  <div className="space-y-1.5"><Label>パスワード</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {mode === "signin" ? "ログイン" : mode === "signup" ? "登録する" : "再設定メールを送る"}
                </Button>
              </form>
              {mode !== "forgot" && (
                <>
                  <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />または<span className="h-px flex-1 bg-border" /></div>
                  <Button variant="outline" className="w-full" onClick={google}>Googleで続ける</Button>
                </>
              )}
              <div className="mt-6 space-y-2 text-center text-sm">
                {mode === "signin" && (
                  <>
                    <button className="block w-full text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>パスワードをお忘れの方</button>
                    <button className="block w-full font-medium" onClick={() => setMode("signup")}>アカウントを作成する</button>
                  </>
                )}
                {mode !== "signin" && <button className="font-medium" onClick={() => setMode("signin")}>ログインへ戻る</button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
