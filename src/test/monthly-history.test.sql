-- Privileged isolated PostgreSQL test; all fixtures and forced failures roll back.
-- Run with psql -X -v ON_ERROR_STOP=1 -v test_user_id=<isolated-test-uuid> -f src/test/monthly-history.test.sql.
BEGIN;
CREATE TEMP TABLE history_test_identity(id uuid);
INSERT INTO history_test_identity VALUES(:'test_user_id'::uuid);
DO $$
DECLARE uid uuid; category uuid; m date:=date_trunc('month',now() AT TIME ZONE 'Asia/Tokyo')::date; original_id uuid; n integer;
BEGIN
 SELECT id INTO uid FROM history_test_identity;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid AND email LIKE 'agent-test+%@example.com') THEN RAISE EXCEPTION 'dedicated test account required'; END IF;
 IF EXISTS(SELECT 1 FROM public.assets WHERE user_id=uid) OR EXISTS(SELECT 1 FROM public.asset_history WHERE user_id=uid) THEN RAISE EXCEPTION 'test account must be empty'; END IF;
 SELECT id INTO category FROM public.asset_categories WHERE user_id IS NULL ORDER BY sort_order LIMIT 1;
 IF category IS NULL THEN RAISE EXCEPTION 'category fixture required'; END IF;
 -- Unknown state must never be recorded as zero.
 IF public.ensure_current_month_asset_history(uid)<>0 THEN RAISE EXCEPTION 'unknown assets recorded'; END IF;
 INSERT INTO public.assets(user_id,category_id,name,amount) VALUES(uid,category,'test asset',300000);
 SELECT id INTO original_id FROM public.asset_history WHERE user_id=uid AND month=m;
 IF original_id IS NULL THEN RAISE EXCEPTION 'asset change did not create current history'; END IF;
 IF public.ensure_current_month_asset_history(uid)<>0 THEN RAISE EXCEPTION 'duplicate snapshot'; END IF;
 IF (SELECT id FROM public.asset_history WHERE user_id=uid AND month=m)<>original_id THEN RAISE EXCEPTION 'existing snapshot overwritten'; END IF;
 DELETE FROM public.asset_history WHERE user_id=uid AND month=m;
 n:=public.ensure_current_month_asset_history(uid);
 IF n<>1 OR (SELECT total FROM public.asset_history WHERE user_id=uid AND month=m)<>300000 THEN RAISE EXCEPTION 'missing month not created correctly'; END IF;
 IF public.ensure_current_month_asset_history(uid)<>0 THEN RAISE EXCEPTION 'retry duplicated unchanged month'; END IF;
 SELECT id INTO original_id FROM public.asset_history WHERE user_id=uid AND month=m;
 BEGIN
   DELETE FROM public.asset_history WHERE user_id=uid AND month=m;
   PERFORM public.ensure_current_month_asset_history(uid);
   RAISE EXCEPTION 'forced failure' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF (SELECT id FROM public.asset_history WHERE user_id=uid AND month=m) IS DISTINCT FROM original_id THEN RAISE EXCEPTION 'failed transaction persisted partial snapshot'; END IF;
 UPDATE public.assets SET amount=400000 WHERE user_id=uid;
 IF (SELECT total FROM public.asset_history WHERE user_id=uid AND month=m)<>400000 THEN RAISE EXCEPTION 'asset change did not synchronize total'; END IF;
 DELETE FROM public.assets WHERE user_id=uid;
 IF (SELECT total FROM public.asset_history WHERE user_id=uid AND month=m)<>0 THEN RAISE EXCEPTION 'known empty assets not recorded'; END IF;
 DELETE FROM public.asset_history WHERE user_id=uid AND month=m;
 -- Without any asset or automatic history, there is no verified state to generate.
 IF public.ensure_current_month_asset_history(uid)<>0 THEN RAISE EXCEPTION 'unknown empty account converted to zero'; END IF;
 IF EXISTS(SELECT 1 FROM public.asset_history WHERE user_id=uid AND month<m) THEN RAISE EXCEPTION 'past month invented'; END IF;
END $$;
ROLLBACK;