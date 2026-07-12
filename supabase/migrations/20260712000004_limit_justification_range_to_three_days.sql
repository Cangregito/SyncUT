-- A justification covers at most three calendar days, including both dates.
-- NOT VALID preserves historical records with longer ranges while enforcing
-- the rule for every new insert or update.
ALTER TABLE public.justifications
DROP CONSTRAINT IF EXISTS justifications_max_three_calendar_days;

ALTER TABLE public.justifications
ADD CONSTRAINT justifications_max_three_calendar_days
CHECK (end_date <= start_date + 2)
NOT VALID;
