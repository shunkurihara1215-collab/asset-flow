alter table public.subscriptions
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists price_id text,
  add column if not exists environment text not null default 'sandbox',
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_start timestamptz;

alter table public.subscriptions drop constraint if exists subscriptions_user_id_key;

create unique index if not exists subscriptions_stripe_sub_uidx
  on public.subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_subscriptions_user_env on public.subscriptions(user_id, environment);