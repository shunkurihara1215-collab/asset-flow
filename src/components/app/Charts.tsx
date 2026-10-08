import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { yen } from "@/lib/finance";

export function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="95%" paddingAngle={1.5} stroke="none">
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => yen(v)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

const short = (v: number) => (v >= 1e8 ? `${(v / 1e8).toFixed(1)}億` : v >= 1e4 ? `${Math.round(v / 1e4)}万` : `${v}`);

export function TrendArea({ data }: { data: { label: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} fontSize={11} width={44} stroke="var(--muted-foreground)" />
        <Tooltip formatter={(v: number) => yen(v)} />
        <Area type="monotone" dataKey="total" name="総資産" stroke="var(--primary)" strokeWidth={2} fill="url(#tg)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StackedSim({ data }: { data: { year: number; principal: number; gain: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="year" tickFormatter={(y) => `${y}年`} tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} fontSize={11} width={44} stroke="var(--muted-foreground)" />
        <Tooltip formatter={(v: number) => yen(v)} labelFormatter={(y) => `${y}年後`} />
        <Area type="monotone" stackId="1" dataKey="principal" name="元本" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.85} />
        <Area type="monotone" stackId="1" dataKey="gain" name="運用による増加" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.8} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Legend({ items }: { items: { label: string; color: string; pct: number; value?: number }[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-3 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          <span className="flex-1">{i.label}</span>
          {i.value !== undefined && <span className="num text-muted-foreground">{yen(i.value)}</span>}
          <span className="num w-14 text-right font-medium">{i.pct.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}
