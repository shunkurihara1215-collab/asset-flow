REVOKE ALL ON public.ai_usage_requests FROM anon,authenticated;
GRANT SELECT ON public.ai_usage_requests TO authenticated;
GRANT ALL ON public.ai_usage_requests TO service_role;