-- Preserve the first pending request and remove accidental repeated submissions.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY student_id, lower(btrim(title)), start_date, end_date
    ORDER BY created_at ASC, id ASC
  ) AS duplicate_number
  FROM public.justifications
  WHERE status IN ('pending', 'requires_more_info')
)
DELETE FROM public.justifications AS justification
USING ranked
WHERE justification.id = ranked.id AND ranked.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_justifications_no_duplicate_active_request
ON public.justifications(student_id, lower(btrim(title)), start_date, end_date)
WHERE status IN ('pending', 'requires_more_info');
