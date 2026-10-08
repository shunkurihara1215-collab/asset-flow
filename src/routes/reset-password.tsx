import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "新しいパスワードの設定 | Kizuki" },
      { name: "description", content: "Kizukiのパスワードを再設定します。" },
      { property: "og:title", content: "パスワード再設定 | Kizuki" },
      { property: "og:description", content: "新しいパスワードを設定してください。" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    toast.success("パスワードを更新しました");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submit} className="card-surface w-full max-w-sm space-y-4 p-6">
        <h1 className="font-display text-xl font-semibold">新しいパスワード</h1>
        <div className="space-y-1.5"><Label>パスワード(8文字以上)</Label><Input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button type="submit" className="w-full">更新する</Button>
      </form>
    </div>
  );
}
