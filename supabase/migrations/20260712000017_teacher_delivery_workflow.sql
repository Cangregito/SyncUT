CREATE TABLE public.tutor_team_teachers (
  team_id uuid NOT NULL REFERENCES public.tutor_teams(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  linked_by uuid NOT NULL REFERENCES public.profiles(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (team_id, teacher_id)
);

CREATE TABLE public.justification_teacher_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  justification_id uuid NOT NULL REFERENCES public.justifications(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.tutor_teams(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  sent_by uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'received')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  UNIQUE (justification_id, teacher_id)
);

ALTER TABLE public.tutor_team_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justification_teacher_deliveries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.justification_audit_events DROP CONSTRAINT IF EXISTS justification_audit_events_event_type_check;
ALTER TABLE public.justification_audit_events ADD CONSTRAINT justification_audit_events_event_type_check
  CHECK (event_type IN ('submitted','file_added','status_changed','review_note','teacher_received'));

CREATE POLICY "team_teachers_related_select" ON public.tutor_team_teachers FOR SELECT TO authenticated USING (
  teacher_id = (SELECT auth.uid()) OR public.is_tutor_team_owner(team_id, (SELECT auth.uid())) OR public.has_role(ARRAY['admin'])
);
CREATE POLICY "deliveries_related_select" ON public.justification_teacher_deliveries FOR SELECT TO authenticated USING (
  teacher_id = (SELECT auth.uid()) OR sent_by = (SELECT auth.uid()) OR public.has_role(ARRAY['admin'])
  OR EXISTS (SELECT 1 FROM public.justifications j WHERE j.id = justification_id AND j.student_id = (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION public.link_teacher_to_tutor_team(p_team_id uuid, p_teacher_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (public.is_tutor_team_owner(p_team_id, auth.uid()) OR public.has_role(ARRAY['admin'])) THEN
    RAISE EXCEPTION 'No tienes permiso para vincular docentes a este equipo.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_teacher_id AND role = 'teacher') THEN
    RAISE EXCEPTION 'El usuario seleccionado no es docente.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.tutor_team_teachers(team_id, teacher_id, linked_by) VALUES (p_team_id, p_teacher_id, auth.uid())
  ON CONFLICT (team_id, teacher_id) DO UPDATE SET active = true, linked_by = auth.uid(), linked_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.deliver_approved_justification(p_team_id uuid, p_teacher_id uuid, p_justification_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE delivery_id uuid; justification_row public.justifications%ROWTYPE;
BEGIN
  IF NOT (public.is_tutor_team_owner(p_team_id, auth.uid()) OR public.has_role(ARRAY['admin'])) THEN RAISE EXCEPTION 'Equipo no autorizado.' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tutor_team_teachers WHERE team_id=p_team_id AND teacher_id=p_teacher_id AND active) THEN RAISE EXCEPTION 'El docente no está vinculado al equipo.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO justification_row FROM public.justifications WHERE id=p_justification_id AND status='approved';
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.tutor_team_members WHERE team_id=p_team_id AND student_id=justification_row.student_id AND status='active') THEN RAISE EXCEPTION 'El justificante no está aprobado o no pertenece a un alumno activo.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.justification_teacher_deliveries(justification_id,team_id,teacher_id,sent_by) VALUES(p_justification_id,p_team_id,p_teacher_id,auth.uid())
  ON CONFLICT (justification_id,teacher_id) DO UPDATE SET status='sent',sent_by=auth.uid(),sent_at=now(),received_at=NULL RETURNING id INTO delivery_id;
  PERFORM public.emit_notification(p_teacher_id,'justification.teacher_delivery','Justificante aprobado recibido para revisión','El tutor envió el justificante '||justification_row.folio||'. Confirma su recepción.',jsonb_build_object('delivery_id',delivery_id,'justification_id',p_justification_id),auth.uid());
  RETURN delivery_id;
END; $$;

CREATE OR REPLACE FUNCTION public.acknowledge_justification_delivery(p_delivery_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row_data public.justification_teacher_deliveries%ROWTYPE;
BEGIN
  SELECT * INTO row_data FROM public.justification_teacher_deliveries WHERE id=p_delivery_id FOR UPDATE;
  IF NOT FOUND OR row_data.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'Entrega no autorizada.' USING ERRCODE = '42501'; END IF;
  UPDATE public.justification_teacher_deliveries SET status='received',received_at=now() WHERE id=p_delivery_id;
  INSERT INTO public.justification_audit_events(justification_id,actor_id,event_type,note) VALUES(row_data.justification_id,auth.uid(),'teacher_received','El docente confirmó la recepción; flujo de entrega cerrado.');
  PERFORM public.emit_notification(row_data.sent_by,'justification.teacher_received','Justificante recibido por docente','El docente confirmó la recepción del justificante.',jsonb_build_object('delivery_id',p_delivery_id,'justification_id',row_data.justification_id),auth.uid());
END; $$;

INSERT INTO public.notification_event_types(slug,label,description,channel) VALUES
('justification.teacher_delivery','Justificante enviado a docente','Entrega de justificante aprobado por el tutor','both'),
('justification.teacher_received','Justificante recibido por docente','Confirmación que cierra la entrega','both') ON CONFLICT(slug) DO UPDATE SET channel='both';

DROP POLICY IF EXISTS "justifications_select_policy" ON public.justifications;
CREATE POLICY "justifications_select_policy" ON public.justifications FOR SELECT TO authenticated USING (
  student_id=auth.uid() OR public.has_role(ARRAY['admin'])
  OR EXISTS(SELECT 1 FROM public.tutorship_assignments a WHERE a.tutor_id=auth.uid() AND a.student_id=justifications.student_id AND a.status='active')
  OR EXISTS(SELECT 1 FROM public.justification_teacher_deliveries d WHERE d.justification_id=justifications.id AND d.teacher_id=auth.uid())
);

GRANT EXECUTE ON FUNCTION public.link_teacher_to_tutor_team(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_approved_justification(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_justification_delivery(uuid) TO authenticated;
