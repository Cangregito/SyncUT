"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type AppointmentStatus = "pendiente" | "confirmada" | "cancelada" | "completada";

type Appointment = {
  id: string;
  alumno: string;
  tutor: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  modalidad: "presencial" | "virtual";
  motivo: string;
  estado: AppointmentStatus;
};

const STORAGE_KEY = "syncut_beta_citas_v1";

const seedData: Appointment[] = [
  {
    id: "CIT-1001",
    alumno: "A. Hernandez",
    tutor: "Mtro. Rivera",
    fecha: "2026-06-06",
    horaInicio: "10:00",
    horaFin: "10:30",
    modalidad: "virtual",
    motivo: "Seguimiento de avance academico",
    estado: "confirmada",
  },
  {
    id: "CIT-1002",
    alumno: "L. Gomez",
    tutor: "Mtra. Karim",
    fecha: "2026-06-07",
    horaInicio: "12:00",
    horaFin: "12:30",
    modalidad: "presencial",
    motivo: "Plan de regularizacion",
    estado: "pendiente",
  },
];

function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export default function CitasPage() {
  const [appointments, setAppointments] = useState<Appointment[]>(seedData);
  const [statusFilter, setStatusFilter] = useState<"todos" | AppointmentStatus>("todos");
  const [form, setForm] = useState({
    alumno: "",
    tutor: "",
    fecha: "",
    horaInicio: "",
    horaFin: "",
    modalidad: "presencial" as "presencial" | "virtual",
    motivo: "",
  });
  const [feedback, setFeedback] = useState<string>("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Appointment[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAppointments(parsed);
        }
      }
    } catch {
      setAppointments(seedData);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    if (statusFilter === "todos") return appointments;
    return appointments.filter((item) => item.estado === statusFilter);
  }, [appointments, statusFilter]);

  function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");

    if (!form.alumno || !form.tutor || !form.fecha || !form.horaInicio || !form.horaFin || !form.motivo) {
      setFeedback("Completa todos los campos para crear la cita.");
      return;
    }

    if (toMinutes(form.horaInicio) >= toMinutes(form.horaFin)) {
      setFeedback("La hora de fin debe ser mayor que la de inicio.");
      return;
    }

    const hasCollision = appointments.some((item) => {
      if (item.tutor !== form.tutor || item.fecha !== form.fecha || item.estado === "cancelada") {
        return false;
      }
      return toMinutes(form.horaInicio) < toMinutes(item.horaFin) && toMinutes(form.horaFin) > toMinutes(item.horaInicio);
    });

    if (hasCollision) {
      setFeedback("Ese tutor ya tiene una cita en ese rango horario.");
      return;
    }

    const newItem: Appointment = {
      id: `CIT-${Math.floor(Math.random() * 9000) + 1000}`,
      alumno: form.alumno,
      tutor: form.tutor,
      fecha: form.fecha,
      horaInicio: form.horaInicio,
      horaFin: form.horaFin,
      modalidad: form.modalidad,
      motivo: form.motivo,
      estado: "pendiente",
    };

    setAppointments((current) => [newItem, ...current]);
    setForm({
      alumno: "",
      tutor: "",
      fecha: "",
      horaInicio: "",
      horaFin: "",
      modalidad: "presencial",
      motivo: "",
    });
    setFeedback("Cita creada correctamente en modo beta.");
  }

  function updateStatus(id: string, estado: AppointmentStatus) {
    setAppointments((current) => current.map((item) => (item.id === id ? { ...item, estado } : item)));
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 md:px-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Beta funcional - Squad 3</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Agenda de Citas</h1>
          <p className="mt-2 text-sm text-slate-600">
            Flujo de prueba con creacion, validacion de colisiones y gestion de estado.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
              Inicio
            </Link>
            <Link href="/notificaciones" className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">
              Ver notificaciones
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
          <form onSubmit={submitAppointment} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Nueva cita</h2>
            <div className="mt-4 space-y-3 text-sm">
              <input
                value={form.alumno}
                onChange={(e) => setForm((prev) => ({ ...prev, alumno: e.target.value }))}
                placeholder="Alumno"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                value={form.tutor}
                onChange={(e) => setForm((prev) => ({ ...prev, tutor: e.target.value }))}
                placeholder="Tutor"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <select
                  value={form.modalidad}
                  onChange={(e) => setForm((prev) => ({ ...prev, modalidad: e.target.value as "presencial" | "virtual" }))}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  value={form.horaInicio}
                  onChange={(e) => setForm((prev) => ({ ...prev, horaInicio: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  type="time"
                  value={form.horaFin}
                  onChange={(e) => setForm((prev) => ({ ...prev, horaFin: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <textarea
                value={form.motivo}
                onChange={(e) => setForm((prev) => ({ ...prev, motivo: e.target.value }))}
                rows={3}
                placeholder="Motivo"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            {feedback ? <p className="mt-3 text-xs font-semibold text-indigo-600">{feedback}</p> : null}
            <button className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" type="submit">
              Crear cita
            </button>
          </form>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Citas registradas</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "todos" | AppointmentStatus)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="cancelada">Cancelada</option>
                <option value="completada">Completada</option>
              </select>
            </div>
            <div className="mt-4 space-y-3">
              {filteredAppointments.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.id} - {item.alumno}</p>
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {item.estado}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Tutor: {item.tutor} | {item.fecha} | {item.horaInicio} - {item.horaFin}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.modalidad} | {item.motivo}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <button onClick={() => updateStatus(item.id, "confirmada")} className="rounded-lg border border-emerald-300 px-2 py-1 text-emerald-700">
                      Confirmar
                    </button>
                    <button onClick={() => updateStatus(item.id, "completada")} className="rounded-lg border border-blue-300 px-2 py-1 text-blue-700">
                      Completar
                    </button>
                    <button onClick={() => updateStatus(item.id, "cancelada")} className="rounded-lg border border-rose-300 px-2 py-1 text-rose-700">
                      Cancelar
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
