import { revalidatePath } from "next/cache";
import type { Tables } from "@plataforma/types";

import { requireProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      content: "Conversacion iniciada. Las respuestas se basan en FAQ publicadas en la base de datos.",
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

  const match = findFaqMatch(content, (faqs ?? []) as FaqRow[]);
  const now = new Date().toISOString();

  if (match) {
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
  if (!["admin", "coordinator"].includes(profile.role)) {
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

export default async function ChatbotPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const canManageFaq = ["admin", "coordinator"].includes(profile.role);

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
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Squad 6</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-headline font-bold text-on-surface">
          Asistente de Tutorias
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Conversaciones, mensajes, FAQ y escalamiento guardados en Supabase.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Conversacion</h2>
            {conversation ? (
              <span className="rounded bg-surface-container-highest px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                {conversation.status}
              </span>
            ) : null}
          </div>

          {!conversation ? (
            <form action={startConversation} className="mt-4">
              <p className="rounded border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
                No hay una conversacion activa para tu usuario.
              </p>
              <button className="mt-4 rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container">
                Iniciar conversacion
              </button>
            </form>
          ) : (
            <>
              <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded border border-outline-variant p-3 ${
                      message.sender_type === "user"
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-surface text-on-surface"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase opacity-75">{message.sender_type}</p>
                    <p className="mt-1 text-sm">{message.content}</p>
                  </div>
                ))}
              </div>

              {conversation.status !== "closed" ? (
                <form action={sendMessage} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="conversation_id" value={conversation.id} />
                  <input
                    name="content"
                    required
                    placeholder="Escribe tu consulta"
                    className="min-w-0 flex-1 rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                  />
                  <button className="rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container">
                    Enviar
                  </button>
                </form>
              ) : null}

              <form action={closeConversation} className="mt-4 rounded border border-outline-variant bg-surface p-3">
                <input type="hidden" name="conversation_id" value={conversation.id} />
                <p className="text-xs font-semibold uppercase text-on-surface-variant">Cerrar y evaluar</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]">
                  <select name="rating" className="rounded border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface" defaultValue="5">
                    <option value="5">5</option>
                    <option value="4">4</option>
                    <option value="3">3</option>
                    <option value="2">2</option>
                    <option value="1">1</option>
                  </select>
                  <input name="comment" placeholder="Comentario opcional" className="rounded border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface" />
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
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
            <h2 className="text-sm font-semibold uppercase text-on-surface-variant">FAQ publicadas</h2>
            <div className="mt-4 space-y-3">
              {faqs.length === 0 ? (
                <p className="rounded border border-outline-variant bg-surface p-3 text-sm text-on-surface-variant">
                  No hay FAQ publicadas. El asistente registrara escalamiento cuando reciba preguntas.
                </p>
              ) : null}
              {faqs.map((faq) => (
                <div key={faq.id} className="rounded border border-outline-variant bg-surface p-3">
                  <p className="text-xs font-semibold uppercase text-primary">{faq.category}</p>
                  <p className="mt-1 text-sm font-medium text-on-surface">{faq.question}</p>
                </div>
              ))}
            </div>
          </section>

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

          {canManageFaq ? (
            <form action={createFaqEntry} className="rounded-lg border border-outline-variant bg-surface-container p-5">
              <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Publicar FAQ</h2>
              <div className="mt-4 space-y-3">
                <input name="category" required placeholder="Categoria" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
                <input name="question" required placeholder="Pregunta oficial" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
                <textarea name="answer" required rows={3} placeholder="Respuesta oficial" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
                <input name="keywords" placeholder="Palabras clave separadas por coma" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
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
