ALTER TABLE public.justifications
  ADD COLUMN IF NOT EXISTS folio text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz NOT NULL DEFAULT now();

UPDATE public.justifications
SET
  submitted_at = COALESCE(created_at, now()),
  due_date = COALESCE(due_date, (COALESCE(created_at, now())::date + 3)),
  folio = COALESCE(
    folio,
    'JUS-' || to_char(COALESCE(created_at, now()), 'YYYYMMDD') || '-' || upper(substr(id::text, 1, 8))
  )
WHERE folio IS NULL OR due_date IS NULL;

ALTER TABLE public.justifications
  ALTER COLUMN folio SET NOT NULL,
  ALTER COLUMN due_date SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS justifications_folio_key
  ON public.justifications(folio);

CREATE INDEX IF NOT EXISTS idx_justifications_due_status
  ON public.justifications(due_date, status);

CREATE OR REPLACE FUNCTION public.set_justification_tracking_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.submitted_at IS NULL THEN
    NEW.submitted_at := now();
  END IF;

  IF NEW.due_date IS NULL THEN
    NEW.due_date := NEW.submitted_at::date + 3;
  END IF;

  IF NEW.folio IS NULL OR NEW.folio = '' THEN
    NEW.folio := 'JUS-' || to_char(NEW.submitted_at, 'YYYYMMDD') || '-' || upper(substr(NEW.id::text, 1, 8));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_justification_tracking_fields ON public.justifications;
CREATE TRIGGER trg_set_justification_tracking_fields
  BEFORE INSERT ON public.justifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_justification_tracking_fields();
