CREATE OR REPLACE FUNCTION public.enforce_goal_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE premium boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('goals:' || NEW.user_id::text));
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = NEW.user_id
      AND s.plan = 'premium'
      AND coalesce(s.provider, '') <> 'demo'
      AND (
        (s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  ) INTO premium;
  IF NOT premium AND (SELECT count(*) FROM public.goals WHERE user_id = NEW.user_id) >= 1 THEN
    RAISE EXCEPTION '無料プランで登録できる目標は1件までです' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_goal_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS goals_free_limit ON public.goals;
CREATE TRIGGER goals_free_limit BEFORE INSERT ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.enforce_goal_limit();

CREATE OR REPLACE FUNCTION public.goals_user_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'user_id cannot change'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS goals_user_immutable ON public.goals;
CREATE TRIGGER goals_user_immutable BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.goals_user_immutable();