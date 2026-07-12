CREATE TABLE IF NOT EXISTS public.tutor_team_channel_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.tutor_teams(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment', 'assignment', 'reminder')),
  title text,
  body text NOT NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_channel_body_not_blank CHECK (NULLIF(BTRIM(body), '') IS NOT NULL),
  CONSTRAINT team_channel_title_required CHECK (kind = 'comment' OR NULLIF(BTRIM(title), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tutor_team_channel_items_team_created
  ON public.tutor_team_channel_items(team_id, created_at DESC);

ALTER TABLE public.tutor_team_channel_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_channel_select_related" ON public.tutor_team_channel_items
  FOR SELECT TO authenticated
  USING (
    public.is_active_tutor_team_member(team_id, (SELECT auth.uid()))
    OR public.is_tutor_team_owner(team_id, (SELECT auth.uid()))
    OR public.has_role(ARRAY['admin'])
  );

CREATE POLICY "team_channel_insert_related" ON public.tutor_team_channel_items
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND (
      (kind = 'comment' AND public.is_active_tutor_team_member(team_id, (SELECT auth.uid())))
      OR public.is_tutor_team_owner(team_id, (SELECT auth.uid()))
      OR public.has_role(ARRAY['admin'])
    )
  );

INSERT INTO public.notification_event_types (slug, label, description, channel) VALUES
  ('tutor_team.channel_post', 'Publicación en canal General', 'Nueva publicación en el equipo tutorial', 'both'),
  ('tutor_team.assignment', 'Nueva asignación tutorial', 'Asignación publicada por el tutor', 'both'),
  ('tutor_team.reminder', 'Recordatorio tutorial', 'Recordatorio enviado al equipo', 'both')
ON CONFLICT (slug) DO UPDATE SET channel = 'both';
