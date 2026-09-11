"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tables } from "@plataforma/types";
import { createSupabaseBrowserClient } from "@plataforma/sdk/client";

type JustificationCategory = Tables<"justifications">["category"];

const categoryLabels: Record<JustificationCategory, string> = {
  medical: "Medica",
  official: "Oficial",
  personal: "Personal",
};

function isCategory(value: FormDataEntryValue | null): value is JustificationCategory {
  return value === "medical" || value === "official" || value === "personal";
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function addCalendarDays(date: string, days: number) {
  if (!date) return undefined;
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function localDateValue(daysFromToday = 0) {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + daysFromToday);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inclusiveCalendarDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function JustificationForm() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const minimumAllowedDate = localDateValue(-3);
  const maximumAllowedDate = localDateValue(3);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current || isSubmitting) return;

    // `event.currentTarget` queda en null en cuanto termina el despacho del
    // evento, asi que la referencia se captura antes del primer await.
    const form = event.currentTarget;

    submissionLock.current = true;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData(form);
      const categoryEntry = formData.get("category");
      const category = isCategory(categoryEntry) ? categoryEntry : "personal";
      const title = String(formData.get("title") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const startDate = String(formData.get("start_date") ?? "");
      const endDate = String(formData.get("end_date") ?? "");
      const evidence = formData.get("evidence");
      const file = evidence instanceof File && evidence.size > 0 ? evidence : null;

      if (title.length < 5 || description.length < 15 || !startDate || !endDate || endDate < startDate) {
        setMessage("Revisa titulo, descripcion y rango de fechas.");
        return;
      }


      if (
        startDate < minimumAllowedDate ||
        startDate > maximumAllowedDate ||
        endDate < minimumAllowedDate ||
        endDate > maximumAllowedDate
      ) {
        setMessage("Las fechas deben estar dentro de los 3 dias anteriores o posteriores a hoy.");
        return;
      }

      if (inclusiveCalendarDays(startDate, endDate) > 3) {
        setMessage("Cada justificacion puede cubrir un maximo de 3 dias. Crea otra solicitud para los dias restantes.");
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData.user;

      if (userError || !user) {
        setMessage("No se pudo confirmar tu sesion.");
        return;
      }


      const { data: duplicate } = await supabase
        .from("justifications")
        .select("id")
        .eq("student_id", user.id)
        .ilike("title", title)
        .eq("start_date", startDate)
        .eq("end_date", endDate)
        .in("status", ["pending", "requires_more_info"])
        .limit(1)
        .maybeSingle();

      if (duplicate) {
        setMessage("Ya tienes una solicitud abierta con ese titulo y esas fechas. Respondela desde la lista en lugar de crear otra.");
        return;
      }

      const dueDate = new Date(`${endDate}T00:00:00`);
      dueDate.setDate(dueDate.getDate() + 3);

      const { data: justification, error: justificationError } = await supabase
        .from("justifications")
        .insert({
          student_id: user.id,
          category,
          title,
          description,
          start_date: startDate,
          end_date: endDate,
          due_date: dueDate.toISOString().slice(0, 10),
          folio: `JUS-${Date.now().toString(36).toUpperCase()}`,
          status: "pending",
        })
        .select("id")
        .single();

      if (justificationError || !justification) {
        setMessage(justificationError?.code === "23505" ? "Ya tienes una solicitud abierta con ese titulo y esas fechas. Respondela desde la lista en lugar de crear otra." : justificationError?.message ?? "No se pudo crear la justificacion.");
        return;
      }

      await supabase.from("justification_audit_events").insert({
        justification_id: justification.id,
        actor_id: user.id,
        event_type: "submitted",
        to_status: "pending",
        note: "Solicitud enviada desde el portal.",
      });

      if (file) {
        const filePath = `${user.id}/${justification.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("evidencias_justificaciones")
          .upload(filePath, file, {
            cacheControl: "3600",
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          setMessage(`La solicitud se creo, pero la evidencia no subio: ${uploadError.message}`);
          router.refresh();
          return;
        }

        await supabase.from("justification_files").insert({
          justification_id: justification.id,
          file_name: file.name,
          file_path: filePath,
          content_type: file.type || "application/octet-stream",
          file_size_bytes: file.size,
        });

        await supabase.from("justification_audit_events").insert({
          justification_id: justification.id,
          actor_id: user.id,
          event_type: "file_added",
          note: `Evidencia registrada: ${file.name}.`,
        });
      }

      await supabase.rpc("emit_notification", {
        p_user_id: user.id,
        p_event_type: "justification.submitted",
        p_title: "Justificacion enviada",
        p_body: `Tu solicitud "${title}" quedo pendiente de revision.`,
        p_metadata: { justification_id: justification.id },
        p_triggered_by: user.id,
      });

      form.reset();
      setStartDate("");
      setMessage("Justificacion enviada correctamente.");
      router.refresh();
    } catch {
      // Sin este catch cualquier fallo inesperado dejaba la promesa rota y el
      // formulario mudo, aunque la solicitud ya se hubiera guardado.
      setMessage(
        "No pudimos confirmar el envio. Revisa la lista de solicitudes antes de volver a intentarlo."
      );
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-outline-variant bg-surface-container p-5">
      <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Nueva solicitud</h2>
      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">Cuéntale a tu tutor por qué faltaste y adjunta un comprobante si lo tienes.</p>
      <div className="mt-4 space-y-4">
        <label htmlFor="justification-title" className="block text-sm font-medium text-on-surface">Título de la solicitud <span className="text-on-surface-variant">(obligatorio)</span></label>
        <input id="justification-title" name="title" required minLength={5} maxLength={120} placeholder="Ej. Inasistencia por consulta médica" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
        <label htmlFor="justification-category" className="block text-sm font-medium text-on-surface">Tipo de justificación</label>
        <select id="justification-category" name="category" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <label className="text-xs font-medium text-on-surface-variant">
            Primer día de ausencia
            <input name="start_date" required type="date" min={minimumAllowedDate} max={maximumAllowedDate} value={startDate} onChange={(event) => setStartDate(event.target.value)} className="date-input-dark mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
          </label>
          <label className="text-xs font-medium text-on-surface-variant">
            Último día de ausencia
            <input name="end_date" required type="date" min={startDate || minimumAllowedDate} max={startDate ? [addCalendarDays(startDate, 2), maximumAllowedDate].sort()[0] : maximumAllowedDate} className="date-input-dark mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
          </label>
        </div>
        <p className="text-xs leading-relaxed text-on-surface-variant">Puedes elegir desde 3 días antes hasta 3 días después de hoy. Cada solicitud cubre como máximo 3 días naturales.</p>
        <label htmlFor="justification-description" className="block text-sm font-medium text-on-surface">Motivo de la ausencia <span className="text-on-surface-variant">(obligatorio)</span></label>
        <textarea id="justification-description" name="description" required minLength={15} aria-describedby="justification-description-help" rows={4} placeholder="Explica qué ocurrió y cómo afectó tu asistencia." className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
        <p id="justification-description-help" className="text-xs text-on-surface-variant">Escribe al menos 15 caracteres para que tu tutor pueda revisar el caso.</p>
        <label className="block text-xs font-medium text-on-surface-variant">
          Comprobante (opcional)
          <input
            name="evidence"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            aria-describedby="justification-file-help"
            className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface file:mr-3 file:rounded file:border-0 file:bg-primary-container file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-on-primary-container"
          />
        </label>
        <p id="justification-file-help" className="text-xs text-on-surface-variant">PDF, JPG o PNG de hasta 10 MB.</p>
        {message ? (
          <p role="status" aria-live="polite" className={`rounded border px-3 py-3 text-sm font-medium ${message === "Justificacion enviada correctamente." ? "border-tertiary bg-tertiary-container text-on-tertiary-container" : "border-outline-variant bg-surface text-on-surface-variant"}`}>
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="w-full rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container disabled:opacity-60"
        >
          {isSubmitting ? <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>Enviando...</span> : "Enviar justificacion"}
        </button>
      </div>
    </form>
  );
}
