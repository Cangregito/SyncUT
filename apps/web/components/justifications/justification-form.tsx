"use client";

import { useMemo, useState } from "react";
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

export function JustificationForm() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData(event.currentTarget);
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

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData.user;

      if (userError || !user) {
        setMessage("No se pudo confirmar tu sesion.");
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
        setMessage(justificationError?.message ?? "No se pudo crear la justificacion.");
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

      event.currentTarget.reset();
      setMessage("Justificacion enviada correctamente.");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-outline-variant bg-surface-container p-5">
      <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Nueva solicitud</h2>
      <div className="mt-4 space-y-3">
        <input name="title" required minLength={5} maxLength={120} placeholder="Titulo de la justificacion" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
        <select name="category" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-on-surface-variant">
            Inicio
            <input name="start_date" required type="date" className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
          </label>
          <label className="text-xs font-medium text-on-surface-variant">
            Fin
            <input name="end_date" required type="date" className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
          </label>
        </div>
        <textarea name="description" required minLength={15} rows={4} placeholder="Describe el motivo y el impacto academico" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
        <label className="block text-xs font-medium text-on-surface-variant">
          Evidencia
          <input
            name="evidence"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface file:mr-3 file:rounded file:border-0 file:bg-primary-container file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-on-primary-container"
          />
        </label>
        {message ? (
          <p className="rounded border border-outline-variant bg-surface px-3 py-2 text-xs text-on-surface-variant">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="w-full rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container disabled:opacity-60"
        >
          {isSubmitting ? "Enviando..." : "Enviar justificacion"}
        </button>
      </div>
    </form>
  );
}
