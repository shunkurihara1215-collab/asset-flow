-- Run in a privileged isolated connection; all temporary test rows roll back.
BEGIN;
DO $$
DECLARE u uuid:=gen_random_uuid(); rid uuid; result jsonb; n integer;
BEGIN
 FOR n IN 1..10 LOOP
  rid:=gen_random_uuid();
  result:=public.reserve_ai_request(u,rid,'hash',10);
  IF result->>'status'<>'reserved' THEN RAISE EXCEPTION 'Premium reservation % failed',n; END IF;
  IF public.reserve_ai_request(u,rid,'hash',10)->>'status'<>'pending' THEN RAISE EXCEPTION 'Pending replay not recognized'; END IF;
  IF public.reserve_ai_request(u,gen_random_uuid(),'hash',10)->>'status'<>'busy' THEN RAISE EXCEPTION 'Concurrent request not blocked'; END IF;
  IF public.reserve_ai_request(u,rid,'other',10)->>'status'<>'conflict' THEN RAISE EXCEPTION 'ID accepted changed question'; END IF;
  IF NOT public.finish_ai_request(u,rid,'test','saved answer','') THEN RAISE EXCEPTION 'Answer not saved'; END IF;
  PERFORM public.finish_ai_request(u,rid,'test','saved answer','');
  IF public.reserve_ai_request(u,rid,'hash',10)->>'answer'<>'saved answer' THEN RAISE EXCEPTION 'Saved replay failed'; END IF;
 END LOOP;
 IF public.reserve_ai_request(u,gen_random_uuid(),'hash',10)->>'status'<>'limit' THEN RAISE EXCEPTION 'Premium 11th allowed'; END IF;
 IF (SELECT count(*) FROM public.ai_advice_history WHERE user_id=u)<>10 THEN RAISE EXCEPTION 'Duplicate history saved'; END IF;
 IF (SELECT count(*) FROM public.ai_usage_requests WHERE user_id=u)<>10 THEN RAISE EXCEPTION 'Duplicate quota counted'; END IF;
 UPDATE public.ai_usage_requests SET month='2026-01' WHERE user_id=u;
 rid:=gen_random_uuid();
 IF public.reserve_ai_request(u,rid,'hash',1)->>'status'<>'reserved' THEN RAISE EXCEPTION 'Free new month not reset'; END IF;
 IF (SELECT month FROM public.ai_usage_requests WHERE user_id=u AND request_id=rid)<>to_char(clock_timestamp() AT TIME ZONE 'Asia/Tokyo','YYYY-MM') THEN RAISE EXCEPTION 'Reservation month not JST'; END IF;
 UPDATE public.ai_usage_requests SET month='2026-01' WHERE user_id=u AND request_id=rid;
 IF public.reserve_ai_request(u,gen_random_uuid(),'hash',1)->>'status'<>'busy' THEN RAISE EXCEPTION 'Previous month pending ignored'; END IF;
 UPDATE public.ai_usage_requests SET month=to_char(clock_timestamp() AT TIME ZONE 'Asia/Tokyo','YYYY-MM') WHERE user_id=u AND request_id=rid;
 PERFORM public.finish_ai_request(u,rid,'test','','failure');
 IF public.reserve_ai_request(u,gen_random_uuid(),'hash',1)->>'status'<>'limit' THEN RAISE EXCEPTION 'Free second allowed after failed first'; END IF;
 IF (SELECT count(*) FROM public.ai_advice_history WHERE user_id=u)<>10 THEN RAISE EXCEPTION 'Failure saved history'; END IF;
 IF has_function_privilege('authenticated','public.reserve_ai_request(uuid,uuid,text,integer)','EXECUTE') THEN RAISE EXCEPTION 'User may forge quota'; END IF;
 IF has_table_privilege('authenticated','public.ai_usage_requests','INSERT') THEN RAISE EXCEPTION 'User may forge count'; END IF;
 IF NOT has_table_privilege('authenticated','public.ai_usage_requests','SELECT') THEN RAISE EXCEPTION 'Owner cannot read quota'; END IF;
END $$;
ROLLBACK;
