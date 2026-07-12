CREATE TABLE IF NOT EXISTS public.tutor_team_item_progress (
  item_id uuid NOT NULL REFERENCES public.tutor_team_channel_items(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed')),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, student_id)
);

ALTER TABLE public.tutor_team_item_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_progress_select_related" ON public.tutor_team_item_progress
  FOR SELECT TO authenticated USING (
    student_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tutor_team_channel_items item
      WHERE item.id = item_id
        AND (public.is_tutor_team_owner(item.team_id, (SELECT auth.uid())) OR public.has_role(ARRAY['admin']))
    )
  );

CREATE POLICY "team_progress_insert_own" ON public.tutor_team_item_progress
  FOR INSERT TO authenticated WITH CHECK (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tutor_team_channel_items item
      WHERE item.id = item_id AND item.kind = 'assignment'
        AND public.is_active_tutor_team_member(item.team_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "team_progress_delete_own" ON public.tutor_team_item_progress
  FOR DELETE TO authenticated USING (student_id = (SELECT auth.uid()));
