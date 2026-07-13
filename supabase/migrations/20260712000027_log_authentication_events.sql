CREATE OR REPLACE FUNCTION public.log_auth_event(p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE='42501'; END IF;
  IF p_action NOT IN ('AUTH_LOGIN','AUTH_LOGOUT') THEN RAISE EXCEPTION 'Evento no permitido.' USING ERRCODE='22023'; END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,result,reason,severity,request_id,new_values)
  VALUES(auth.uid(),p_action,'auth.sessions',auth.uid(),'success',CASE WHEN p_action='AUTH_LOGIN' THEN 'Inicio de sesión exitoso' ELSE 'Cierre de sesión solicitado' END,'info',gen_random_uuid(),jsonb_build_object('authenticated_at',now()));
END;
$$;
REVOKE ALL ON FUNCTION public.log_auth_event(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_auth_event(text) TO authenticated;
