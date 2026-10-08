import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "利用規約 | Kizuki" },
      { name: "description", content: "Kizukiの利用規約。" },
      { property: "og:title", content: "利用規約 | Kizuki" },
      { property: "og:description", content: "Kizukiの利用規約です。" },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-2xl px-5 py-12 text-sm leading-7">
      <Link to="/" className="text-muted-foreground">← 戻る</Link>
      <h1 className="mt-4 font-display text-2xl font-semibold">利用規約</h1>
      <p className="mt-4 text-muted-foreground">(ドラフト)本サービスは資産状況の記録・可視化・シミュレーションのための情報提供ツールであり、投資助言を行うものではありません。シミュレーションやAIの回答は将来の成果を保証するものではありません。正式な規約は公開前に掲載予定です。</p>
    </div>
  ),
});
