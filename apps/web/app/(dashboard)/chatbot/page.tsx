"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
};

const STORAGE_KEY = "syncut_beta_chatbot_v1";

const initialMessages: ChatMessage[] = [
  {
    id: "BOT-1",
    role: "bot",
    text: "Hola, soy el asistente beta de SyncUT. Puedo ayudarte con citas, justificaciones e incidencias.",
  },
];

function resolveBotAnswer(question: string) {
  const text = question.toLowerCase();
  if (text.includes("cita")) {
    return "Para citas, entra al modulo /citas y crea el registro desde Nueva cita.";
  }
  if (text.includes("justificacion") || text.includes("falta")) {
    return "Para justificar faltas, usa /justificaciones y envia evidencia en el formulario.";
  }
  if (text.includes("incidencia") || text.includes("error")) {
    return "Puedo escalar eso a incidencia. Presiona el boton Escalar a incidencia.";
  }
  if (text.includes("notificacion")) {
    return "En /notificaciones puedes sincronizar eventos de todos los modulos beta.";
  }
  return "Gracias. En esta beta respondo FAQs operativas y puedo escalar incidencias.";
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length) {
          setMessages(parsed);
        }
      }
    } catch {
      setMessages(initialMessages);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) return;

    const userEntry: ChatMessage = { id: `USR-${Date.now()}`, role: "user", text: input.trim() };
    const botEntry: ChatMessage = {
      id: `BOT-${Date.now()}`,
      role: "bot",
      text: resolveBotAnswer(input),
    };

    setMessages((current) => [...current, userEntry, botEntry]);
    setInput("");
  }

  function escalateIncident() {
    const raw = window.localStorage.getItem("syncut_beta_incidencias_v1");
    const current = raw ? (JSON.parse(raw) as Array<Record<string, string>>) : [];
    const newIncident = {
      id: `INC-${Math.floor(Math.random() * 9000) + 1000}`,
      titulo: "Escalado desde chatbot",
      area: "Atencion digital",
      prioridad: "media",
      descripcion: "Usuario solicito escalamiento desde la conversacion beta",
      status: "abierta",
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem("syncut_beta_incidencias_v1", JSON.stringify([newIncident, ...current]));
    setStatus(`Escalamiento generado: ${newIncident.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 md:px-10">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-600">Beta funcional - Squad 6</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Asistente Chatbot</h1>
          <p className="mt-2 text-sm text-slate-600">Conversacion de prueba con FAQ y escalamiento a incidencias.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Inicio</Link>
            <Link href="/incidencias" className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Ver incidencias</Link>
            <button onClick={escalateIncident} className="rounded-xl bg-fuchsia-600 px-4 py-2 text-xs font-semibold text-white hover:bg-fuchsia-700">
              Escalar a incidencia
            </button>
          </div>
          {status ? <p className="mt-3 text-xs font-semibold text-fuchsia-700">{status}</p> : null}
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-3">
            {messages.map((item) => (
              <div key={item.id} className={`rounded-2xl px-4 py-3 text-sm ${item.role === "bot" ? "bg-slate-100 text-slate-700" : "bg-fuchsia-600 text-white"}`}>
                {item.text}
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu duda"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700">
              Enviar
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
