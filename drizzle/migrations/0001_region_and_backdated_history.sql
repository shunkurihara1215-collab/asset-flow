ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.asset_history ADD COLUMN IF NOT EXISTS recorded_on date;
ALTER TABLE public.asset_history ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'auto';