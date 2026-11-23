CREATE OR REPLACE FUNCTION public.guard_retiring_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('delete:'||NEW.user_id::text,0));
 IF EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.user_id) THEN
  IF TG_TABLE_NAME='subscriptions' THEN RETURN NULL; END IF;
  RAISE EXCEPTION 'Account deletion pending';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_retiring_account() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_retiring_account() TO service_role;
CREATE TRIGGER subscriptions_retirement_guard BEFORE INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.guard_retiring_account();
CREATE TRIGGER goals_retirement_guard BEFORE INSERT ON public.goals FOR EACH ROW EXECUTE FUNCTION public.guard_retiring_account();