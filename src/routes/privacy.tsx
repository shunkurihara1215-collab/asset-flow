import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "プライバシーポリシー | Kizuki" },
      { name: "description", content: "Kizukiにおける個人情報の取り扱い。" },
      { property: "og:title", content: "プライバシーポリシー | Kizuki" },
      { property: "og:description", content: "Kizukiのプライバシーポリシーです。" },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-2xl px-5 py-12 text-sm leading-7">
      <Link to="/" className="text-muted-foreground">← 戻る</Link>
      <h1 className="mt-4 font-display text-2xl font-semibold">プライバシーポリシー</h1>
      <p className="mt-4 text-muted-foreground">(ドラフト)ご登録いただいた資産情報はアカウントごとに分離して保管され、ご本人以外は閲覧できません。正式なポリシーは公開前に掲載予定です。</p>
    </div>
  ),
});
