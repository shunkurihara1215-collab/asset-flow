REVOKE ALL ON public.payment_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.account_deletion_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_events TO service_role;
GRANT ALL ON public.account_deletion_jobs TO service_role;