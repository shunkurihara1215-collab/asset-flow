// Rule-based overall assessment combining age, region and assets (no AI call).

export const PREFECTURES = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"] as const;

const METRO = new Set(["東京都", "神奈川県", "埼玉県", "千葉県", "大阪府", "京都府", "兵庫県", "愛知県", "福岡県"]);

/** Reference asset level by age band (rough guide, yen). */
export function ageBenchmark(age: number): number {
  if (age < 30) return 1_000_000;
  if (age < 40) return 3_000_000;
  if (age < 50) return 5_000_000;
  if (age < 60) return 7_000_000;
  return 10_000_000;
}

export interface InsightInput {
  age: number | null;
  region: string | null;
  total: number;
  cash: number;
  monthlyExpense: number | null;
  topGroupPct: number; // largest allocation share, 0-100
  topGroupLabel?: string;
}

export interface Insight { headline: string; points: string[] }

export function buildInsight(i: InsightInput): Insight {
  const points: string[] = [];
  let headline = "資産の全体像を把握できています。";

  if (i.age !== null) {
    const b = ageBenchmark(i.age);
    const band = `${Math.floor(i.age / 10) * 10}代`;
    const ratio = i.total / b;
    if (ratio >= 1) {
      headline = `${band}の目安を上回る資産を築けています。`;
      points.push(`${band}の参考目安（約${(b / 10000).toLocaleString("ja-JP")}万円）に対し、現在は${(ratio * 100).toFixed(0)}%の水準です。`);
    } else {
      headline = `${band}の目安に向けて着実に積み上げる段階です。`;
      points.push(`${band}の参考目安（約${(b / 10000).toLocaleString("ja-JP")}万円）まで、あと約${Math.ceil((b - i.total) / 10000).toLocaleString("ja-JP")}万円です。`);
    }
  } else {
    points.push("設定で生まれ年を登録すると、同世代の目安と比較できます。");
  }

  const metro = i.region ? METRO.has(i.region) : false;
  const months = metro ? 6 : 4;
  if (i.monthlyExpense && i.monthlyExpense > 0) {
    const cover = i.cash / i.monthlyExpense;
    const where = i.region ? `${i.region}${metro ? "は生活費が高めの傾向のため" : "では"}` : "";
    points.push(cover >= months
      ? `${where}現金・預金は生活費の約${cover.toFixed(1)}ヶ月分あり、生活防衛資金の目安（${months}ヶ月）を満たしています。`
      : `${where}生活防衛資金は生活費の${months}ヶ月分が目安です。現在は約${cover.toFixed(1)}ヶ月分です。`);
  } else if (!i.region) {
    points.push("設定で地域と月の支出を登録すると、生活防衛資金の目安を表示します。");
  }

  if (i.total > 0 && i.topGroupPct >= 70 && i.topGroupLabel) {
    points.push(`資産の${i.topGroupPct.toFixed(0)}%が「${i.topGroupLabel}」に集中しています。分散の状況を確認してみましょう。`);
  }
  return { headline, points };
}
