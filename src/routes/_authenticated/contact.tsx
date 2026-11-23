import { DataGate, ActionError } from "@/components/app/DataState";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useAction } from "@/lib/data";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/contact")({
  head: () => ({ meta: [{ title: "お問い合わせ | Kizuki" }, { name: "description", content: "Kizukiへのお問い合わせ" }, { property: "og:title", content: "お問い合わせ | Kizuki" }, { property: "og:description", content: "Kizukiへのお問い合わせ" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Contact,
});

function Contact() {
  const profileQuery = useProfile();
  const { data: p } = profileQuery;
  const [f, setF] = useState({ email: "", subject: "", body: "" });
  const [done, setDone] = useState(false);
  useEffect(() => { if (p?.email) setF((x) => ({ ...x, email: x.email || p.email })); }, [p]);

  const send = useAction(async () => supabase.from("inquiries").insert({ email: f.email, subject: f.subject, body: f.body }, { count: "exact" }), []);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    send.mutate(undefined, { onSuccess: () => setDone(true), onError: (error) => toast.error(error.message) });
  }

  return (
    <DataGate queries={[profileQuery]} label="プロフィール">
    <div>
      <PageHeader title="お問い合わせ" />
      {done ? (
        <div className="card-surface flex flex-col items-center p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-positive" />
          <p className="mt-4 font-semibold">お問い合わせを受け付けました</p>
        </div>
      ) : (
        <form onSubmit={submit} className="card-surface space-y-4 p-5">
          <div className="space-y-1.5"><Label>メールアドレス</Label><Input disabled={send.isPending} type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>件名</Label><Input disabled={send.isPending} required maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>お問い合わせ内容</Label><Textarea disabled={send.isPending} required rows={6} maxLength={5000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
          <ActionError error={send.error} /><Button type="submit" disabled={send.isPending}>{send.isPending ? "送信しています…" : "送信する"}</Button>
        </form>
      )}
    </div>
    </DataGate>
  );
}
