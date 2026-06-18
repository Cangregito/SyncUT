"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CounterData = {
  students: number;
  faculty: number;
  justifications: number;
  appointments: number;
};

export default function DashboardOverviewPage() {
  const [counters, setCounters] = useState<CounterData>({
    students: 14205,
    faculty: 842,
    justifications: 127,
    appointments: 48,
  });

  useEffect(() => {
    // Read from localStorage if existing to sync real-time counters
    try {
      const appointmentsRaw = window.localStorage.getItem("syncut_beta_citas_v1");
      const justificationsRaw = window.localStorage.getItem("syncut_beta_justificaciones_v1");
      
      const apptsCount = appointmentsRaw ? JSON.parse(appointmentsRaw).length : 48;
      const justsCount = justificationsRaw ? JSON.parse(justificationsRaw).length : 127;
      
      setCounters((prev) => ({
        ...prev,
        appointments: apptsCount,
        justifications: justsCount,
      }));
    } catch {}
  }, []);

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight mb-1">
          Panel de Control
        </h2>
        <p className="text-sm text-on-surface-variant">Operaciones del sistema y métricas críticas.</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface-container border border-outline-variant rounded-lg p-5 flex flex-col justify-between hover:bg-surface-container-high transition-colors">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-on-surface-variant">Estudiantes Totales</span>
            <span className="material-symbols-outlined text-primary text-xl">group</span>
          </div>
          <div>
            <span className="text-3xl font-headline font-bold text-on-surface tracking-tighter">
              {counters.students.toLocaleString()}
            </span>
            <div className="flex items-center gap-1 text-tertiary mt-1 text-xs font-medium">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>+2.4% este cuatrimestre</span>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface-container border border-outline-variant rounded-lg p-5 flex flex-col justify-between hover:bg-surface-container-high transition-colors">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-on-surface-variant">Docentes Activos</span>
            <span className="material-symbols-outlined text-primary text-xl">school</span>
          </div>
          <div>
            <span className="text-3xl font-headline font-bold text-on-surface tracking-tighter">
              {counters.faculty}
            </span>
            <div className="flex items-center gap-1 text-on-surface-variant mt-1 text-xs font-medium">
              <span className="material-symbols-outlined text-[14px]">horizontal_rule</span>
              <span>Estable</span>
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface-container border border-outline-variant rounded-lg p-5 flex flex-col justify-between hover:bg-surface-container-high transition-colors relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-50"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-on-surface-variant">Justificaciones Pendientes</span>
            <span className="material-symbols-outlined text-primary text-xl">gavel</span>
          </div>
          <div>
            <span className="text-3xl font-headline font-bold text-on-surface tracking-tighter">
              {counters.justifications}
            </span>
            <div className="flex items-center gap-1 text-error mt-1 text-xs font-medium">
              <span className="material-symbols-outlined text-[14px]">priority_high</span>
              <span>Requiere revisión</span>
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface-container border border-outline-variant rounded-lg p-5 flex flex-col justify-between hover:bg-surface-container-high transition-colors">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-on-surface-variant">Próximas Citas</span>
            <span className="material-symbols-outlined text-primary text-xl">event</span>
          </div>
          <div>
            <span className="text-3xl font-headline font-bold text-on-surface tracking-tighter">
              {counters.appointments}
            </span>
            <div className="flex items-center gap-1 text-on-surface-variant mt-1 text-xs font-medium">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              <span>Siguientes 24 horas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Modules & Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quick Access Modules (Spans 2 cols on wide screens) */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <h3 className="text-sm font-headline font-semibold text-on-surface-variant uppercase tracking-wider">
            Acceso Directo a Módulos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
            <Link
              className="group bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col items-start gap-4 hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              href="/justificaciones"
            >
              <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center group-hover:bg-primary-container transition-colors">
                <span className="material-symbols-outlined text-primary group-hover:text-on-primary-container">
                  gavel
                </span>
              </div>
              <div>
                <h4 className="font-medium text-on-surface mb-1">Módulo Justificaciones</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Procesar solicitudes de inasistencias, justificaciones académicas y carga de evidencias médicas.
                </p>
              </div>
            </Link>

            <Link
              className="group bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col items-start gap-4 hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              href="/citas"
            >
              <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center group-hover:bg-primary-container transition-colors">
                <span className="material-symbols-outlined text-primary group-hover:text-on-primary-container">
                  calendar_month
                </span>
              </div>
              <div>
                <h4 className="font-medium text-on-surface mb-1">Módulo Citas con Tutor</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Agendar sesiones de asesoría académica, revisar disponibilidad del tutor y dar seguimiento.
                </p>
              </div>
            </Link>

            <Link
              className="group bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col items-start gap-4 hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              href="/notificaciones"
            >
              <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center group-hover:bg-primary-container transition-colors">
                <span className="material-symbols-outlined text-primary group-hover:text-on-primary-container">
                  campaign
                </span>
              </div>
              <div>
                <h4 className="font-medium text-on-surface mb-1">Notificaciones Centralizadas</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Enviar avisos institucionales, correos transaccionales y gestionar alertas en tiempo real.
                </p>
              </div>
            </Link>

            <Link
              className="group bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col items-start gap-4 hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              href="/incidencias"
            >
              <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center group-hover:bg-primary-container transition-colors">
                <span className="material-symbols-outlined text-primary group-hover:text-on-primary-container">
                  rule
                </span>
              </div>
              <div>
                <h4 className="font-medium text-on-surface mb-1">Semáforo de Incidencias</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Reportar situaciones académicas de riesgo y visualizar alertas en tableros de tutoría.
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Requires Attention (Spans 1 col) */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-headline font-semibold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            Requiere Atención
            <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
          </h3>
          <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden flex-1 flex flex-col justify-between">
            <ul className="divide-y divide-outline-variant">
              <li className="p-4 hover:bg-surface-container-high transition-colors cursor-pointer flex items-start gap-3">
                <span className="material-symbols-outlined text-error mt-0.5 text-[20px]">warning</span>
                <div>
                  <p className="text-sm font-medium text-on-surface">Demora en Sincronización</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    El nodo B de base de datos experimenta latencia. Sincronización retrasada por 4m.
                  </p>
                </div>
              </li>
              <li className="p-4 hover:bg-surface-container-high transition-colors cursor-pointer flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5 text-[20px]">policy</span>
                <div>
                  <p className="text-sm font-medium text-on-surface">6 Justificaciones Escaladas</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Solicitudes de alumnos han sobrepasado las 72 horas del SLA sin revisión docente.
                  </p>
                </div>
              </li>
              <li className="p-4 hover:bg-surface-container-high transition-colors cursor-pointer flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant mt-0.5 text-[20px]">info</span>
                <div>
                  <p className="text-sm font-medium text-on-surface">Mantenimiento Programado</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Downtime esperado esta noche a las 02:00 AM para el despliegue de la base Supabase.
                  </p>
                </div>
              </li>
            </ul>
            <div className="p-3 border-t border-outline-variant bg-surface-container-lowest text-center">
              <Link href="/notificaciones" className="text-xs font-medium text-primary hover:text-primary-fixed transition-colors">
                Ver todas las alertas
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Activity */}
      <div className="flex flex-col gap-4 mb-8">
        <h3 className="text-sm font-headline font-semibold text-on-surface-variant uppercase tracking-wider">
          Actividad Reciente
        </h3>
        <div className="bg-surface-container border border-outline-variant rounded-lg p-6">
          <div className="relative border-l border-outline-variant ml-3 space-y-6">
            {/* Activity Item 1 */}
            <div className="relative pl-6">
              <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-surface-container"></span>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                <div>
                  <p className="text-sm text-on-surface">
                    <span className="font-medium">Mtra. Emily Chen</span> aprobó la <span className="font-medium text-primary">Justificación #4492</span>
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Justificación médica por inasistencia de alumno con matrícula 883921.
                  </p>
                </div>
                <span className="text-xs text-on-surface-variant whitespace-nowrap">Hace 10 mins</span>
              </div>
            </div>

            {/* Activity Item 2 */}
            <div className="relative pl-6">
              <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-outline ring-4 ring-surface-container"></span>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                <div>
                  <p className="text-sm text-on-surface">
                    Sistema generó el <span className="font-medium text-primary">Reporte Semanal de Asistencia</span>
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    El reporte fue enviado por correo a los jefes de carrera automáticamente.
                  </p>
                </div>
                <span className="text-xs text-on-surface-variant whitespace-nowrap">Hace 1 hora</span>
              </div>
            </div>

            {/* Activity Item 3 */}
            <div className="relative pl-6">
              <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-outline ring-4 ring-surface-container"></span>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                <div>
                  <p className="text-sm text-on-surface">
                    <span className="font-medium">Sistema</span> creó una nueva asignación de tutoría
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Grupo 4B asignado al tutor Mtro. Alejandro Rivera.
                  </p>
                </div>
                <span className="text-xs text-on-surface-variant whitespace-nowrap">Hace 3 horas</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
