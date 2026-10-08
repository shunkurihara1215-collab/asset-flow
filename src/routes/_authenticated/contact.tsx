import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/lib/data";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/contact")({
  head: () => ({ meta: [{ title: "お問い合わせ | Kizuki" }, { name: "description", content: "Kizukiへのお問い合わせ" }] }),
  component: Contact,
});

function Contact() {
  const { data: p } = useProfile();
  const [f, setF] = useState({ email: "", subject: "", body: "" });
  const [done, setDone] = useState(false);
  useEffect(() => { if (p?.email) setF((x) => ({ ...x, email: x.email || p.email })); }, [p]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("inquiries").insert({ email: f.email, subject: f.subject, body: f.body });
    if (error) { toast.error(error.message); return; }
    setDone(true);
  }

  return (
    <div>
      <PageHeader title="お問い合わせ" />
      {done ? (
        <div className="card-surface flex flex-col items-center p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-positive" />
          <p className="mt-4 font-semibold">お問い合わせを受け付けました</p>
        </div>
      ) : (
        <form onSubmit={submit} className="card-surface space-y-4 p-5">
          <div className="space-y-1.5"><Label>メールアドレス</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>件名</Label><Input required maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>お問い合わせ内容</Label><Textarea required rows={6} maxLength={5000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
          <Button type="submit">送信する</Button>
        </form>
      )}
    </div>
  );
}
