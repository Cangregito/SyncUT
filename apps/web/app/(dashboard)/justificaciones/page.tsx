"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

type RequestStatus = "enviada" | "en_revision" | "aprobada" | "rechazada";

type Justification = {
  id: string;
  materia: string;
  fechaFalta: string;
  tipo: "medica" | "laboral" | "institucional";
  evidencia: string;
  detalle: string;
  estado: RequestStatus;
};

const STORAGE_KEY = "syncut_beta_justificaciones_v1";
const flow: RequestStatus[] = ["enviada", "en_revision", "aprobada"];

const seedData: Justification[] = [
  {
    id: "JUS-501",
    materia: "Calculo Integral",
    fechaFalta: "2026-06-01",
    tipo: "medica",
    evidencia: "constancia-medica.pdf",
    detalle: "Consulta de urgencia con incapacidad de 24 horas",
    estado: "en_revision",
  },
];

export default function JustificacionesPage() {
  const [requests, setRequests] = useState<Justification[]>(seedData);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    materia: "",
    fechaFalta: "",
    tipo: "medica" as "medica" | "laboral" | "institucional",
    evidencia: "",
    detalle: "",
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Justification[];
        if (Array.isArray(parsed) && parsed.length) {
          setRequests(parsed);
        }
      }
    } catch {
      setRequests(seedData);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  }, [requests]);

  function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.materia || !form.fechaFalta || !form.evidencia || !form.detalle) {
      setMessage("Completa todos los campos para enviar la solicitud.");
      return;
    }

    const newItem: Justification = {
      id: `JUS-${Math.floor(Math.random() * 900) + 100}`,
      materia: form.materia,
      fechaFalta: form.fechaFalta,
      tipo: form.tipo,
      evidencia: form.evidencia,
      detalle: form.detalle,
      estado: "enviada",
    };

    setRequests((current) => [newItem, ...current]);
    setForm({ materia: "", fechaFalta: "", tipo: "medica", evidencia: "", detalle: "" });
    setMessage("Solicitud enviada en modo beta.");
  }

  function advanceStatus(id: string) {
    setRequests((current) =>
      current.map((item) => {
        if (item.id !== id || item.estado === "rechazada" || item.estado === "aprobada") {
          return item;
        }
        const nextIndex = Math.min(flow.indexOf(item.estado) + 1, flow.length - 1);
        return { ...item, estado: flow[nextIndex] };
      })
    );
  }

  function rejectRequest(id: string) {
    setRequests((current) => current.map((item) => (item.id === id ? { ...item, estado: "rechazada" } : item)));
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 md:px-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Beta funcional - Squad 1</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Justificaciones de Faltas</h1>
          <p className="mt-2 text-sm text-slate-600">Flujo de prueba con carga de evidencia y trazabilidad de estatus.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Inicio</Link>
            <Link href="/notificaciones" className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Ver notificaciones</Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
          <form onSubmit={createRequest} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Nueva solicitud</h2>
            <div className="mt-4 space-y-3 text-sm">
              <input
                value={form.materia}
                onChange={(e) => setForm((prev) => ({ ...prev, materia: e.target.value }))}
                placeholder="Materia"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                type="date"
                value={form.fechaFalta}
                onChange={(e) => setForm((prev) => ({ ...prev, fechaFalta: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <select
                value={form.tipo}
                onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value as "medica" | "laboral" | "institucional" }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="medica">Medica</option>
                <option value="laboral">Laboral</option>
                <option value="institucional">Institucional</option>
              </select>
              <input
                value={form.evidencia}
                onChange={(e) => setForm((prev) => ({ ...prev, evidencia: e.target.value }))}
                placeholder="Nombre de archivo evidencia"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <textarea
                rows={3}
                value={form.detalle}
                onChange={(e) => setForm((prev) => ({ ...prev, detalle: e.target.value }))}
                placeholder="Detalle de la solicitud"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            {message ? <p className="mt-3 text-xs font-semibold text-teal-600">{message}</p> : null}
            <button type="submit" className="mt-4 w-full rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
              Enviar solicitud
            </button>
          </form>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Solicitudes registradas</h2>
            <div className="mt-4 space-y-3">
              {requests.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.id} - {item.materia}</p>
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {item.estado.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Falta: {item.fechaFalta} | Tipo: {item.tipo}</p>
                  <p className="mt-1 text-xs text-slate-600">Evidencia: {item.evidencia}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.detalle}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <button onClick={() => advanceStatus(item.id)} className="rounded-lg border border-emerald-300 px-2 py-1 text-emerald-700">
                      Avanzar flujo
                    </button>
                    <button onClick={() => rejectRequest(item.id)} className="rounded-lg border border-rose-300 px-2 py-1 text-rose-700">
                      Rechazar
                    </button>
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
