import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssets, useCategories, useAction } from "@/lib/data";
import { yen } from "@/lib/finance";
import { PageHeader, Empty } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({ meta: [{ title: "資産 | Kizuki" }, { name: "description", content: "資産の登録・編集" }] }),
  component: AssetsPage,
});

type Form = { id?: string; name: string; amount: string; category_id: string; memo: string };
const blank: Form = { name: "", amount: "", category_id: "", memo: "" };

function AssetsPage() {
  const { data: assets = [] } = useAssets();
  const { data: cats = [] } = useCategories();
  const [form, setForm] = useState<Form | null>(null);
  const keys = ["assets", "history"];

  const save = useAction(async (f: Form) => {
    const row = { name: f.name, amount: Math.round(Number(f.amount)), category_id: f.category_id, memo: f.memo || null };
    return f.id
      ? supabase.from("assets").update({ ...row, updated_at: new Date().toISOString() }).eq("id", f.id)
      : supabase.from("assets").insert(row);
  }, keys);
  const del = useAction(async (id: string) => supabase.from("assets").delete().eq("id", id), keys);

  const total = assets.reduce((s, a) => s + Number(a.amount), 0);

  return (
    <div>
      <PageHeader title="資産" sub={`合計 ${yen(total)}・${assets.length}件`} action={<Button onClick={() => setForm(blank)}><Plus />追加</Button>} />
      {assets.length === 0 ? (
        <Empty>まずは銀行口座や証券口座の残高を登録してみましょう。</Empty>
      ) : (
        <ul className="card-surface divide-y">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.category?.name} ・ 更新 {new Date(a.updated_at).toLocaleDateString("ja-JP")}</div>
              </div>
              <div className="num text-right font-semibold">{yen(Number(a.amount))}</div>
              <Button size="icon" variant="ghost" aria-label="編集" onClick={() => setForm({ id: a.id, name: a.name, amount: String(a.amount), category_id: a.category_id, memo: a.memo ?? "" })}><Pencil /></Button>
              <Button size="icon" variant="ghost" aria-label="削除" onClick={() => confirm("削除しますか？") && del.mutate(a.id)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "資産を編集" : "資産を追加"}</DialogTitle></DialogHeader>
          {form && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.category_id) { toast.error("カテゴリーを選択してください"); return; }
                save.mutate(form, { onSuccess: () => { setForm(null); toast.success("保存しました"); }, onError: (er) => toast.error(er.message) });
              }}
            >
              <div className="space-y-1.5"><Label>名称</Label><Input required placeholder="例：〇〇銀行 普通預金" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>カテゴリー</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>金額（円）</Label><Input required type="number" min={0} inputMode="numeric" className="num" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>メモ</Label><Textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={save.isPending}>保存</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
