import { revalidatePath } from "next/cache";
import type { Tables } from "@plataforma/types";

import { ModalityDetailsFields } from "@/components/appointments/modality-details-fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, type UserRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AppointmentStatus = Tables<"appointments">["status"];
type AppointmentModality = Tables<"appointments">["modality"];

type ProfileSummary = {
  full_name: string | null;
  email: string;
};

type AppointmentRow = Tables<"appointments"> & {
  student: ProfileSummary | null;
  tutor: ProfileSummary | null;
};

type AssignmentRow = Pick<Tables<"tutorship_assignments">, "tutor_id" | "student_id"> & {
  tutor: ProfileSummary | null;
};

type SessionNoteRow = Tables<"tutoring_session_notes"> & {
  author: ProfileSummary | null;
};

type AvailabilityRow = Tables<"tutor_availability"> & {
  tutor: ProfileSummary | null;
};

type AuditEventRow = Tables<"appointment_audit_events"> & {
  actor: ProfileSummary | null;
};

type AttendanceStatus = Tables<"appointment_attendance">["status"];

type AttendanceRow = Tables<"appointment_attendance"> & {
  recorder: ProfileSummary | null;
};

const dayLabels = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

const statusLabels: Record<AppointmentStatus, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
  no_asistio: "No asistio",
};

const attendanceLabels: Record<AttendanceStatus, string> = {
  attended: "Asistio",
  no_show: "No asistio",
  excused_absence: "Ausencia justificada",
};

function isAppointmentModality(value: string): value is AppointmentModality {
  return value === "presencial" || value === "virtual";
}

function isAppointmentStatus(value: string): value is AppointmentStatus {
  return ["pendiente", "confirmada", "cancelada", "completada", "no_asistio"].includes(value);
}

function isAttendanceStatus(value: string): value is AttendanceStatus {
  return ["attended", "no_show", "excused_absence"].includes(value);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getAppointmentModalityDetails(
  modality: AppointmentModality,
  location: string,
  meetingUrl: string,
) {
  if (modality === "presencial") {
    if (location.length < 3 || meetingUrl) return null;
    return { location, meetingUrl: null };
  }

  if (!isHttpUrl(meetingUrl) || location) return null;
  return { location: null, meetingUrl };
}

function getAvailabilityLocation(modality: AppointmentModality, location: string) {
  if (modality === "presencial") {
    return location.length >= 3 ? location : null;
  }

  return isHttpUrl(location) ? location : null;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getDayOfWeek(date: string) {
  return new Date(`${date}T00:00:00`).getDay();
}

function isAllowedTransition(current: AppointmentStatus, next: AppointmentStatus) {
  const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
    pendiente: ["confirmada", "cancelada"],
    confirmada: ["completada", "cancelada", "no_asistio"],
    cancelada: [],
    completada: [],
    no_asistio: [],
  };

  return allowed[current].includes(next);
}

function canControlAppointment(
  role: UserRole,
  profileId: string,
  appointment: Pick<Tables<"appointments">, "student_id" | "tutor_id">,
  nextStatus: AppointmentStatus,
) {
  if (hasPermission(role, "appointments:oversight")) {
    return true;
  }

  if (hasPermission(role, "appointments:confirm") && appointment.tutor_id === profileId) {
    return ["confirmada", "completada", "cancelada", "no_asistio"].includes(nextStatus);
  }

  return nextStatus === "cancelada" && appointment.student_id === profileId;
}

async function createAppointment(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  if (profile.role !== "student") {
    return;
  }

  const supabase = await createSupabaseServerClient();

  const tutorId = String(formData.get("tutor_id") ?? "");
  const scheduledDate = String(formData.get("scheduled_date") ?? "");
  const startsAt = String(formData.get("starts_at") ?? "");
  const endsAt = String(formData.get("ends_at") ?? "");
  const modalityValue = String(formData.get("modality") ?? "presencial");
  const modality = isAppointmentModality(modalityValue) ? modalityValue : "presencial";
  const reason = String(formData.get("reason") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const meetingUrl = String(formData.get("meeting_url") ?? "").trim();
  const modalityDetails = getAppointmentModalityDetails(modality, location, meetingUrl);

  if (!tutorId || !scheduledDate || !startsAt || !endsAt || reason.length < 10 || !modalityDetails) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (scheduledDate < today || toMinutes(startsAt) >= toMinutes(endsAt)) {
    return;
  }

  if (profile.role === "student") {
    const { data: assignment } = await supabase
      .from("tutorship_assignments")
      .select("id")
      .eq("student_id", profile.id)
      .eq("tutor_id", tutorId)
      .eq("status", "active")
      .maybeSingle();

    if (!assignment) {
      return;
    }
  }

  const { data: availability } = await supabase
    .from("tutor_availability")
    .select("id, starts_at, ends_at, modality")
    .eq("tutor_id", tutorId)
    .eq("day_of_week", getDayOfWeek(scheduledDate))
    .eq("active", true);

  const hasAvailability = (availability ?? []).some((slot) => {
    return (
      slot.modality === modality &&
      toMinutes(startsAt) >= toMinutes(slot.starts_at) &&
      toMinutes(endsAt) <= toMinutes(slot.ends_at)
    );
  });

  if (!hasAvailability) {
    return;
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .insert({
      student_id: profile.id,
      tutor_id: tutorId,
      scheduled_date: scheduledDate,
      starts_at: startsAt,
      ends_at: endsAt,
      modality,
      reason,
      location: modalityDetails.location,
      meeting_url: modalityDetails.meetingUrl,
    })
    .select("id")
    .single();

  if (appointment) {
    await supabase.from("appointment_audit_events").insert({
      appointment_id: appointment.id,
      actor_id: profile.id,
      event_type: "created",
      to_status: "pendiente",
      note: "Solicitud de cita creada desde el portal.",
    });
    await supabase.rpc("emit_notification", {
      p_user_id: tutorId,
      p_event_type: "appointment.created",
      p_title: "Nueva solicitud de tutoría",
      p_body: `${profile.fullName} solicitó una cita para el ${scheduledDate} de ${startsAt} a ${endsAt}.`,
      p_metadata: {
        appointment_id: appointment.id,
        student_id: profile.id,
        tutor_id: tutorId,
      },
      p_triggered_by: profile.id,
    });
  }

  revalidatePath("/citas");
  revalidatePath("/dashboard");
}

async function updateAppointmentStatus(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !isAppointmentStatus(status)) {
    return;
  }

  const { data: current } = await supabase
    .from("appointments")
    .select("student_id, tutor_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!current || !isAllowedTransition(current.status, status)) {
    return;
  }

  if (!canControlAppointment(profile.role, profile.id, current, status)) {
    return;
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (!error) {
    await supabase.from("appointment_audit_events").insert({
      appointment_id: id,
      actor_id: profile.id,
      event_type: "status_changed",
      from_status: current.status,
      to_status: status,
      note: `Cambio de estado: ${statusLabels[current.status]} a ${statusLabels[status]}.`,
    });
    const { data: appointment } = await supabase
      .from("appointments")
      .select("student_id, tutor_id, scheduled_date, starts_at, ends_at")
      .eq("id", id)
      .maybeSingle();

    if (appointment) {
      const targetUserId = profile.id === appointment.student_id ? appointment.tutor_id : appointment.student_id;
      await supabase.rpc("emit_notification", {
        p_user_id: targetUserId,
        p_event_type: status === "completada" ? "appointment.completed" : "appointment.status_changed",
        p_title: `Cita ${statusLabels[status].toLowerCase()}`,
        p_body: `La cita del ${appointment.scheduled_date} de ${appointment.starts_at.slice(0, 5)} a ${appointment.ends_at.slice(0, 5)} cambió a ${statusLabels[status]}.`,
        p_metadata: {
          appointment_id: id,
          status,
        },
        p_triggered_by: profile.id,
      });
    }
  }

  revalidatePath("/citas");
  revalidatePath("/dashboard");
}

async function createAvailability(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  if (!hasPermission(profile.role, "appointments:availability") || profile.role !== "tutor") {
    return;
  }

  const dayOfWeek = Number(formData.get("day_of_week") ?? -1);
  const startsAt = String(formData.get("starts_at") ?? "");
  const endsAt = String(formData.get("ends_at") ?? "");
  const modalityValue = String(formData.get("modality") ?? "presencial");
  const modality = isAppointmentModality(modalityValue) ? modalityValue : "presencial";
  const location = String(formData.get("location") ?? "").trim();
  const availabilityLocation = getAvailabilityLocation(modality, location);

  if (dayOfWeek < 0 || dayOfWeek > 6 || !startsAt || !endsAt || toMinutes(startsAt) >= toMinutes(endsAt) || !availabilityLocation) {
    return;
  }

  await supabase.from("tutor_availability").insert({
    tutor_id: profile.id,
    day_of_week: dayOfWeek,
    starts_at: startsAt,
    ends_at: endsAt,
    modality,
    location: availabilityLocation,
  });

  revalidatePath("/citas");
}

async function deactivateAvailability(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  const { data: slot } = await supabase
    .from("tutor_availability")
    .select("tutor_id")
    .eq("id", id)
    .maybeSingle();

  if (!slot) {
    return;
  }

  const canDeactivate =
    slot.tutor_id === profile.id || hasPermission(profile.role, "appointments:oversight");

  if (!canDeactivate) {
    return;
  }

  await supabase.from("tutor_availability").update({ active: false }).eq("id", id);
  revalidatePath("/citas");
}

async function createSessionNote(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const appointmentId = String(formData.get("appointment_id") ?? "");
  const observations = String(formData.get("observations") ?? "").trim();
  const agreements = String(formData.get("agreements") ?? "").trim();
  const recommendations = String(formData.get("recommendations") ?? "").trim();

  if (!appointmentId || !observations) {
    return;
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("student_id, tutor_id")
    .eq("id", appointmentId)
    .maybeSingle();

  const canWriteNote =
    appointment &&
    (
      hasPermission(profile.role, "appointments:oversight") ||
      (hasPermission(profile.role, "appointments:session_note") && appointment.tutor_id === profile.id)
    );

  if (!canWriteNote) {
    return;
  }

  const { error } = await supabase.from("tutoring_session_notes").insert({
    appointment_id: appointmentId,
    author_id: profile.id,
    observations,
    agreements: agreements || null,
    recommendations: recommendations || null,
  });

  if (!error) {
    await supabase.from("appointment_audit_events").insert({
      appointment_id: appointmentId,
      actor_id: profile.id,
      event_type: "note_added",
      note: "Seguimiento de tutoría registrado.",
    });
    if (appointment) {
      const targetUserId = profile.id === appointment.student_id ? appointment.tutor_id : appointment.student_id;
      await supabase.rpc("emit_notification", {
        p_user_id: targetUserId,
        p_event_type: "appointment.note_added",
        p_title: "Seguimiento de tutoría registrado",
        p_body: "Se agregó seguimiento a una cita de tutoría.",
        p_metadata: {
          appointment_id: appointmentId,
        },
        p_triggered_by: profile.id,
      });
    }
  }

  revalidatePath("/citas");
}

async function recordAttendance(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const appointmentId = String(formData.get("appointment_id") ?? "");
  const statusValue = String(formData.get("attendance_status") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!appointmentId || !isAttendanceStatus(statusValue)) {
    return;
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("student_id, tutor_id, status, scheduled_date, starts_at, ends_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return;
  }

  const canRecord =
    hasPermission(profile.role, "appointments:oversight") ||
    (hasPermission(profile.role, "appointments:attendance") && appointment.tutor_id === profile.id);

  if (!canRecord) {
    return;
  }

  const nextAppointmentStatus: AppointmentStatus =
    statusValue === "attended" ? "completada" : statusValue === "no_show" ? "no_asistio" : "cancelada";

  const { error } = await supabase.from("appointment_attendance").upsert({
    appointment_id: appointmentId,
    status: statusValue,
    recorded_by: profile.id,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "appointment_id",
  });

  if (!error) {
    await supabase
      .from("appointments")
      .update({
        status: nextAppointmentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    await supabase.from("appointment_audit_events").insert({
      appointment_id: appointmentId,
      actor_id: profile.id,
      event_type: "attendance_recorded",
      from_status: appointment.status,
      to_status: nextAppointmentStatus,
      note: `Asistencia registrada: ${attendanceLabels[statusValue]}.${notes ? ` ${notes}` : ""}`,
    });

    const targetUserId = profile.id === appointment.student_id ? appointment.tutor_id : appointment.student_id;
    await supabase.rpc("emit_notification", {
      p_user_id: targetUserId,
      p_event_type: "appointment.attendance_recorded",
      p_title: "Asistencia de tutoría registrada",
      p_body: `La cita del ${appointment.scheduled_date} de ${appointment.starts_at.slice(0, 5)} a ${appointment.ends_at.slice(0, 5)} quedó como: ${attendanceLabels[statusValue]}.`,
      p_metadata: {
        appointment_id: appointmentId,
        attendance_status: statusValue,
      },
      p_triggered_by: profile.id,
    });
  }

  revalidatePath("/citas");
  revalidatePath("/dashboard");
}

export default async function CitasPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const canCreateAppointments = profile.role === "student";
  const canManageOwnAvailability = profile.role === "tutor" && hasPermission(profile.role, "appointments:availability");
  const canOverseeAppointments = hasPermission(profile.role, "appointments:oversight");

  const [
    { data: appointmentsData, error: appointmentsError },
    { data: assignmentsData },
    { data: notesData },
    { data: availabilityData },
    { data: auditData },
    { data: attendanceData },
  ] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(`
          id,
          student_id,
          tutor_id,
          scheduled_date,
          starts_at,
          ends_at,
          modality,
          reason,
          status,
          location,
          meeting_url,
          created_at,
          updated_at,
          student:profiles!appointments_student_id_fkey(full_name,email),
          tutor:profiles!appointments_tutor_id_fkey(full_name,email)
        `)
        .order("scheduled_date", { ascending: true })
        .order("starts_at", { ascending: true }),
      supabase
        .from("tutorship_assignments")
        .select("tutor_id, student_id, tutor:profiles!tutorship_assignments_tutor_id_fkey(full_name,email)")
        .eq("student_id", profile.id)
        .eq("status", "active"),
      supabase
        .from("tutoring_session_notes")
        .select(`
          id,
          appointment_id,
          author_id,
          observations,
          agreements,
          recommendations,
          created_at,
          author:profiles!tutoring_session_notes_author_id_fkey(full_name,email)
        `)
        .order("created_at", { ascending: false }),
      supabase
        .from("tutor_availability")
        .select(`
          id,
          tutor_id,
          day_of_week,
          starts_at,
          ends_at,
          modality,
          location,
          active,
          created_at,
          updated_at,
          tutor:profiles!tutor_availability_tutor_id_fkey(full_name,email)
        `)
        .eq("active", true)
        .order("day_of_week", { ascending: true })
        .order("starts_at", { ascending: true }),
      supabase
        .from("appointment_audit_events")
        .select(`
          id,
          appointment_id,
          actor_id,
          event_type,
          from_status,
          to_status,
          note,
          created_at,
          actor:profiles!appointment_audit_events_actor_id_fkey(full_name,email)
        `)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointment_attendance")
        .select(`
          id,
          appointment_id,
          status,
          recorded_by,
          notes,
          recorded_at,
          updated_at,
          recorder:profiles!appointment_attendance_recorded_by_fkey(full_name,email)
        `)
        .order("recorded_at", { ascending: false }),
    ]);

  const appointments = (appointmentsData ?? []) as unknown as AppointmentRow[];
  const assignments = (assignmentsData ?? []) as unknown as AssignmentRow[];
  const notes = (notesData ?? []) as unknown as SessionNoteRow[];
  const availability = (availabilityData ?? []) as unknown as AvailabilityRow[];
  const auditEvents = (auditData ?? []) as unknown as AuditEventRow[];
  const attendance = (attendanceData ?? []) as unknown as AttendanceRow[];
  const notesByAppointment = new Map(notes.map((note) => [note.appointment_id, note]));
  const attendanceByAppointment = new Map(attendance.map((item) => [item.appointment_id, item]));
  const auditByAppointment = auditEvents.reduce<Map<string, AuditEventRow[]>>((acc, event) => {
    const current = acc.get(event.appointment_id) ?? [];
    current.push(event);
    acc.set(event.appointment_id, current);
    return acc;
  }, new Map());
  const availabilityByTutor = availability.reduce<Map<string, AvailabilityRow[]>>((acc, slot) => {
    const current = acc.get(slot.tutor_id) ?? [];
    current.push(slot);
    acc.set(slot.tutor_id, current);
    return acc;
  }, new Map());

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Squad 3</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-headline font-bold text-on-surface">
          Agenda de Citas
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Solicitudes de tutoria registradas en Supabase. Sin citas de ejemplo ni almacenamiento local.
        </p>
      </header>

      {appointmentsError ? (
        <div className="rounded-lg border border-error/40 bg-error-container/20 p-4 text-sm text-on-error-container">
          No se pudo consultar `appointments`. Ejecuta la migracion de citas antes de usar este modulo. Detalle: {appointmentsError.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-6">
        {canManageOwnAvailability ? (
          <form action={createAvailability} className="rounded-lg border border-outline-variant bg-surface-container p-5">
            <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Mi disponibilidad</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-on-surface-variant">
                Dia
                <select name="day_of_week" className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
                  {dayLabels.map((label, index) => (
                    <option key={label} value={index}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-on-surface-variant">
                Inicio
                <input name="starts_at" type="time" required className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
              </label>
              <label className="block text-xs font-medium text-on-surface-variant">
                Fin
                <input name="ends_at" type="time" required className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
              </label>
              <div className="sm:col-span-2">
                <ModalityDetailsFields mode="availability" />
              </div>
            </div>
            <SubmitButton className="mt-4 w-full rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container hover:bg-primary disabled:opacity-60" pendingLabel="Guardando...">
              Guardar disponibilidad
            </SubmitButton>
          </form>
        ) : null}

        {canCreateAppointments ? (
        <form action={createAppointment} className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Nueva cita</h2>

          {assignments.length === 0 ? (
            <p className="mt-4 rounded border border-outline-variant bg-surface p-3 text-sm text-on-surface-variant">
              No hay tutor asignado visible para tu usuario. Crea una fila real en `tutorship_assignments` antes de agendar.
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-on-surface-variant">
              Tutor asignado
              <select
                name="tutor_id"
                required
                disabled={assignments.length === 0}
                className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface disabled:opacity-50"
              >
                <option value="">Selecciona tutor</option>
                {assignments.map((item) => (
                  <option key={item.tutor_id} value={item.tutor_id}>
                    {item.tutor?.full_name ?? item.tutor?.email ?? `Tutor ${item.tutor_id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block text-xs font-medium text-on-surface-variant">
                Fecha
                <input name="scheduled_date" type="date" required className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
              </label>
              <label className="block text-xs font-medium text-on-surface-variant">
                Inicio
                <input name="starts_at" type="time" required className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
              </label>
              <label className="block text-xs font-medium text-on-surface-variant">
                Fin
                <input name="ends_at" type="time" required className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
              </label>
            </div>

            <ModalityDetailsFields mode="appointment" />
            <label className="block text-xs font-medium text-on-surface-variant">
              Motivo
              <textarea name="reason" required minLength={10} rows={4} className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
            </label>
          </div>
          <SubmitButton
            disabled={assignments.length === 0}
            pendingLabel="Solicitando..."
            className="mt-4 w-full rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container hover:bg-primary disabled:opacity-50"
          >
            Solicitar cita
          </SubmitButton>
        </form>
        ) : (
          <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
            <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Rol en agenda</h2>
            <p className="mt-3 text-sm text-on-surface-variant">
              {profile.role === "tutor"
                ? "Tu flujo es publicar disponibilidad, confirmar citas, registrar asistencia, supervisar agenda y desactivar bloques cuando sea necesario."
                  : profile.role === "teacher"
                    ? "El docente no agenda tutorias; aporta contexto academico desde justificaciones e incidencias."
                    : "El administrador conserva visibilidad operativa y auditoria de agenda."}
            </p>
          </section>
        )}
        </div>

        <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Citas registradas</h2>
            <span className="text-xs text-on-surface-variant">{appointments.length} visibles</span>
          </div>

          <div className="mt-4 space-y-3">
            {appointments.length === 0 && !appointmentsError ? (
              <p className="rounded border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
                No hay citas visibles para tu usuario.
              </p>
            ) : null}

            {appointments.map((item) => (
              <article key={item.id} className="rounded border border-outline-variant bg-surface p-4">
                {(() => {
                  const sessionNote = notesByAppointment.get(item.id);
                  const attendanceRecord = attendanceByAppointment.get(item.id);
                  const itemAudit = auditByAppointment.get(item.id) ?? [];
                  return (
                    <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-on-surface">
                      {item.scheduled_date} | {item.starts_at.slice(0, 5)}-{item.ends_at.slice(0, 5)}
                    </h3>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {item.tutor?.full_name ?? item.tutor?.email ?? `Tutor ${item.tutor_id.slice(0, 8)}`}
                      {" | "}
                      {item.student?.full_name ?? item.student?.email ?? `Estudiante ${item.student_id.slice(0, 8)}`}
                    </p>
                  </div>
                  <span className="rounded bg-surface-container-highest px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                    {statusLabels[item.status]}
                  </span>
                </div>
                <p className="mt-3 text-sm text-on-surface-variant">{item.reason}</p>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {item.modality}
                  {item.location ? ` | ${item.location}` : ""}
                  {item.meeting_url ? ` | ${item.meeting_url}` : ""}
                </p>
                {(availabilityByTutor.get(item.tutor_id) ?? []).length > 0 ? (
                  <div className="mt-3 rounded border border-outline-variant bg-surface-container p-3">
                    <p className="text-xs font-semibold uppercase text-on-surface-variant">Disponibilidad del tutor</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(availabilityByTutor.get(item.tutor_id) ?? []).map((slot) => (
                        <span key={slot.id} className="rounded bg-surface-container-highest px-2 py-1 text-[11px] text-on-surface-variant">
                          {dayLabels[slot.day_of_week]} {slot.starts_at.slice(0, 5)}-{slot.ends_at.slice(0, 5)} · {slot.modality}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {(canOverseeAppointments || item.tutor_id === profile.id || item.student_id === profile.id) ? (
                  <form action={updateAppointmentStatus} className="mt-4 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={item.id} />
                    {(canOverseeAppointments || item.tutor_id === profile.id) ? (
                      <>
                        <SubmitButton name="status" value="confirmada" className="rounded border border-primary px-3 py-2 text-xs font-semibold text-primary disabled:opacity-60" pendingLabel="Confirmando...">
                          Confirmar
                        </SubmitButton>
                        <SubmitButton name="status" value="completada" className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant disabled:opacity-60" pendingLabel="Completando...">
                          Completar
                        </SubmitButton>
                      </>
                    ) : null}
                    <SubmitButton name="status" value="cancelada" className="rounded border border-error px-3 py-2 text-xs font-semibold text-error disabled:opacity-60" pendingLabel="Cancelando...">
                      Cancelar
                    </SubmitButton>
                  </form>
                ) : null}
                {attendanceRecord ? (
                  <div className="mt-4 rounded border border-outline-variant bg-surface-container p-3">
                    <p className="text-xs font-semibold uppercase text-on-surface-variant">Asistencia</p>
                    <p className="mt-2 text-sm font-semibold text-on-surface">{attendanceLabels[attendanceRecord.status]}</p>
                    {attendanceRecord.notes ? (
                      <p className="mt-1 text-xs text-on-surface-variant">{attendanceRecord.notes}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-on-surface-variant">
                      Registro: {attendanceRecord.recorder?.full_name ?? attendanceRecord.recorder?.email ?? "Usuario visible por RLS"}
                      {attendanceRecord.recorded_at ? ` | ${new Date(attendanceRecord.recorded_at).toLocaleString("es-MX")}` : ""}
                    </p>
                  </div>
                ) : (canOverseeAppointments || item.tutor_id === profile.id) && item.status === "confirmada" ? (
                  <form action={recordAttendance} className="mt-4 rounded border border-outline-variant bg-surface-container p-3">
                    <input type="hidden" name="appointment_id" value={item.id} />
                    <p className="text-xs font-semibold uppercase text-on-surface-variant">Registrar asistencia</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr]">
                      <select name="attendance_status" className="rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
                        <option value="attended">Asistio</option>
                        <option value="no_show">No asistio</option>
                        <option value="excused_absence">Ausencia justificada</option>
                      </select>
                      <input
                        name="notes"
                        placeholder="Nota breve de asistencia"
                        className="rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                      />
                    </div>
                    <SubmitButton className="mt-3 rounded bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary-container disabled:opacity-60" pendingLabel="Guardando...">
                      Guardar asistencia
                    </SubmitButton>
                  </form>
                ) : null}
                {sessionNote ? (
                  <div className="mt-4 rounded border border-outline-variant bg-surface-container p-3">
                    <p className="text-xs font-semibold uppercase text-on-surface-variant">Seguimiento</p>
                    <p className="mt-2 text-sm text-on-surface-variant">{sessionNote.observations}</p>
                    {sessionNote.agreements ? (
                      <p className="mt-2 text-xs text-on-surface-variant">Acuerdos: {sessionNote.agreements}</p>
                    ) : null}
                    {sessionNote.recommendations ? (
                      <p className="mt-1 text-xs text-on-surface-variant">Recomendaciones: {sessionNote.recommendations}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-on-surface-variant">
                      Capturo: {sessionNote.author?.full_name ?? sessionNote.author?.email ?? "Usuario visible por RLS"}
                    </p>
                  </div>
                ) : (canOverseeAppointments || item.tutor_id === profile.id) && item.status === "completada" ? (
                  <form action={createSessionNote} className="mt-4 rounded border border-outline-variant bg-surface-container p-3">
                    <input type="hidden" name="appointment_id" value={item.id} />
                    <p className="text-xs font-semibold uppercase text-on-surface-variant">Registrar seguimiento</p>
                    <textarea
                      name="observations"
                      required
                      rows={3}
                      placeholder="Observaciones de la sesion"
                      className="mt-3 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                    />
                    <input
                      name="agreements"
                      placeholder="Acuerdos"
                      className="mt-2 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                    />
                    <input
                      name="recommendations"
                      placeholder="Recomendaciones"
                      className="mt-2 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                    />
                    <SubmitButton className="mt-3 rounded bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary-container disabled:opacity-60" pendingLabel="Guardando...">
                      Guardar seguimiento
                    </SubmitButton>
                  </form>
                ) : null}
                {itemAudit.length > 0 ? (
                  <details className="mt-4 rounded border border-outline-variant bg-surface-container p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase text-on-surface-variant">
                      Bitacora ({itemAudit.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {itemAudit.map((event) => (
                        <div key={event.id} className="border-t border-outline-variant pt-2 first:border-t-0 first:pt-0">
                          <p className="text-xs text-on-surface-variant">
                            {event.event_type}
                            {event.from_status && event.to_status ? ` · ${statusLabels[event.from_status]} -> ${statusLabels[event.to_status]}` : ""}
                          </p>
                          {event.note ? <p className="mt-1 text-sm text-on-surface-variant">{event.note}</p> : null}
                          <p className="mt-1 text-[11px] text-on-surface-variant">
                            {event.actor?.full_name ?? event.actor?.email ?? "Sistema"}
                            {event.created_at ? ` | ${new Date(event.created_at).toLocaleString("es-MX")}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Disponibilidad visible</h2>
          <span className="text-xs text-on-surface-variant">{availability.length} bloques activos</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {availability.length === 0 ? (
            <p className="rounded border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant md:col-span-2 xl:col-span-3">
              No hay bloques de disponibilidad activos visibles. Un tutor debe registrar disponibilidad antes de recibir citas.
            </p>
          ) : null}
          {availability.map((slot) => (
            <article key={slot.id} className="rounded border border-outline-variant bg-surface p-4">
              <p className="text-sm font-semibold text-on-surface">
                {slot.tutor?.full_name ?? slot.tutor?.email ?? `Tutor ${slot.tutor_id.slice(0, 8)}`}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {dayLabels[slot.day_of_week]} | {slot.starts_at.slice(0, 5)}-{slot.ends_at.slice(0, 5)} | {slot.modality}
              </p>
              {slot.location ? <p className="mt-1 text-xs text-on-surface-variant">{slot.location}</p> : null}
              {slot.tutor_id === profile.id || canOverseeAppointments ? (
                <form action={deactivateAvailability} className="mt-3">
                  <input type="hidden" name="id" value={slot.id} />
                  <SubmitButton className="rounded border border-error px-3 py-2 text-xs font-semibold text-error disabled:opacity-60" pendingLabel="Desactivando...">
                    Desactivar
                  </SubmitButton>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
