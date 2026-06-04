"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SessionData = {
  email: string;
  role: string;
  loggedAt: string;
};

type Notification = { leida?: boolean; createdAt?: string; titulo?: string };
type Incident = { status?: string; titulo?: string; createdAt?: string };
type Appointment = { estado?: string; fecha?: string; id?: string };
type Justification = { estado?: string; fechaFalta?: string; id?: string };
type ChatMessage = { role?: string; text?: string };

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("syncut_beta_session");
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

const moduleLinks = [
  { href: "/citas", title: "Citas", subtitle: "Agenda, confirmacion y seguimiento" },
  { href: "/justificaciones", title: "Justificaciones", subtitle: "Solicitudes y trazabilidad" },
  { href: "/notificaciones", title: "Notificaciones", subtitle: "Eventos in-app y email" },
  { href: "/incidencias", title: "Incidencias", subtitle: "Buzon y estado operativo" },
  { href: "/chatbot", title: "Chatbot", subtitle: "FAQ y escalamiento" },
  { href: "/dashboard", title: "Panel Gerencial", subtitle: "Vista ejecutiva extra" },
];

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setSession(getSession());
    setAppointments(readArray<Appointment>("syncut_beta_citas_v1"));
    setJustifications(readArray<Justification>("syncut_beta_justificaciones_v1"));
    setNotifications(readArray<Notification>("syncut_beta_notifications_v1"));
    setIncidents(readArray<Incident>("syncut_beta_incidencias_v1"));
    setChatMessages(readArray<ChatMessage>("syncut_beta_chatbot_v1"));
  }, []);

  const counters = useMemo(() => {
    const pendingCitas = appointments.filter((item) => item.estado === "pendiente").length;
    const openIncidencias = incidents.filter(
      (item) => item.status !== "cerrada" && item.status !== "resuelta"
    ).length;
    const unreadNotificaciones = notifications.filter((item) => item.leida !== true).length;
    const activeJustificaciones = justifications.filter(
      (item) => item.estado !== "aprobada" && item.estado !== "rechazada"
    ).length;

    return {
      pendingCitas,
      openIncidencias,
      unreadNotificaciones,
      activeJustificaciones,
    };
  }, [appointments, incidents, notifications, justifications]);

  const activity = useMemo(() => {
    const entries: string[] = [];
    if (appointments.length > 0) {
      entries.push(`Citas cargadas: ${appointments.length}`);
    }
    if (justifications.length > 0) {
      entries.push(`Justificaciones activas: ${justifications.length}`);
    }
    if (notifications.length > 0) {
      entries.push(`Notificaciones en bandeja: ${notifications.length}`);
    }
    if (incidents.length > 0) {
      entries.push(`Incidencias registradas: ${incidents.length}`);
    }
    if (chatMessages.length > 0) {
      entries.push(`Mensajes de chatbot: ${chatMessages.length}`);
    }
    return entries.length > 0 ? entries : ["Sin actividad aun. Inicia en cualquier modulo."];
  }, [appointments, justifications, notifications, incidents, chatMessages]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 md:px-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sky-700">SyncUT Plataforma</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
                Centro operativo universitario
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Entorno beta funcional por modulos con datos de prueba y navegacion real.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              {session ? (
                <>
                  <p className="font-semibold">Sesion activa</p>
                  <p>{session.email}</p>
                  <p>Rol: {session.role}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Sin sesion iniciada</p>
                  <p>Accede desde Login para activar perfil.</p>
                </>
              )}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
              Iniciar sesion
            </Link>
            <Link href="/signup" className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">
              Crear cuenta
            </Link>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Citas pendientes</p>
            <p className="mt-2 text-3xl font-black text-indigo-700">{counters.pendingCitas}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Justificaciones activas</p>
            <p className="mt-2 text-3xl font-black text-teal-700">{counters.activeJustificaciones}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Incidencias abiertas</p>
            <p className="mt-2 text-3xl font-black text-amber-700">{counters.openIncidencias}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Notificaciones no leidas</p>
            <p className="mt-2 text-3xl font-black text-rose-700">{counters.unreadNotificaciones}</p>
          </article>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Modulos operativos</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {moduleLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:shadow"
                >
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.subtitle}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-800">Abrir modulo</p>
                </Link>
              ))}
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Actividad reciente</h2>
            <ul className="mt-4 space-y-2">
              {activity.map((item) => (
                <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
