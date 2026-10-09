CREATE OR REPLACE FUNCTION public.snapshot_assets()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := coalesce(new.user_id, old.user_id);
declare m date := date_trunc('month', (now() at time zone 'Asia/Tokyo'))::date;
begin
  insert into public.asset_history (user_id, month, total, breakdown)
  select uid, m,
    coalesce(sum(a.amount),0),
    coalesce((select jsonb_object_agg(g, s) from (select c.group_key g, sum(a2.amount) s from public.assets a2 join public.asset_categories c on c.id=a2.category_id where a2.user_id=uid group by c.group_key) t), '{}')
  from public.assets a where a.user_id = uid
  on conflict (user_id, month) do update set total = excluded.total, breakdown = excluded.breakdown, source = 'auto', updated_at = now();
  return null;
end $function$;
ALTER TABLE public.assets ADD CONSTRAINT assets_amount_range CHECK (amount >= 0 AND amount <= 1000000000000) NOT VALID;