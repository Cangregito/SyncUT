type ChatMessage = { sender_type: string; content: string };
type KnowledgeEntry = { category: string; question: string; answer: string };

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export type AiAnswer = { content: string; model: string } | null;

export async function generateAiAnswer({
  question,
  history,
  knowledge,
  userName,
}: {
  question: string;
  history: ChatMessage[];
  knowledge: KnowledgeEntry[];
  userName: string;
}): Promise<AiAnswer> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const institutionalContext = knowledge
    .slice(0, 30)
    .map((entry) => `[${entry.category}] ${entry.question}\n${entry.answer}`)
    .join("\n\n");

  const messages = [
    {
      role: "system",
      content: `Eres Lumi, asistente virtual de SyncUT. Ayudas a estudiantes y personal con tutorias, citas, justificaciones, incidencias y uso de la plataforma.
Responde siempre en espanol claro, amable y breve. Usa listas cuando ayuden. No inventes fechas, requisitos, contactos, reglamentos ni decisiones academicas.
Da prioridad al conocimiento institucional incluido abajo. Si la informacion no aparece o implica una decision humana, dilo con honestidad y recomienda contactar al tutor. No solicites contrasenas, datos medicos ni documentos sensibles.
Usuario: ${userName}.

CONOCIMIENTO INSTITUCIONAL:
${institutionalContext || "No hay respuestas institucionales publicadas."}`,
    },
    ...history.slice(-8).map((message) => ({
      role: message.sender_type === "user" ? "user" : "assistant",
      content: message.content,
    })),
    { role: "user", content: question },
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature: 0.35, max_completion_tokens: 500 }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as GroqResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ? { content, model } : null;
  } catch {
    return null;
  }
}
