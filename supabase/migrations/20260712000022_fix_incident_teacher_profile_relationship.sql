ALTER TABLE public.incidents
  DROP CONSTRAINT IF EXISTS incidents_related_teacher_id_fkey;

ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_related_teacher_id_fkey
  FOREIGN KEY (related_teacher_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
