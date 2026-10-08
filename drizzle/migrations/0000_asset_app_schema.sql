
create type public.app_role as enum ('admin','user');
create type public.plan_tier as enum ('free','premium');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  birth_year int,
  monthly_income bigint,
  monthly_expense bigint,
  monthly_investment bigint,
  risk_tolerance text default 'medium',
  notify_reminder boolean not null default true,
  notify_goal boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create table public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  key text not null,
  name text not null,
  group_key text not null,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.asset_categories to authenticated;
grant all on public.asset_categories to service_role;
alter table public.asset_categories enable row level security;
create policy "read system or own" on public.asset_categories for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "own insert" on public.asset_categories for insert to authenticated with check (user_id = auth.uid());
create policy "own update" on public.asset_categories for update to authenticated using (user_id = auth.uid());
create policy "own delete" on public.asset_categories for delete to authenticated using (user_id = auth.uid());

insert into public.asset_categories (key,name,group_key,sort_order) values
('cash','現金','cash',1),('savings','普通預金','cash',2),('time_deposit','定期預金','cash',3),
('jp_stock','日本株','jp_stock',4),('us_stock','米国株','us_stock',5),('fund','投資信託','fund',6),
('nisa','NISA','nisa',7),('ideco','iDeCo','ideco',8),('crypto','暗号資産','crypto',9),
('insurance','保険','other',10),('real_estate','不動産','real_estate',11),('other','その他','other',12);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  category_id uuid not null references public.asset_categories(id),
  name text not null,
  amount bigint not null default 0,
  memo text,
  ticker text,
  quantity numeric,
  avg_cost numeric,
  current_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.assets to authenticated;
grant all on public.assets to service_role;
alter table public.assets enable row level security;
create policy "own assets" on public.assets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.asset_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  month date not null,
  total bigint not null,
  breakdown jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);
grant select, insert, update, delete on public.asset_history to authenticated;
grant all on public.asset_history to service_role;
alter table public.asset_history enable row level security;
create policy "own history" on public.asset_history for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.snapshot_assets()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := coalesce(new.user_id, old.user_id);
begin
  insert into public.asset_history (user_id, month, total, breakdown)
  select uid, date_trunc('month', now())::date,
    coalesce(sum(a.amount),0),
    coalesce((select jsonb_object_agg(g, s) from (select c.group_key g, sum(a2.amount) s from public.assets a2 join public.asset_categories c on c.id=a2.category_id where a2.user_id=uid group by c.group_key) t), '{}')
  from public.assets a where a.user_id = uid
  on conflict (user_id, month) do update set total = excluded.total, breakdown = excluded.breakdown, updated_at = now();
  return null;
end $$;
create trigger assets_snapshot after insert or update or delete on public.assets for each row execute function public.snapshot_assets();

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  target_amount bigint not null,
  deadline date not null,
  monthly_contribution bigint not null default 0,
  expected_return numeric not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.goals to authenticated;
grant all on public.goals to service_role;
alter table public.goals enable row level security;
create policy "own goals" on public.goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.income_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  month date not null,
  income bigint not null default 0,
  fixed_cost bigint not null default 0,
  variable_cost bigint not null default 0,
  investment bigint not null default 0,
  savings bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);
grant select, insert, update, delete on public.income_expenses to authenticated;
grant all on public.income_expenses to service_role;
alter table public.income_expenses enable row level security;
create policy "own ie" on public.income_expenses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  plan plan_tier not null default 'free',
  status text not null default 'active',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "own sub read" on public.subscriptions for select to authenticated using (user_id = auth.uid());

create table public.ai_advice_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  question text,
  answer text not null,
  created_at timestamptz not null default now()
);
grant select, delete on public.ai_advice_history to authenticated;
grant all on public.ai_advice_history to service_role;
alter table public.ai_advice_history enable row level security;
create policy "own ai read" on public.ai_advice_history for select to authenticated using (user_id = auth.uid());
create policy "own ai delete" on public.ai_advice_history for delete to authenticated using (user_id = auth.uid());

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  email text not null,
  subject text not null,
  body text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
grant select, insert on public.inquiries to authenticated;
grant all on public.inquiries to service_role;
alter table public.inquiries enable row level security;
create policy "insert own inquiry" on public.inquiries for insert to authenticated with check (user_id = auth.uid());
create policy "read own or admin" on public.inquiries for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notif" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notif upd" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "own notif del" on public.notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  insert into public.subscriptions (user_id, plan) values (new.id, 'free');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
