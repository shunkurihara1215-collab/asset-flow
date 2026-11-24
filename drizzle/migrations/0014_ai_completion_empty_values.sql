CREATE OR REPLACE FUNCTION public.finish_ai_request(p_user_id uuid,p_request_id uuid,p_question text,p_answer text,p_error text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ai_usage_requests%ROWTYPE;
BEGIN
 p_question:=nullif(p_question,''); p_answer:=nullif(p_answer,''); p_error:=nullif(p_error,'');
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