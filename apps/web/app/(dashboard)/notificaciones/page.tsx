"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type NotificationChannel = "in-app" | "email";

type NotificationItem = {
  id: string;
  origen: "citas" | "justificaciones" | "incidencias" | "chatbot" | "manual";
  titulo: string;
  detalle: string;
  canal: NotificationChannel;
  leida: boolean;
  createdAt: string;
};

const STORAGE_KEY = "syncut_beta_notifications_v1";

const seedData: NotificationItem[] = [
  {
    id: "NOT-9001",
    origen: "manual",
    titulo: "Bienvenido al centro de notificaciones",
    detalle: "Usa el boton Sincronizar para traer eventos de los demas modulos.",
    canal: "in-app",
    leida: false,
    createdAt: "2026-06-03T10:00:00.000Z",
  },
];

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function NotificacionesPage() {
  const [items, setItems] = useState<NotificationItem[]>(seedData);
  const [sourceFilter, setSourceFilter] = useState<"todos" | NotificationItem["origen"]>("todos");
  const [message, setMessage] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDetail, setManualDetail] = useState("");

  useEffect(() => {
    const stored = safeParseArray<NotificationItem>(window.localStorage.getItem(STORAGE_KEY));
    if (stored.length) {
      setItems(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (sourceFilter === "todos") return sorted;
    return sorted.filter((item) => item.origen === sourceFilter);
  }, [items, sourceFilter]);

  function addManualNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!manualTitle || !manualDetail) {
      setMessage("Completa titulo y detalle para crear la notificacion.");
      return;
    }

    const newItem: NotificationItem = {
      id: `NOT-${Math.floor(Math.random() * 9000) + 1000}`,
      origen: "manual",
      titulo: manualTitle,
      detalle: manualDetail,
      canal: "in-app",
      leida: false,
      createdAt: new Date().toISOString(),
    };

    setItems((current) => [newItem, ...current]);
    setManualTitle("");
    setManualDetail("");
    setMessage("Notificacion manual creada.");
  }

  function syncEvents() {
    const citas = safeParseArray<{ id: string; estado: string }>(
      window.localStorage.getItem("syncut_beta_citas_v1")
    );
    const justificaciones = safeParseArray<{ id: string; estado: string }>(
      window.localStorage.getItem("syncut_beta_justificaciones_v1")
    );
    const incidencias = safeParseArray<{ id: string; status?: string; estado?: string }>(
      window.localStorage.getItem("syncut_beta_incidencias_v1")
    );

    const generated: NotificationItem[] = [];

    citas.slice(0, 3).forEach((item) => {
      generated.push({
        id: `SYNC-CIT-${item.id}`,
        origen: "citas",
        titulo: `Actualizacion de cita ${item.id}`,
        detalle: `Estado actual: ${item.estado}`,
        canal: "email",
        leida: false,
        createdAt: new Date().toISOString(),
      });
    });

    justificaciones.slice(0, 3).forEach((item) => {
      generated.push({
        id: `SYNC-JUS-${item.id}`,
        origen: "justificaciones",
        titulo: `Movimiento en solicitud ${item.id}`,
        detalle: `Estado actual: ${item.estado}`,
        canal: "in-app",
        leida: false,
        createdAt: new Date().toISOString(),
      });
    });

    incidencias.slice(0, 3).forEach((item) => {
      generated.push({
        id: `SYNC-INC-${item.id}`,
        origen: "incidencias",
        titulo: `Incidencia ${item.id} reportada`,
        detalle: `Estado actual: ${item.status ?? item.estado ?? "abierta"}`,
        canal: "in-app",
        leida: false,
        createdAt: new Date().toISOString(),
      });
    });

    setItems((current) => {
      const byId = new Map(current.map((entry) => [entry.id, entry]));
      generated.forEach((entry) => byId.set(entry.id, entry));
      return [...byId.values()];
    });
    setMessage(`Sincronizacion completa: ${generated.length} eventos detectados.`);
  }

  function toggleRead(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, leida: !item.leida } : item)));
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 md:px-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Beta funcional - Squad 4</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Centro de Notificaciones</h1>
          <p className="mt-2 text-sm text-slate-600">
            Consola de eventos con sincronizacion intermodular para validar flujo real de navegacion.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Inicio</Link>
            <button onClick={syncEvents} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700">
              Sincronizar eventos
            </button>
          </div>
          {message ? <p className="mt-3 text-xs font-semibold text-rose-600">{message}</p> : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.9fr]">
          <form onSubmit={addManualNotification} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Crear aviso manual</h2>
            <div className="mt-4 space-y-3 text-sm">
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Titulo"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <textarea
                rows={3}
                value={manualDetail}
                onChange={(e) => setManualDetail(e.target.value)}
                placeholder="Detalle"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            <button className="mt-4 w-full rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700" type="submit">
              Publicar notificacion
            </button>
          </form>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Bandeja de notificaciones</h2>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as "todos" | NotificationItem["origen"])}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="todos">Todos</option>
                <option value="citas">Citas</option>
                <option value="justificaciones">Justificaciones</option>
                <option value="incidencias">Incidencias</option>
                <option value="chatbot">Chatbot</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div className="mt-4 space-y-3">
              {filtered.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.titulo}</p>
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {item.origen}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{item.detalle}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Canal: {item.canal} | {new Date(item.createdAt).toLocaleString()}</p>
                  <button onClick={() => toggleRead(item.id)} className="mt-3 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">
                    {item.leida ? "Marcar no leida" : "Marcar leida"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
