CREATE TABLE public.payment_events (environment text NOT NULL CHECK (environment IN ('sandbox','live')), event_id text NOT NULL, event_type text NOT NULL, subscription_id text, event_created bigint NOT NULL, status text NOT NULL CHECK (status IN ('processed','failed','ignored')), error_code text, attempts integer NOT NULL DEFAULT 1, processed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(environment,event_id));
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.account_deletion_jobs (user_id uuid PRIMARY KEY, status text NOT NULL CHECK(status IN ('running','failed','completed')), lease_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.account_deletion_jobs TO service_role;
ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ADD COLUMN last_synced_at timestamptz;
CREATE OR REPLACE FUNCTION public.claim_account_deletion(p_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('delete:'||p_user_id::text,0));
 IF EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=p_user_id AND status='running' AND lease_until>now()) THEN RETURN false; END IF;
 INSERT INTO account_deletion_jobs(user_id,status,lease_until) VALUES(p_user_id,'running',now()+interval '10 minutes') ON CONFLICT(user_id) DO UPDATE SET status='running',lease_until=EXCLUDED.lease_until,updated_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_account_deletion(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_account_deletion(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.apply_payment_event(p_environment text,p_event_id text,p_event_type text,p_event_created bigint,p_subscription_id text,p_user_id uuid,p_customer_id text,p_price_id text,p_status text,p_period_start timestamptz,p_period_end timestamptz,p_cancel boolean,p_fetched_at timestamptz) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE outcome text;
BEGIN
 IF p_environment NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid environment'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('subscription:'||p_environment||':'||p_subscription_id,0));
 IF EXISTS(SELECT 1 FROM payment_events WHERE environment=p_environment AND event_id=p_event_id AND status IN ('processed','ignored')) THEN RETURN 'duplicate'; END IF;
 IF EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=p_user_id) THEN outcome:='ignored';
 ELSE
  INSERT INTO subscriptions(user_id,stripe_subscription_id,stripe_customer_id,price_id,plan,status,provider,environment,current_period_start,current_period_end,cancel_at_period_end,last_synced_at,updated_at)
  VALUES(p_user_id,p_subscription_id,p_customer_id,p_price_id,CASE WHEN p_price_id='premium_monthly' THEN 'premium'::plan_tier ELSE 'free'::plan_tier END,p_status,'stripe',p_environment,p_period_start,p_period_end,p_cancel,p_fetched_at,now())
  ON CONFLICT(stripe_subscription_id) DO UPDATE SET price_id=EXCLUDED.price_id,plan=EXCLUDED.plan,status=EXCLUDED.status,current_period_start=EXCLUDED.current_period_start,current_period_end=EXCLUDED.current_period_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,last_synced_at=EXCLUDED.last_synced_at,updated_at=now()
  WHERE subscriptions.environment=p_environment AND subscriptions.user_id=p_user_id AND (subscriptions.last_synced_at IS NULL OR subscriptions.last_synced_at<=p_fetched_at);
  IF EXISTS(SELECT 1 FROM subscriptions WHERE stripe_subscription_id=p_subscription_id AND (environment<>p_environment OR user_id<>p_user_id)) THEN RAISE EXCEPTION 'Subscription identity mismatch'; END IF;
  outcome:='processed';
 END IF;
 INSERT INTO payment_events(environment,event_id,event_type,subscription_id,event_created,status) VALUES(p_environment,p_event_id,p_event_type,p_subscription_id,p_event_created,outcome)
 ON CONFLICT(environment,event_id) DO UPDATE SET status=EXCLUDED.status,error_code=NULL,attempts=payment_events.attempts+1,processed_at=now();
 RETURN outcome;
END $$;
REVOKE ALL ON FUNCTION public.apply_payment_event(text,text,text,bigint,text,uuid,text,text,text,timestamptz,timestamptz,boolean,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_event(text,text,text,bigint,text,uuid,text,text,text,timestamptz,timestamptz,boolean,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.record_payment_failure(p_environment text,p_event_id text,p_event_type text,p_event_created bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO payment_events(environment,event_id,event_type,event_created,status,error_code) VALUES(p_environment,p_event_id,p_event_type,p_event_created,'failed','reconciliation_failed')
 ON CONFLICT(environment,event_id) DO UPDATE SET attempts=payment_events.attempts+1,error_code='reconciliation_failed',processed_at=now() WHERE payment_events.status='failed';
END $$;
REVOKE ALL ON FUNCTION public.record_payment_failure(text,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_failure(text,text,text,bigint) TO service_role;
CREATE OR REPLACE FUNCTION public.enforce_goal_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE premium boolean; env text:=coalesce(nullif(current_setting('app.payment_environment',true),''),'live');
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('goals:'||NEW.user_id::text,0));
 SELECT coalesce((SELECT s.plan='premium' AND coalesce(s.provider,'')<>'demo' AND ((s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end>now())) OR (s.status='canceled' AND s.current_period_end>now())) FROM subscriptions s WHERE s.user_id=NEW.user_id AND s.environment=env ORDER BY s.created_at DESC,s.id DESC LIMIT 1),false) INTO premium;
 IF NOT premium AND (SELECT count(*) FROM goals WHERE user_id=NEW.user_id)>=1 THEN RAISE EXCEPTION '無料プランで登録できる目標は1件までです'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_goal_limit() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_goal_limit() TO service_role;
REVOKE INSERT ON public.goals FROM authenticated,anon;
CREATE OR REPLACE FUNCTION public.create_goal_for_environment(p_user_id uuid,p_environment text,p_name text,p_target bigint,p_deadline date,p_monthly bigint,p_rate numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE goal_id uuid;
BEGIN
 IF p_environment NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid environment'; END IF;
 IF EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'Account deletion pending'; END IF;
 PERFORM set_config('app.payment_environment',p_environment,true);
 INSERT INTO goals(user_id,name,target_amount,deadline,monthly_contribution,expected_return) VALUES(p_user_id,p_name,p_target,p_deadline,p_monthly,p_rate) RETURNING id INTO goal_id;
 RETURN goal_id;
END $$;
REVOKE ALL ON FUNCTION public.create_goal_for_environment(uuid,text,text,bigint,date,bigint,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_goal_for_environment(uuid,text,text,bigint,date,bigint,numeric) TO service_role;