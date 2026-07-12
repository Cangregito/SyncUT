CREATE OR REPLACE FUNCTION public.resolve_justification(
  p_justification_id uuid,
  p_status public.justification_status,
  p_review_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.justifications%ROWTYPE;
  actor_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO current_row FROM public.justifications WHERE id = p_justification_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Justificacion no encontrada.' USING ERRCODE = 'P0002'; END IF;
  SELECT p.role::text INTO actor_role FROM public.profiles p WHERE p.id = auth.uid();

  IF actor_role = 'admin' THEN NULL;
  ELSIF actor_role = 'tutor' AND EXISTS (
    SELECT 1 FROM public.tutorship_assignments a
    WHERE a.tutor_id = auth.uid() AND a.student_id = current_row.student_id AND a.status = 'active'
  ) THEN NULL;
  ELSE RAISE EXCEPTION 'Solo el tutor asignado o administracion puede resolver esta justificacion.' USING ERRCODE = '42501';
  END IF;

  IF current_row.status NOT IN ('pending', 'requires_more_info') THEN
    RAISE EXCEPTION 'La justificacion ya tiene una resolucion final: %.', current_row.status USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'requires_more_info') THEN
    RAISE EXCEPTION 'Transicion de estado no valida.' USING ERRCODE = '22023';
  END IF;
  IF current_row.status = 'requires_more_info' AND p_status = 'requires_more_info' THEN
    RAISE EXCEPTION 'La justificacion ya espera informacion adicional.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.justifications SET status = p_status, reviewer_id = auth.uid(),
    review_notes = NULLIF(BTRIM(p_review_notes), ''), updated_at = now()
  WHERE id = p_justification_id;

  INSERT INTO public.justification_audit_events
    (justification_id, actor_id, event_type, from_status, to_status, note)
  VALUES (p_justification_id, auth.uid(), 'status_changed', current_row.status, p_status,
    COALESCE(NULLIF(BTRIM(p_review_notes), ''), 'Cambio de estado a ' || p_status::text || '.'));
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_justification(uuid, public.justification_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_justification(uuid, public.justification_status, text) TO authenticated;
