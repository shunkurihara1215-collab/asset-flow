-- Requires a privileged isolated test database connection (not sandbox_exec).
-- Run with psql -X -v ON_ERROR_STOP=1 -f src/test/billing-database.test.sql.
-- All fixtures are transaction-local and rolled back; no existing account is targeted.
BEGIN;
DO $$
DECLARE
 uid uuid:=gen_random_uuid();
 retired_uid uuid:=gen_random_uuid();
 sid text:='sub_dbaudit_'||replace(gen_random_uuid()::text,'-','');
 result text;
 total_count integer;
BEGIN
 result:=public.apply_payment_event('sandbox','evt_dbaudit_new','customer.subscription.updated',2,sid,uid,'cus_dbaudit','premium_monthly','canceled',now(),now()+interval '1 day',false,now());
 IF result<>'processed' THEN RAISE EXCEPTION 'missing-row update was not saved'; END IF;
 result:=public.apply_payment_event('sandbox','evt_dbaudit_new','customer.subscription.updated',2,sid,uid,'cus_dbaudit','premium_monthly','active',now(),now()+interval '1 day',false,now());
 IF result<>'duplicate' THEN RAISE EXCEPTION 'duplicate event not skipped'; END IF;
 result:=public.apply_payment_event('sandbox','evt_dbaudit_old','customer.subscription.created',1,sid,uid,'cus_dbaudit','premium_monthly','active',now(),now()+interval '1 day',false,now()-interval '1 minute');
 IF (SELECT status FROM public.subscriptions WHERE stripe_subscription_id=sid)<>'canceled' THEN RAISE EXCEPTION 'older synchronization overwrote newer state'; END IF;
 PERFORM public.record_payment_failure('sandbox','evt_dbaudit_retry','customer.subscription.updated',3);
 result:=public.apply_payment_event('sandbox','evt_dbaudit_retry','customer.subscription.updated',3,sid,uid,'cus_dbaudit','premium_monthly','active',now(),now()+interval '1 day',false,now());
 IF result<>'processed' OR (SELECT status FROM public.payment_events WHERE environment='sandbox' AND event_id='evt_dbaudit_retry')<>'processed' THEN RAISE EXCEPTION 'failed event not retryable'; END IF;
 PERFORM public.create_goal_for_environment(uid,'live','one',1000,current_date+30,100,0);
 BEGIN
  PERFORM public.create_goal_for_environment(uid,'live','two',1000,current_date+30,100,0);
  RAISE EXCEPTION 'sandbox contract granted live multi-goal access' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN RAISE; WHEN OTHERS THEN
  IF SQLERRM<>'無料プランで登録できる目標は1件までです' THEN RAISE; END IF;
 END;
 PERFORM public.create_goal_for_environment(uid,'sandbox','two',1000,current_date+30,100,0);
 INSERT INTO public.subscriptions(user_id,environment,provider,plan,status,current_period_end,created_at) VALUES(uid,'sandbox','stripe','free','active',now()+interval '1 day',now()+interval '1 minute');
 BEGIN
  PERFORM public.create_goal_for_environment(uid,'sandbox','three',1000,current_date+30,100,0);
  RAISE EXCEPTION 'latest free row failed to revoke multi-goal access' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN RAISE; WHEN OTHERS THEN
  IF SQLERRM<>'無料プランで登録できる目標は1件までです' THEN RAISE; END IF;
 END;
 IF NOT public.claim_account_deletion(retired_uid) THEN RAISE EXCEPTION 'first deletion claim failed'; END IF;
 IF public.claim_account_deletion(retired_uid) THEN RAISE EXCEPTION 'concurrent deletion claim allowed'; END IF;
 result:=public.apply_payment_event('sandbox','evt_dbaudit_retired','customer.subscription.created',4,'sub_dbaudit_retired',retired_uid,'cus_dbaudit','premium_monthly','active',now(),now()+interval '1 day',false,now());
 SELECT count(*) INTO total_count FROM public.subscriptions WHERE user_id=retired_uid;
 IF result<>'ignored' OR total_count<>0 THEN RAISE EXCEPTION 'retired account resurrected'; END IF;
 IF has_table_privilege('authenticated','public.goals','INSERT') THEN RAISE EXCEPTION 'direct goal insertion bypass exists'; END IF;
 IF has_table_privilege('authenticated','public.payment_events','SELECT') OR has_table_privilege('anon','public.account_deletion_jobs','SELECT') THEN RAISE EXCEPTION 'private billing logs exposed'; END IF;
 RAISE NOTICE 'Billing database checks passed: missing row, duplicate, old state, retry, environment, latest plan, deletion lock, tombstone, grants';
END $$;
ROLLBACK;