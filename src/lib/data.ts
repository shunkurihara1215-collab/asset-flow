import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { effectivePlan, type Plan } from "./plans";

// Category groups shown in allocation charts.
export const GROUPS: Record<string, { label: string; color: string }> = {
  cash: { label: "現金・預金", color: "var(--chart-1)" },
  jp_stock: { label: "日本株", color: "var(--chart-2)" },
  us_stock: { label: "米国株", color: "var(--chart-3)" },
  fund: { label: "投資信託", color: "var(--chart-4)" },
  nisa: { label: "NISA", color: "var(--chart-5)" },
  ideco: { label: "iDeCo", color: "var(--chart-6)" },
  crypto: { label: "暗号資産", color: "var(--chart-7)" },
  real_estate: { label: "不動産", color: "var(--chart-8)" },
  other: { label: "その他", color: "var(--muted-foreground)" },
};

const unwrap = <T,>(r: { data: T | null; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: async () => unwrap(await supabase.from("asset_categories").select("*").order("sort_order")),
  });

export const useAssets = () =>
  useQuery({
    queryKey: ["assets"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("assets")
          .select("*, category:asset_categories(id,name,group_key)")
          .order("amount", { ascending: false }),
      ),
  });

export const useHistory = () =>
  useQuery({
    queryKey: ["history"],
    queryFn: async () => unwrap(await supabase.from("asset_history").select("*").order("month")),
  });

export const useGoals = () =>
  useQuery({
    queryKey: ["goals"],
    queryFn: async () => unwrap(await supabase.from("goals").select("*").order("deadline")),
  });

export const useProfile = () =>
  useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: p, error } = await supabase.from("profiles").select("*").eq("id", u.user!.id).maybeSingle();
      if (error) throw new Error(error.message);
      return { ...p!, email: u.user?.email ?? "" };
    },
  });

export const useSubscription = () =>
  useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const s = unwrap(await supabase.from("subscriptions").select("*").maybeSingle());
      return { plan: effectivePlan(s as never) as Plan, row: s };
    },
  });

export const useIncome = () =>
  useQuery({
    queryKey: ["income"],
    queryFn: async () =>
      unwrap(await supabase.from("income_expenses").select("*").order("month", { ascending: false })),
  });

export const useAiHistory = () =>
  useQuery({
    queryKey: ["ai"],
    queryFn: async () =>
      unwrap(await supabase.from("ai_advice_history").select("*").order("created_at", { ascending: false }).limit(10)),
  });

/** Generic mutation that invalidates given keys. */
export function useAction<V>(fn: (v: V) => Promise<unknown>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const r = (await fn(v)) as { error?: { message: string } | null } | undefined;
      if (r && r.error) throw new Error(r.error.message);
    },
    onSuccess: () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
}

export function allocation(assets: { amount: number; category: { group_key: string } | null }[]) {
  const map = new Map<string, number>();
  for (const a of assets) {
    const g = a.category?.group_key ?? "other";
    map.set(g, (map.get(g) ?? 0) + Number(a.amount));
  }
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()]
    .map(([key, value]) => ({
      key,
      label: GROUPS[key]?.label ?? key,
      color: GROUPS[key]?.color ?? "var(--muted-foreground)",
      value,
      pct: total ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}
