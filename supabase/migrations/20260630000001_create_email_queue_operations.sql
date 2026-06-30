CREATE OR REPLACE FUNCTION public.get_email_queue_summary()
RETURNS TABLE (
  status public.email_status,
  total bigint,
  oldest_scheduled_at timestamptz,
  last_error text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
BEGIN
  SELECT role INTO requester_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF requester_role NOT IN ('admin', 'coordinator') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    q.status,
    count(*)::bigint AS total,
    min(q.scheduled_at) AS oldest_scheduled_at,
    (
      SELECT q2.last_error
      FROM public.email_queue q2
      WHERE q2.status = q.status
        AND q2.last_error IS NOT NULL
      ORDER BY q2.created_at DESC
      LIMIT 1
    ) AS last_error
  FROM public.email_queue q
  GROUP BY q.status
  ORDER BY q.status::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_queue_summary() TO authenticated;
