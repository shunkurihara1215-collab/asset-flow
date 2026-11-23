import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/lib/data";
import { ActionError } from "@/components/app/DataState";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const save = useAction(async () => supabase.auth.updateUser({ password: pw }), []);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate(undefined, { onSuccess: () => {
      toast.success("パスワードを更新しました");
      navigate({ to: "/dashboard" });
    } });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submit} className="card-surface w-full max-w-sm space-y-4 p-6">
        <h1 className="font-display text-xl font-semibold">新しいパスワード</h1>
        <div className="space-y-1.5"><Label>パスワード(8文字以上)</Label><Input disabled={save.isPending} type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <ActionError error={save.error} />
        <Button type="submit" disabled={save.isPending} className="w-full">{save.isPending ? "更新しています…" : "更新する"}</Button>
      </form>
    </div>
  );
}
