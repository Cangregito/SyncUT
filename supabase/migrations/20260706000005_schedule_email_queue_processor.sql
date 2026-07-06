-- Schedules the email queue processor through pg_cron + pg_net.
-- Required operational setup:
-- 1. Supabase Edge Function secret EMAIL_QUEUE_TRIGGER_TOKEN must exist.
-- 2. Vault secret `email_queue_trigger_token` must contain the same token.
-- The token is intentionally not stored in this migration.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule('process-email-queue-every-minute')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'process-email-queue-every-minute'
);

SELECT cron.schedule(
  'process-email-queue-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vvbzhrxfshillhkyunje.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'email_queue_trigger_token'
        ORDER BY created_at DESC
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
