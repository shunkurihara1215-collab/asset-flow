CREATE TABLE public.ai_usage_requests (
 user_id uuid NOT NULL,
 request_id uuid NOT NULL,
 month text NOT NULL,
 request_hash text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
 answer text,
 error_message text,
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 PRIMARY KEY (user_id,request_id)
);
GRANT SELECT ON public.ai_usage_requests TO authenticated;
GRANT ALL ON public.ai_usage_requests TO service_role;
ALTER TABLE public.ai_usage_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_owner_read ON public.ai_usage_requests FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE INDEX ai_usage_month ON public.ai_usage_requests(user_id,month);
CREATE UNIQUE INDEX ai_usage_one_pending ON public.ai_usage_requests(user_id) WHERE status='pending';
COMMENT ON TABLE public.ai_usage_requests IS 'API-start reservations count toward JST monthly quota including failed or uncertain calls; no automatic expiry or historical backfill.';

CREATE FUNCTION public.reserve_ai_request(p_user_id uuid,p_request_id uuid,p_request_hash text,p_limit integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ai_usage_requests%ROWTYPE; m text:=to_char(clock_timestamp() AT TIME ZONE 'Asia/Tokyo','YYYY-MM'); n integer;
BEGIN
 IF p_limit NOT IN (1,10) OR p_limit IS NULL THEN RAISE EXCEPTION 'Invalid AI quota'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ai:'||p_user_id::text,0));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE user_id=p_user_id) THEN RETURN jsonb_build_object('status','retired'); END IF;
 SELECT * INTO r FROM public.ai_usage_requests WHERE user_id=p_user_id AND request_id=p_request_id;
 IF FOUND THEN
  IF r.request_hash<>p_request_hash THEN RETURN jsonb_build_object('status','conflict'); END IF;
  RETURN jsonb_build_object('status',r.status,'answer',r.answer,'error',r.error_message);
 END IF;
 IF EXISTS(SELECT 1 FROM public.ai_usage_requests WHERE user_id=p_user_id AND status='pending') THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT count(*) INTO n FROM public.ai_usage_requests WHERE user_id=p_user_id AND month=m;
 IF n>=p_limit THEN RETURN jsonb_build_object('status','limit'); END IF;
 INSERT INTO public.ai_usage_requests(user_id,request_id,month,request_hash) VALUES(p_user_id,p_request_id,m,p_request_hash);
 RETURN jsonb_build_object('status','reserved');
END $$;
REVOKE ALL ON FUNCTION public.reserve_ai_request(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_request(uuid,uuid,text,integer) TO service_role;

CREATE FUNCTION public.finish_ai_request(p_user_id uuid,p_request_id uuid,p_question text,p_answer text,p_error text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ai_usage_requests%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('ai:'||p_user_id::text,0));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE user_id=p_user_id) THEN RETURN false; END IF;
 SELECT * INTO r FROM public.ai_usage_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF r.status<>'pending' THEN RETURN r.status='completed'; END IF;
 IF p_answer IS NOT NULL AND length(p_answer)>0 AND p_error IS NULL THEN
  INSERT INTO public.ai_advice_history(user_id,question,answer) VALUES(p_user_id,p_question,p_answer);
  UPDATE public.ai_usage_requests SET status='completed',answer=p_answer,finished_at=now() WHERE user_id=p_user_id AND request_id=p_request_id;
 ELSIF p_error IS NOT NULL AND length(p_error)>0 AND p_answer IS NULL THEN
  UPDATE public.ai_usage_requests SET status='failed',error_message=p_error,finished_at=now() WHERE user_id=p_user_id AND request_id=p_request_id;
 ELSE RAISE EXCEPTION 'Invalid AI completion'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.finish_ai_request(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_ai_request(uuid,uuid,text,text,text) TO service_role;