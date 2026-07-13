ALTER TABLE public.tutor_team_teachers
  DROP CONSTRAINT IF EXISTS tutor_team_teachers_teacher_id_fkey;

ALTER TABLE public.tutor_team_teachers
  ADD CONSTRAINT tutor_team_teachers_teacher_id_fkey
  FOREIGN KEY (teacher_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;
