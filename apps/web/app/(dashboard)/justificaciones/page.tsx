"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type RequestStatus =
  | "borrador"
  | "enviada"
  | "en_revision"
  | "observacion"
  | "escalada"
  | "aprobada"
  | "rechazada";

type RequestType = "medica" | "laboral" | "institucional";
type Priority = "alta" | "media" | "baja";

type TraceEntry = {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  status: RequestStatus;
  note: string;
};

type Justification = {
  id: string;
  alumno: string;
  materia: string;
  fechaFalta: string;
  tipo: RequestType;
  prioridad: Priority;
  evidencia: string;
  detalle: string;
  estado: RequestStatus;
  tutor: string;
  creadoEn: string;
  actualizadoEn: string;
  seguimiento: TraceEntry[];
  observaciones: string[];
};

const STORAGE_KEY = "syncut_premium_justificaciones_v2";
const statusOrder: RequestStatus[] = [
  "borrador",
  "enviada",
  "en_revision",
  "observacion",
  "escalada",
  "aprobada",
  "rechazada",
];

const seedData: Justification[] = [
  {
    id: "JUS-501",
    alumno: "María López",
    materia: "Cálculo Integral",
    fechaFalta: "2026-06-01",
    tipo: "medica",
    prioridad: "alta",
    evidencia: "constancia-medica.pdf",
    detalle: "Consulta urgente con incapacidad de 24 horas por cuadro febril.",
    estado: "en_revision",
    tutor: "Dr. Andrés Hidalgo",
    creadoEn: "2026-06-02T09:15:00.000Z",
    actualizadoEn: "2026-06-03T11:20:00.000Z",
    seguimiento: [
      {
        id: "SEG-1",
        timestamp: "2026-06-02T09:15:00.000Z",
        actor: "María López",
        role: "Estudiante",
        status: "enviada",
        note: "Solicitud creada y evidencia cargada.",
      },
      {
        id: "SEG-2",
        timestamp: "2026-06-03T11:20:00.000Z",
        actor: "Ana Ramos",
        role: "Coordinador Académico",
        status: "en_revision",
        note: "Registro inspeccionado y enviado para validación docente.",
      },
    ],
    observaciones: ["Solicitar verificación al área de salud para reincorporación."],
  },
  {
    id: "JUS-612",
    alumno: "Luis Sánchez",
    materia: "Física II",
    fechaFalta: "2026-06-05",
    tipo: "laboral",
    prioridad: "media",
    evidencia: "carta-empresa.pdf",
    detalle: "Permiso de la empresa para atender capacitación obligatoria.",
    estado: "escalada",
    tutor: "Mtra. Fernanda Ruiz",
    creadoEn: "2026-06-06T14:30:00.000Z",
    actualizadoEn: "2026-06-07T08:45:00.000Z",
    seguimiento: [
      {
        id: "SEG-3",
        timestamp: "2026-06-06T14:30:00.000Z",
        actor: "Luis Sánchez",
        role: "Estudiante",
        status: "enviada",
        note: "Solicitud enviada con carta laboral.",
      },
      {
        id: "SEG-4",
        timestamp: "2026-06-07T08:45:00.000Z",
        actor: "Mtra. Fernanda Ruiz",
        role: "Tutor",
        status: "escalada",
        note: "Requiere supervisión de la coordinación de prácticas.",
      },
    ],
    observaciones: ["Verificar impacto en asistencia de laboratorio."],
  },
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getStatusStyle(status: RequestStatus) {
  switch (status) {
    case "enviada":
      return "bg-sky-100 text-sky-800";
    case "en_revision":
      return "bg-amber-100 text-amber-800";
    case "observacion":
      return "bg-orange-100 text-orange-800";
    case "escalada":
      return "bg-rose-100 text-rose-800";
    case "aprobada":
      return "bg-emerald-100 text-emerald-800";
    case "rechazada":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getPriorityLabel(priority: Priority) {
  return priority === "alta" ? "Alta" : priority === "media" ? "Media" : "Baja";
}

export default function JustificacionesPage() {
  const [requests, setRequests] = useState<Justification[]>(seedData);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string>(seedData[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "todos">("todos");
  const [tipoFilter, setTipoFilter] = useState<RequestType | "todos">("todos");
  const [prioridadFilter, setPrioridadFilter] = useState<Priority | "todos">("todos");
  const [form, setForm] = useState({
    alumno: "",
    materia: "",
    fechaFalta: "",
    tipo: "medica" as RequestType,
    prioridad: "media" as Priority,
    evidencia: "",
    detalle: "",
  });
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Justification[];
        if (Array.isArray(parsed) && parsed.length) {
          setRequests(parsed);
          setSelectedId(parsed[0]?.id ?? "");
        }
      }
    } catch {
      setRequests(seedData);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  }, [requests]);

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedId) ?? requests[0],
    [requests, selectedId]
  );

  const totals = useMemo(() => {
    const counts = statusOrder.reduce<Record<RequestStatus, number>>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<RequestStatus, number>);
    requests.forEach((item) => {
      counts[item.estado] += 1;
    });
    return counts;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return [...requests]
      .filter((item) => {
        if (statusFilter !== "todos" && item.estado !== statusFilter) return false;
        if (tipoFilter !== "todos" && item.tipo !== tipoFilter) return false;
        if (prioridadFilter !== "todos" && item.prioridad !== prioridadFilter) return false;
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          item.id.toLowerCase().includes(query) ||
          item.alumno.toLowerCase().includes(query) ||
          item.materia.toLowerCase().includes(query) ||
          item.detalle.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn));
  }, [requests, statusFilter, tipoFilter, prioridadFilter, searchQuery]);

  function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.alumno || !form.materia || !form.fechaFalta || !form.evidencia || !form.detalle) {
      setMessage("Completa todos los campos para enviar la solicitud.");
      return;
    }

    const now = new Date().toISOString();
    const newItem: Justification = {
      id: `JUS-${Math.floor(Math.random() * 900) + 100}`,
      alumno: form.alumno,
      materia: form.materia,
      fechaFalta: form.fechaFalta,
      tipo: form.tipo,
      prioridad: form.prioridad,
      evidencia: form.evidencia,
      detalle: form.detalle,
      estado: "enviada",
      tutor: "Pendiente asignación",
      creadoEn: now,
      actualizadoEn: now,
      seguimiento: [
        {
          id: `SEG-${Math.floor(Math.random() * 9000) + 1000}`,
          timestamp: now,
          actor: form.alumno,
          role: "Estudiante",
          status: "enviada",
          note: "Solicitud enviada con evidencia inicial.",
        },
      ],
      observaciones: [],
    };

    setRequests((current) => [newItem, ...current]);
    setSelectedId(newItem.id);
    setForm({ alumno: "", materia: "", fechaFalta: "", tipo: "medica", prioridad: "media", evidencia: "", detalle: "" });
    setMessage("Solicitud creada y entregada para revisión inmediata.");
  }

  function updateRequestStatus(id: string, nextStatus: RequestStatus, note: string) {
    setRequests((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const updated = {
          ...item,
          estado: nextStatus,
          actualizadoEn: new Date().toISOString(),
          seguimiento: [
            ...item.seguimiento,
            {
              id: `SEG-${Math.floor(Math.random() * 9000) + 1000}`,
              timestamp: new Date().toISOString(),
              actor: nextStatus === "aprobada" ? "Coordinador" : "Sistema",
              role: nextStatus === "aprobada" ? "Coordinador" : "Sistema",
              status: nextStatus,
              note,
            },
          ],
        };
        return updated;
      })
    );
  }

  function addObservation(id: string, note: string) {
    if (!note.trim()) return;
    setRequests((current) =>
      current.map((item) =>
        item.id !== id
          ? item
          : {
              ...item,
              estado: "observacion",
              actualizadoEn: new Date().toISOString(),
              observaciones: [...item.observaciones, note.trim()],
              seguimiento: [
                ...item.seguimiento,
                {
                  id: `SEG-${Math.floor(Math.random() * 9000) + 1000}`,
                  timestamp: new Date().toISOString(),
                  actor: "Revisor",
                  role: "Tutor",
                  status: "observacion",
                  note: `Observación agregada: ${note.trim()}`,
                },
              ],
            }
      )
    );
    setNoteText("");
  }

  const nextAction = selectedRequest
    ? statusOrder[Math.min(statusOrder.indexOf(selectedRequest.estado) + 1, statusOrder.length - 1)]
    : "enviada";

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 md:px-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Gestión premium · Squad 1</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">Centro de Justificaciones</h1>
              <p className="mt-2 text-sm text-slate-600">
                Control total del ciclo de casos, seguimiento detallado, actividades premium y trazabilidad completa de cada solicitud.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Inicio</Link>
              <Link href="/notificaciones" className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Centro de notificaciones</Link>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("todos");
                  setTipoFilter("todos");
                  setPrioridadFilter("todos");
                  setSearchQuery("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.95fr]">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Total", value: requests.length, tone: "bg-slate-100 text-slate-900" },
                { label: "Pendientes", value: totals.en_revision + totals.enviada + totals.observacion + totals.escalada, tone: "bg-amber-100 text-amber-900" },
                { label: "Aprobadas", value: totals.aprobada, tone: "bg-emerald-100 text-emerald-900" },
                { label: "Rechazadas", value: totals.rechazada, tone: "bg-slate-100 text-slate-700" },
              ].map((card) => (
                <div key={card.label} className={`rounded-3xl border border-slate-200 ${card.tone} p-4`}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-black">{card.value}</p>
                </div>
              ))}
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Buscar y filtrar casos</h2>
                  <p className="mt-1 text-xs text-slate-500">Encuentra solicitudes por ID, alumno, materia o prioridad.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-wide text-slate-600">
                  {filteredRequests.length} resultados
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar solicitudes..."
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as RequestStatus | "todos")}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="borrador">Borrador</option>
                  <option value="enviada">Enviada</option>
                  <option value="en_revision">En revisión</option>
                  <option value="observacion">Observación</option>
                  <option value="escalada">Escalada</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="rechazada">Rechazada</option>
                </select>
                <select
                  value={tipoFilter}
                  onChange={(event) => setTipoFilter(event.target.value as RequestType | "todos")}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                >
                  <option value="todos">Todos los tipos</option>
                  <option value="medica">Médica</option>
                  <option value="laboral">Laboral</option>
                  <option value="institucional">Institucional</option>
                </select>
                <select
                  value={prioridadFilter}
                  onChange={(event) => setPrioridadFilter(event.target.value as Priority | "todos")}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                >
                  <option value="todos">Todas las prioridades</option>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Nueva solicitud</h2>
                  <p className="mt-1 text-xs text-slate-500">Registra un nuevo caso con prioridad y evidencia para seguimiento premium.</p>
                </div>
                {message ? <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{message}</span> : null}
              </div>
              <form onSubmit={createRequest} className="mt-4 grid gap-4">
                <input
                  value={form.alumno}
                  onChange={(event) => setForm((prev) => ({ ...prev, alumno: event.target.value }))}
                  placeholder="Nombre del alumno"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
                <input
                  value={form.materia}
                  onChange={(event) => setForm((prev) => ({ ...prev, materia: event.target.value }))}
                  placeholder="Materia"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="date"
                    value={form.fechaFalta}
                    onChange={(event) => setForm((prev) => ({ ...prev, fechaFalta: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  />
                  <input
                    value={form.evidencia}
                    onChange={(event) => setForm((prev) => ({ ...prev, evidencia: event.target.value }))}
                    placeholder="Nombre de evidencia"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={form.tipo}
                    onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value as RequestType }))}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <option value="medica">Médica</option>
                    <option value="laboral">Laboral</option>
                    <option value="institucional">Institucional</option>
                  </select>
                  <select
                    value={form.prioridad}
                    onChange={(event) => setForm((prev) => ({ ...prev, prioridad: event.target.value as Priority }))}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
                <textarea
                  rows={4}
                  value={form.detalle}
                  onChange={(event) => setForm((prev) => ({ ...prev, detalle: event.target.value }))}
                  placeholder="Detalle de la justificación"
                  className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Registrar solicitud
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Lista de solicitudes</h2>
              <div className="mt-4 space-y-4">
                {filteredRequests.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-3xl border p-4 transition ${selectedId === item.id ? "border-teal-500 bg-slate-50" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.id}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.alumno} · {item.materia}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Ver caso
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                      <span className={`rounded-full px-2 py-1 ${getStatusStyle(item.estado)}`}>{item.estado.replace("_", " ")}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Prioridad: {getPriorityLabel(item.prioridad)}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Tipo: {item.tipo}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateRequestStatus(item.id, "en_revision", "Caso escalado para revisión académica.")}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Revisar
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRequestStatus(item.id, "escalada", "Escalado a coordinación por prioridad.")}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Escalar
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRequestStatus(item.id, "aprobada", "Justificación aprobada automáticamente por flujo premium.")}
                        className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        Aprobar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Detalle del caso</h2>
                  <p className="mt-1 text-xs text-slate-500">Trazabilidad completa y acciones de seguimiento por solicitud.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(selectedRequest?.estado ?? "borrador")}`}>
                    {selectedRequest?.estado.replace("_", " ")}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {selectedRequest?.tutor}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Caso</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{selectedRequest?.id}</p>
                  <p className="mt-1 text-xs text-slate-500">Creado: {formatDate(selectedRequest?.creadoEn ?? new Date().toISOString())}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Última actualización</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{formatDate(selectedRequest?.actualizadoEn ?? new Date().toISOString())}</p>
                  <p className="mt-1 text-xs text-slate-500">Alumno: {selectedRequest?.alumno}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Materia</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{selectedRequest?.materia}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Fecha de falta</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(selectedRequest?.fechaFalta)}</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-semibold text-slate-700">Descripción</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{selectedRequest?.detalle}</p>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-900">Tipo:</span> {selectedRequest?.tipo}</p>
                  <p><span className="font-semibold text-slate-900">Prioridad:</span> {getPriorityLabel(selectedRequest?.prioridad ?? "media")}</p>
                  <p><span className="font-semibold text-slate-900">Evidencia:</span> {selectedRequest?.evidencia}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Cronograma de seguimiento</h2>
                  <p className="mt-1 text-xs text-slate-500">Historial de acciones y notas de auditoría.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateRequestStatus(selectedRequest?.id ?? "", "escalada", "Caso escalado manualmente desde el panel.")}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                >
                  Escalar caso
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {selectedRequest?.seguimiento.map((step) => (
                  <div key={step.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{step.actor} · {step.role}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">{step.status.replace("_", " ")}</p>
                      </div>
                      <p className="text-xs text-slate-500">{formatDate(step.timestamp)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.note}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Agregar observación</h2>
                  <p className="mt-1 text-xs text-slate-500">Registra un comentario de seguimiento o requisito adicional.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateRequestStatus(selectedRequest?.id ?? "", nextAction, `Avanzando a estado ${nextAction}.`)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Mover a {nextAction.replace("_", " ")}
                </button>
              </div>
              <div className="mt-4 space-y-4">
                <textarea
                  rows={4}
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Escribe una observación para el caso..."
                  className="w-full rounded-3xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => addObservation(selectedRequest?.id ?? "", noteText)}
                  className="rounded-3xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  Guardar observación y notificar
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Acciones rápidas</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => updateRequestStatus(selectedRequest?.id ?? "", "aprobada", "Aprobación realizada desde acciones rápidas.")}
                  className="rounded-3xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Aprobar caso
                </button>
                <button
                  type="button"
                  onClick={() => updateRequestStatus(selectedRequest?.id ?? "", "rechazada", "Rechazo registrado desde acciones rápidas.")}
                  className="rounded-3xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 hover:bg-rose-100"
                >
                  Rechazar caso
                </button>
                <button
                  type="button"
                  onClick={() => updateRequestStatus(selectedRequest?.id ?? "", "observacion", "Solicitud marcada como observación para aclaración.")}
                  className="rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Solicitar aclaración
                </button>
                <button
                  type="button"
                  onClick={() => updateRequestStatus(selectedRequest?.id ?? "", "escalada", "Caso escalado a coordinación.")}
                  className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reasignar a coordinación
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
