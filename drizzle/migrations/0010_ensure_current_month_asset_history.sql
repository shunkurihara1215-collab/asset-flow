CREATE OR REPLACE FUNCTION public.ensure_current_month_asset_history()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m date := date_trunc('month', now() AT TIME ZONE 'Asia/Tokyo')::date; inserted integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('monthly-snapshot',0));
  LOCK TABLE public.assets IN SHARE MODE;
  WITH eligible AS (
    SELECT p.id AS user_id FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.account_deletion_jobs j WHERE j.user_id=p.id)
    AND (EXISTS (SELECT 1 FROM public.assets a WHERE a.user_id=p.id)
      OR EXISTS (SELECT 1 FROM public.asset_history h WHERE h.user_id=p.id AND h.source='auto'))
  ), totals AS (
    SELECT e.user_id, coalesce(sum(a.amount),0) AS total
    FROM eligible e LEFT JOIN public.assets a ON a.user_id=e.user_id GROUP BY e.user_id
  ), groups AS (
    SELECT a.user_id,c.group_key,sum(a.amount) AS amount
    FROM public.assets a JOIN public.asset_categories c ON c.id=a.category_id GROUP BY a.user_id,c.group_key
  ), breakdowns AS (
    SELECT user_id,jsonb_object_agg(group_key,amount) AS breakdown FROM groups GROUP BY user_id
  )
  INSERT INTO public.asset_history(user_id,month,total,breakdown,source,recorded_on)
  SELECT t.user_id,m,t.total,coalesce(b.breakdown,'{}'::jsonb),'auto',(now() AT TIME ZONE 'Asia/Tokyo')::date
  FROM totals t LEFT JOIN breakdowns b ON b.user_id=t.user_id
  ON CONFLICT(user_id,month) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END $$;
REVOKE ALL ON FUNCTION public.ensure_current_month_asset_history() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_current_month_asset_history() TO service_role;
COMMENT ON FUNCTION public.ensure_current_month_asset_history() IS 'Insert only missing JST current-month snapshots from registered assets. No historical backfill; existing rows preserved; atomic and retry-safe.';