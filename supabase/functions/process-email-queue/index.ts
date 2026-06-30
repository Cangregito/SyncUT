import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

type EmailQueueRow = {
  id: string;
  to_email: string;
  subject: string;
  template_slug: string;
  template_data: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderEmail(row: EmailQueueRow) {
  const title = htmlEscape(row.subject);
  const body = htmlEscape(row.template_data?.body ?? row.template_data?.message ?? "");
  const metadataRows = Object.entries(row.template_data ?? {})
    .filter(([key]) => !["body", "message"].includes(key))
    .map(([key, value]) => `<tr><td>${htmlEscape(key)}</td><td>${htmlEscape(value)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="es">
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
    <main style="max-width: 560px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 12px; text-transform: uppercase; color: #4f46e5; font-weight: 700;">SyncUT</p>
      <h1 style="font-size: 20px; margin: 8px 0 16px;">${title}</h1>
      ${body ? `<p>${body}</p>` : ""}
      ${
        metadataRows
          ? `<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 16px;">${metadataRows}</table>`
          : ""
      }
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">Evento: ${htmlEscape(row.template_slug)}</p>
    </main>
  </body>
</html>`;
}

function nextRetryDate(attempt: number) {
  const minutes = Math.min(60, Math.max(5, 5 * 2 ** Math.max(0, attempt - 1)));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom = Deno.env.get("EMAIL_FROM") ?? "SyncUT <notificaciones@syncut.edu.mx>";
  const batchSize = Number(Deno.env.get("EMAIL_BATCH_SIZE") ?? "10");
  const triggerToken = Deno.env.get("EMAIL_QUEUE_TRIGGER_TOKEN");

  if (!triggerToken) {
    return new Response(JSON.stringify({ error: "Missing EMAIL_QUEUE_TRIGGER_TOKEN" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (authorization !== `Bearer ${triggerToken}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase service configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from("email_queue")
    .select("id, to_email, subject, template_slug, template_data, attempts, max_attempts")
    .in("status", ["pending", "failed"])
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(Number.isFinite(batchSize) ? batchSize : 10);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const row of ((rows ?? []) as EmailQueueRow[]).filter((item) => item.attempts < item.max_attempts)) {
    const attempt = row.attempts + 1;

    await supabase
      .from("email_queue")
      .update({ status: "processing", attempts: attempt, last_error: null })
      .eq("id", row.id);

    if (!resendApiKey) {
      const message = "RESEND_API_KEY is not configured";
      await supabase
        .from("email_queue")
        .update({
          status: "failed",
          last_error: message,
          scheduled_at: attempt >= row.max_attempts ? new Date().toISOString() : nextRetryDate(attempt),
        })
        .eq("id", row.id);
      results.push({ id: row.id, status: "failed", error: message });
      continue;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [row.to_email],
          subject: row.subject,
          html: renderEmail(row),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = typeof payload?.message === "string" ? payload.message : response.statusText;
        await supabase
          .from("email_queue")
          .update({
            status: "failed",
            last_error: message,
            scheduled_at: attempt >= row.max_attempts ? new Date().toISOString() : nextRetryDate(attempt),
          })
          .eq("id", row.id);
        results.push({ id: row.id, status: "failed", error: message });
        continue;
      }

      await supabase
        .from("email_queue")
        .update({
          status: "sent",
          processed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", row.id);
      results.push({ id: row.id, status: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown email delivery error";
      await supabase
        .from("email_queue")
        .update({
          status: "failed",
          last_error: message,
          scheduled_at: attempt >= row.max_attempts ? new Date().toISOString() : nextRetryDate(attempt),
        })
        .eq("id", row.id);
      results.push({ id: row.id, status: "failed", error: message });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
