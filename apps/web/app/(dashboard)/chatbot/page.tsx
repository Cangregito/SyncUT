import { FaqBrowser } from "@/components/chatbot/faq-browser";
import { SubmitButton } from "@/components/forms/submit-button";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Tables } from "@plataforma/types";

import { hasPermission } from "@/lib/auth/roles";
import { DonutChart } from "@/components/charts/donut-chart";
import { StackedBar } from "@/components/charts/stacked-bar";
import { requireProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateAiAnswer } from "@/lib/chatbot/ai";

type ConversationRow = Tables<"chatbot_conversations">;
type MessageRow = Tables<"chatbot_messages">;
type FaqRow = Tables<"chatbot_faq_entries">;
type HandoffRow = Tables<"chatbot_handoffs">;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findFaqMatch(message: string, faqs: FaqRow[]) {
  const text = normalize(message);
  return [...faqs]
    .sort((a, b) => a.priority - b.priority)
    .find((faq) => {
      const keywords = faq.keywords ?? [];
      return (
        normalize(faq.question).includes(text) ||
        text.includes(normalize(faq.question)) ||
        keywords.some((keyword) => text.includes(normalize(keyword)))
      );
    });
}

async function startConversation() {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { data: conversation } = await supabase
    .from("chatbot_conversations")
    .insert({
      channel: "web",
      external_user_ref: profile.id,
      user_display_name: profile.fullName,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (conversation) {
    await supabase.from("chatbot_messages").insert({
      conversation_id: conversation.id,
      sender_type: "system",
      sender_ref: "syncut",
      content: "¡Hola! Soy Lumi, el asistente virtual de SyncUT. Puedo orientarte sobre tutorías, citas, justificaciones e incidencias. ¿En qué te ayudo?",
    });
  }

  revalidatePath("/chatbot");
}

async function sendMessage(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const conversationId = String(formData.get("conversation_id") ?? "");
  const content = String(formData.get("content") ?? "").trim();

  if (!conversationId || !content) {
    return;
  }

  const { data: userMessage } = await supabase
    .from("chatbot_messages")
    .insert({
      conversation_id: conversationId,
      sender_type: "user",
      sender_ref: profile.id,
      content,
    })
    .select("id")
    .single();

  const { data: faqs } = await supabase
    .from("chatbot_faq_entries")
    .select("id, category, question, answer, keywords, priority, status, source, requires_handoff, version, created_at, updated_at")
    .eq("status", "published");

  const { data: history } = await supabase
    .from("chatbot_messages")
    .select("sender_type, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(8);

  const match = findFaqMatch(content, (faqs ?? []) as FaqRow[]);
  const now = new Date().toISOString();

  const aiAnswer = await generateAiAnswer({
    question: content,
    history: [...(history ?? [])].reverse().slice(0, -1),
    knowledge: (faqs ?? []) as FaqRow[],
    userName: profile.fullName,
  });

  if (aiAnswer) {
    await supabase.from("chatbot_messages").insert({
      conversation_id: conversationId,
      sender_type: "bot",
      sender_ref: aiAnswer.model,
      content: aiAnswer.content,
      intent_detected: match?.category ?? "ai_conversation",
      faq_entry_id: match?.id ?? null,
      confidence_score: match ? 0.9 : 0.72,
      payload: { provider: "groq", model: aiAnswer.model },
    });

    // La rama de IA no aplicaba el mismo tratamiento de `requires_handoff` que
    // el fallback: si la IA respondia, un caso marcado para atencion humana
    // nunca se escalaba.
    if (match?.requires_handoff) {
      await supabase.from("chatbot_handoffs").insert({
        conversation_id: conversationId,
        trigger_message_id: userMessage?.id ?? null,
        reason: "policy_case",
        priority: "medium",
        notes: `FAQ requiere atencion humana: ${match.question}`,
      });

      await supabase.rpc("emit_notification", {
        p_user_id: profile.id,
        p_event_type: "chatbot.handoff_created",
        p_title: "Consulta escalada",
        p_body: "Tu consulta fue escalada para atención humana.",
        p_metadata: { conversation_id: conversationId, reason: "policy_case" },
        p_triggered_by: profile.id,
      });
    }

    await supabase.from("chatbot_conversations").update({
      current_topic: match?.category ?? "orientacion_general",
      resolution_type: match?.requires_handoff ? "human" : match ? "faq" : null,
      status: match?.requires_handoff ? "escalated" : undefined,
      confidence_score: match ? 0.9 : 0.72,
      last_message_at: now,
      updated_at: now,
    }).eq("id", conversationId);
  } else if (match) {
    await supabase.from("chatbot_messages").insert({
      conversation_id: conversationId,
      sender_type: "bot",
      sender_ref: "faq",
      content: match.answer,
      intent_detected: match.category,
      faq_entry_id: match.id,
      confidence_score: 0.85,
      is_escalation_trigger: match.requires_handoff,
    });

    if (match.requires_handoff) {
      await supabase.from("chatbot_handoffs").insert({
        conversation_id: conversationId,
        trigger_message_id: userMessage?.id ?? null,
        reason: "policy_case",
        priority: "medium",
        notes: `FAQ requiere atencion humana: ${match.question}`,
      });
      await supabase.rpc("emit_notification", {
        p_user_id: profile.id,
        p_event_type: "chatbot.handoff_created",
        p_title: "Consulta escalada",
        p_body: "Tu consulta fue escalada para atención humana.",
        p_metadata: {
          conversation_id: conversationId,
          reason: "policy_case",
        },
        p_triggered_by: profile.id,
      });
    }

    await supabase
      .from("chatbot_conversations")
      .update({
        current_topic: match.category,
        resolution_type: match.requires_handoff ? "human" : "faq",
        confidence_score: 0.85,
        last_message_at: now,
        updated_at: now,
      })
      .eq("id", conversationId);
  } else {
    await supabase.from("chatbot_messages").insert({
      conversation_id: conversationId,
      sender_type: "system",
      sender_ref: "syncut",
      content: "No existe una respuesta publicada para esta consulta. Se registro escalamiento para atencion humana.",
      is_escalation_trigger: true,
    });

    await supabase.from("chatbot_handoffs").insert({
      conversation_id: conversationId,
      trigger_message_id: userMessage?.id ?? null,
      reason: "no_match",
      priority: "medium",
      notes: content,
    });
    await supabase.rpc("emit_notification", {
      p_user_id: profile.id,
      p_event_type: "chatbot.handoff_created",
      p_title: "Consulta escalada",
      p_body: "No hubo una respuesta publicada para tu consulta, así que se registró escalamiento.",
      p_metadata: {
        conversation_id: conversationId,
        reason: "no_match",
      },
      p_triggered_by: profile.id,
    });

    await supabase
      .from("chatbot_conversations")
      .update({
        status: "escalated",
        resolution_type: "human",
        last_message_at: now,
        updated_at: now,
      })
      .eq("id", conversationId);
  }

  revalidatePath("/chatbot");
}

async function closeConversation(formData: FormData) {
  "use server";

  await requireProfile();
  const supabase = await createSupabaseServerClient();
  const conversationId = String(formData.get("conversation_id") ?? "");
  const rating = Number(formData.get("rating") ?? 0);
  const resolved = String(formData.get("resolved") ?? "") === "true";
  const comment = String(formData.get("comment") ?? "").trim();

  if (!conversationId || rating < 1 || rating > 5) {
    return;
  }

  await supabase.from("chatbot_feedback").insert({
    conversation_id: conversationId,
    rating,
    resolved,
    comment: comment || null,
    submitted_by_ref: "web",
  });

  await supabase
    .from("chatbot_conversations")
    .update({
      status: "closed",
      ended_at: new Date().toISOString(),
      resolution_type: resolved ? "faq" : "unresolved",
    })
    .eq("id", conversationId);

  revalidatePath("/chatbot");
}

async function createFaqEntry(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  if (!["admin", "tutor"].includes(profile.role)) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const category = String(formData.get("category") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!category || !question || !answer) {
    return;
  }

  await supabase.from("chatbot_faq_entries").insert({
    category,
    question,
    answer,
    keywords,
    status: "published",
    source: "Captura administrativa SyncUT",
  });

  revalidatePath("/chatbot");
}

const handoffReasonLabels: Record<string, string> = {
  low_confidence: "Respuesta poco confiable",
  user_request: "El usuario pidió atención humana",
  policy_case: "Caso que requiere revisión",
  no_match: "Sin respuesta publicada",
};

async function resolveHandoff(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  if (!hasPermission(profile.role, "chatbot:manage")) {
    redirect("/chatbot?error=No tienes permiso para atender escalaciones.");
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    redirect("/chatbot?error=Escalacion no valida.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("chatbot_handoffs")
    .update({
      status: "resolved",
      assigned_agent_ref: profile.id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("resolveHandoff", error);
    redirect("/chatbot?error=No pudimos cerrar la escalacion.");
  }

  revalidatePath("/chatbot");
  redirect("/chatbot?exito=Escalacion marcada como atendida.");
}

export default async function ChatbotPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; exito?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  if (profile.role === "teacher") redirect("/docente");
  const supabase = await createSupabaseServerClient();
  const canManageFaq = ["admin", "tutor"].includes(profile.role);
  const canAttendHandoffs = hasPermission(profile.role, "chatbot:manage");

  // A6 - las escalaciones se escribian y nadie las leia: la consulta anterior
  // filtraba por la conversacion propia, asi que no existia ninguna bandeja.
  const { data: pendingHandoffsData } = canAttendHandoffs
    ? await supabase
        .from("chatbot_handoffs")
        .select("id, conversation_id, reason, priority, notes, requested_at, status")
        .eq("status", "pending")
        .order("requested_at", { ascending: true })
        .limit(25)
    : { data: [] };

  const pendingHandoffs = (pendingHandoffsData ?? []) as HandoffRow[];

  // Lumi en numeros: solo para quien atiende escalaciones (la politica de
  // staff ve todas las conversaciones; un alumno solo veria las suyas).
  const thirtyDaysAgo = new Date(new Date().toISOString().slice(0, 10)).getTime() - 30 * 86_400_000;
  const [{ data: statRows }, { data: handoffStatRows }] = canAttendHandoffs
    ? await Promise.all([
        supabase
          .from("chatbot_conversations")
          .select("status, resolution_type, confidence_score, message_count, started_at")
          .gte("started_at", new Date(thirtyDaysAgo).toISOString())
          .limit(500),
        supabase
          .from("chatbot_handoffs")
          .select("reason, status, requested_at")
          .gte("requested_at", new Date(thirtyDaysAgo).toISOString())
          .limit(500),
      ])
    : [{ data: [] }, { data: [] }];
  const conversationStats = (statRows ?? []) as Array<{ status: string; resolution_type: string | null; confidence_score: number | null; message_count: number; started_at: string }>;
  const handoffStats = (handoffStatRows ?? []) as Array<{ reason: string; status: string; requested_at: string }>;
  const resolutionSlices = [
    { label: "Resueltas con FAQ", value: conversationStats.filter((row) => row.resolution_type === "faq").length, color: "var(--tertiary)" },
    { label: "Resueltas por IA", value: conversationStats.filter((row) => row.resolution_type === "ai").length, color: "var(--primary)" },
    { label: "Atendidas por tutor", value: conversationStats.filter((row) => row.resolution_type === "human").length, color: "var(--chart-sky)" },
    { label: "Sin resolver", value: conversationStats.filter((row) => row.resolution_type === "unresolved").length, color: "var(--error)" },
    { label: "En curso", value: conversationStats.filter((row) => !row.resolution_type).length, color: "var(--chart-amber)" },
  ];
  const scored = conversationStats.filter((row) => typeof row.confidence_score === "number");
  const averageConfidence = scored.length ? scored.reduce((sum, row) => sum + (row.confidence_score as number), 0) / scored.length : null;
  const confidenceSegments = [
    { label: "Alta (≥ 0.7)", value: scored.filter((row) => (row.confidence_score as number) >= 0.7).length, color: "var(--tertiary)" },
    { label: "Media (0.4 a 0.7)", value: scored.filter((row) => (row.confidence_score as number) >= 0.4 && (row.confidence_score as number) < 0.7).length, color: "var(--chart-amber)" },
    { label: "Baja (< 0.4)", value: scored.filter((row) => (row.confidence_score as number) < 0.4).length, color: "var(--error)" },
  ];
  const averageMessages = conversationStats.length ? conversationStats.reduce((sum, row) => sum + row.message_count, 0) / conversationStats.length : 0;
  const handoffReasons = [...new Set(handoffStats.map((row) => row.reason))]
    .map((reason) => ({ reason, label: handoffReasonLabels[reason] ?? reason, value: handoffStats.filter((row) => row.reason === reason).length }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const handoffMax = Math.max(1, ...handoffReasons.map((item) => item.value));
  const attendedHandoffs = handoffStats.filter((row) => row.status !== "pending").length;

  const { data: conversationData } = await supabase
    .from("chatbot_conversations")
    .select("id, channel, status, started_at, ended_at, language, external_user_ref, user_display_name, current_topic, resolution_type, confidence_score, message_count, last_message_at, metadata, created_at, updated_at")
    .eq("external_user_ref", profile.id)
    .in("status", ["active", "escalated"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const conversation = conversationData as ConversationRow | null;
  const [{ data: messagesData }, { data: handoffsData }, { data: faqData }] = await Promise.all([
    conversation
      ? supabase
          .from("chatbot_messages")
          .select("id, conversation_id, sender_type, sender_ref, message_type, content, intent_detected, faq_entry_id, confidence_score, is_escalation_trigger, payload, created_at")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    conversation
      ? supabase
          .from("chatbot_handoffs")
          .select("id, conversation_id, trigger_message_id, reason, status, priority, assigned_agent_ref, notes, requested_at, resolved_at, created_at, updated_at")
          .eq("conversation_id", conversation.id)
          .order("requested_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("chatbot_faq_entries")
      .select("id, category, question, answer, keywords, priority, status, source, requires_handoff, version, created_at, updated_at")
      .eq("status", "published")
      .order("priority", { ascending: true }),
  ]);

  const messages = (messagesData ?? []) as MessageRow[];
  const handoffs = (handoffsData ?? []) as HandoffRow[];
  const faqs = (faqData ?? []) as FaqRow[];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-container text-xl text-on-primary-container">✦</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Lumi · Asistente con IA</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-headline font-bold text-on-surface">
          Asistente de Tutorías
        </h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">
          Pregunta con tus propias palabras. Lumi usa IA y conocimiento oficial de SyncUT; puede equivocarse, así que las decisiones académicas siempre las confirma tu tutor.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container shadow-sm">
          <div className="border-b border-outline-variant bg-gradient-to-r from-primary-container/70 to-tertiary-container/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">Tu conversación con Lumi</h2>
            {conversation ? (
              <span className="rounded bg-surface-container-highest px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                {conversation.status === "escalated" ? "Atención solicitada" : conversation.status === "closed" ? "Finalizada" : "En curso"}
              </span>
            ) : null}
          </div>
          </div>

          <div className="p-5">

          {!conversation ? (
            <form action={startConversation} className="mt-4">
              <p className="rounded border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
                Inicia una conversación para recibir orientación personalizada.
              </p>
              <SubmitButton pendingLabel="Iniciando…" className="mt-4 rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container">
                Iniciar conversación
              </SubmitButton>
            </form>
          ) : (
            <>
              <div role="region" aria-label="Historial de la conversación" tabIndex={0} className="mt-4 flex max-h-[560px] flex-col gap-4 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                      message.sender_type === "user"
                        ? "ml-auto rounded-br-sm bg-primary text-on-primary"
                        : "mr-auto rounded-bl-sm border border-outline-variant bg-surface text-on-surface shadow-sm"
                    }`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{message.sender_type === "user" ? "Tú" : message.sender_type === "system" ? "SyncUT" : "Lumi · IA"}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  </div>
                ))}
              </div>

              {conversation.status !== "closed" ? (
                <form action={sendMessage} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="conversation_id" value={conversation.id} />
                  <input
                    name="content"
                    aria-label="Tu pregunta para Lumi"
                    required
                    placeholder="Pregúntale algo a Lumi…"
                    maxLength={1200}
                    className="min-w-0 flex-1 rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface shadow-inner"
                  />
                  <SubmitButton pendingLabel="Lumi está respondiendo…" className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary">
                    Enviar pregunta
                  </SubmitButton>
                </form>
              ) : null}

              <form action={closeConversation} className="mt-4 rounded border border-outline-variant bg-surface p-3">
                <input type="hidden" name="conversation_id" value={conversation.id} />
                <p className="text-xs font-semibold uppercase text-on-surface-variant">Cerrar y evaluar</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr]">
                  <select aria-label="Calificación de la respuesta" name="rating" className="rounded border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface" defaultValue="5">
                    <option value="5">5 · Muy útil</option>
                    <option value="4">4 · Útil</option>
                    <option value="3">3 · Regular</option>
                    <option value="2">2 · Poco útil</option>
                    <option value="1">1 · No me ayudó</option>
                  </select>
                  <input aria-label="Comentario sobre la respuesta (opcional)" name="comment" placeholder="Comentario opcional" className="rounded border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button name="resolved" value="true" className="rounded border border-primary px-3 py-2 text-xs font-semibold text-primary">
                    Resuelto
                  </button>
                  <button name="resolved" value="false" className="rounded border border-error px-3 py-2 text-xs font-semibold text-error">
                    No resuelto
                  </button>
                </div>
              </form>
            </>
          )}
          </div>
        </section>

        <aside className="space-y-6">
          <FaqBrowser faqs={faqs.map(({ id, category, question, answer }) => ({ id, category, question, answer }))} />

          {handoffs.length > 0 ? (
            <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
              <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Escalamientos</h2>
              <div className="mt-4 space-y-3">
                {handoffs.map((handoff) => (
                  <div key={handoff.id} className="rounded border border-outline-variant bg-surface p-3">
                    <p className="text-sm font-semibold text-on-surface">{handoff.reason}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {handoff.status} | {handoff.priority}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {params.error ? (
            <p role="alert" className="rounded-lg border border-error/40 bg-error-container/20 p-4 text-sm font-semibold text-on-error-container">{params.error}</p>
          ) : null}
          {params.exito ? (
            <p role="status" className="rounded-lg border border-tertiary/40 bg-tertiary-container/30 p-4 text-sm font-semibold text-on-tertiary-container">{params.exito}</p>
          ) : null}

          {canAttendHandoffs ? (
            <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Lumi en números · 30 días</p>
              <h2 className="text-sm font-bold text-on-surface">Cómo se resuelven las consultas</h2>
              <div className="mt-4">
                <DonutChart slices={resolutionSlices} centerLabel="conversaciones" size={120} emptyLabel="Sin conversaciones en los últimos 30 días." />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded border border-outline-variant bg-surface p-3">
                  <p className="text-[10px] font-semibold uppercase text-on-surface-variant">Confianza media</p>
                  <p className="mt-1 text-2xl font-black text-on-surface">{averageConfidence === null ? "—" : averageConfidence.toFixed(2)}</p>
                </div>
                <div className="rounded border border-outline-variant bg-surface p-3">
                  <p className="text-[10px] font-semibold uppercase text-on-surface-variant">Mensajes por charla</p>
                  <p className="mt-1 text-2xl font-black text-on-surface">{conversationStats.length ? averageMessages.toFixed(1) : "—"}</p>
                </div>
              </div>
              <StackedBar className="mt-4" segments={confidenceSegments} emptyLabel="Aún no hay respuestas con puntaje de confianza." />
              <div className="mt-5 border-t border-outline-variant pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-bold text-on-surface">Escalaciones por motivo</h3>
                  <span className="text-[11px] text-on-surface-variant">{attendedHandoffs} atendidas de {handoffStats.length}</span>
                </div>
                {handoffReasons.length === 0 ? (
                  <p className="mt-2 text-xs text-on-surface-variant">Ninguna consulta necesitó atención humana en el periodo.</p>
                ) : (
                  <ol className="mt-3 space-y-2.5">
                    {handoffReasons.map((item) => (
                      <li key={item.reason}>
                        <div className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-on-surface">{item.label}</span><span className="shrink-0 font-semibold text-on-surface">{item.value}</span></div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-outline-variant/40"><div className="chart-grow h-full rounded-full" style={{ width: `${Math.round((item.value / handoffMax) * 100)}%`, backgroundColor: "var(--chart-sky)" }} /></div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          ) : null}

          {canAttendHandoffs ? (
            <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Escalaciones por atender</h2>
                <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-xs font-semibold text-on-surface">
                  {pendingHandoffs.length}
                </span>
              </div>

              {pendingHandoffs.length === 0 ? (
                <p className="mt-3 rounded border border-outline-variant bg-surface p-3 text-sm text-on-surface-variant">
                  No hay consultas esperando atención humana.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {pendingHandoffs.map((handoff) => (
                    <li key={handoff.id} className="rounded border border-outline-variant bg-surface p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                        <span className="rounded bg-surface-container-highest px-2 py-0.5 font-semibold text-on-surface">
                          {handoff.priority}
                        </span>
                        <span>{handoffReasonLabels[handoff.reason] ?? handoff.reason}</span>
                        <span>· {new Date(handoff.requested_at).toLocaleString("es-MX")}</span>
                      </div>
                      {handoff.notes ? (
                        <p className="mt-2 text-sm text-on-surface">{handoff.notes}</p>
                      ) : null}
                      <form action={resolveHandoff} className="mt-3">
                        <input type="hidden" name="id" value={handoff.id} />
                        <button className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary">
                          Marcar atendida
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {canManageFaq ? (
            <form action={createFaqEntry} className="rounded-lg border border-outline-variant bg-surface-container p-5">
              <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Publicar FAQ</h2>
              <div className="mt-4 space-y-3">
                <input aria-label="Categoría de la pregunta" name="category" required placeholder="Categoría" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
                <input aria-label="Pregunta oficial" name="question" required placeholder="Pregunta oficial" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
                <textarea aria-label="Respuesta oficial" name="answer" required rows={3} placeholder="Respuesta oficial" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
                <input aria-label="Palabras clave separadas por coma" name="keywords" placeholder="Palabras clave separadas por coma" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
              </div>
              <button className="mt-4 w-full rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container">
                Publicar FAQ
              </button>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
