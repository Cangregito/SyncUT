"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type Priority = "alta" | "media" | "baja";
type IncidentStatus = "abierta" | "en_proceso" | "resuelta" | "cerrada";

type Incident = {
  id: string;
  titulo: string;
  area: string;
  prioridad: Priority;
  descripcion: string;
  status: IncidentStatus;
  createdAt: string;
};

const STORAGE_KEY = "syncut_beta_incidencias_v1";

const seedData: Incident[] = [
  {
    id: "INC-3001",
    titulo: "Fallo intermitente en portal de tutorias",
    area: "Plataforma academica",
    prioridad: "alta",
    descripcion: "Usuarios reportan desconexion al intentar confirmar cita",
    status: "en_proceso",
    createdAt: "2026-06-03T09:30:00.000Z",
  },
];

export default function IncidenciasPage() {
  const [incidents, setIncidents] = useState<Incident[]>(seedData);
  const [priorityFilter, setPriorityFilter] = useState<"todas" | Priority>("todas");
  const [form, setForm] = useState({ titulo: "", area: "", prioridad: "media" as Priority, descripcion: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Incident[];
        if (Array.isArray(parsed) && parsed.length) {
          setIncidents(parsed);
        }
      }
    } catch {
      setIncidents(seedData);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
  }, [incidents]);

  const filtered = useMemo(() => {
    if (priorityFilter === "todas") return incidents;
    return incidents.filter((item) => item.prioridad === priorityFilter);
  }, [incidents, priorityFilter]);

  function submitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.titulo || !form.area || !form.descripcion) {
      setMessage("Completa los campos obligatorios del reporte.");
      return;
    }

    const newItem: Incident = {
      id: `INC-${Math.floor(Math.random() * 9000) + 1000}`,
      titulo: form.titulo,
      area: form.area,
      prioridad: form.prioridad,
      descripcion: form.descripcion,
      status: "abierta",
      createdAt: new Date().toISOString(),
    };

    setIncidents((current) => [newItem, ...current]);
    setForm({ titulo: "", area: "", prioridad: "media", descripcion: "" });
    setMessage("Incidencia registrada en modo beta.");
  }

  function setStatus(id: string, status: IncidentStatus) {
    setIncidents((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 md:px-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Beta funcional - Squad 5</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Buzon de Incidencias</h1>
          <p className="mt-2 text-sm text-slate-600">Gestion de reportes con semaforo de prioridad y seguimiento de estado.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Inicio</Link>
            <Link href="/notificaciones" className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Notificaciones</Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
          <form onSubmit={submitIncident} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Nuevo reporte</h2>
            <div className="mt-4 space-y-3 text-sm">
              <input
                value={form.titulo}
                onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
                placeholder="Titulo"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                value={form.area}
                onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))}
                placeholder="Area afectada"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <select
                value={form.prioridad}
                onChange={(e) => setForm((prev) => ({ ...prev, prioridad: e.target.value as Priority }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
              <textarea
                rows={3}
                value={form.descripcion}
                onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Descripcion del problema"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            {message ? <p className="mt-3 text-xs font-semibold text-amber-600">{message}</p> : null}
            <button type="submit" className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
              Reportar incidencia
            </button>
          </form>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Incidencias activas</h2>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as "todas" | Priority)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="todas">Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div className="mt-4 space-y-3">
              {filtered.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.id} - {item.titulo}</p>
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {item.prioridad} | {item.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{item.area}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.descripcion}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <button onClick={() => setStatus(item.id, "en_proceso")} className="rounded-lg border border-blue-300 px-2 py-1 text-blue-700">En proceso</button>
                    <button onClick={() => setStatus(item.id, "resuelta")} className="rounded-lg border border-emerald-300 px-2 py-1 text-emerald-700">Resolver</button>
                    <button onClick={() => setStatus(item.id, "cerrada")} className="rounded-lg border border-slate-300 px-2 py-1 text-slate-700">Cerrar</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
