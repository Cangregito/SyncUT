"use client";

import { useId, useState } from "react";

type Modality = "presencial" | "virtual";

type Props = {
  mode: "appointment" | "availability";
};

export function ModalityDetailsFields({ mode }: Props) {
  const [modality, setModality] = useState<Modality>("presencial");
  const fieldId = useId();
  const isAppointment = mode === "appointment";

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-on-surface-variant">
        Modalidad
        <select
          name="modality"
          value={modality}
          onChange={(event) => setModality(event.target.value as Modality)}
          className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
        >
          <option value="presencial">Presencial</option>
          <option value="virtual">En linea</option>
        </select>
      </label>

      {modality === "presencial" ? (
        <label className="block text-xs font-medium text-on-surface-variant" htmlFor={`${fieldId}-location`}>
          Aula o lugar
          <input
            id={`${fieldId}-location`}
            name="location"
            required
            minLength={3}
            maxLength={120}
            placeholder="Ej. Tutoria A-102"
            className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
          />
        </label>
      ) : null}

      {modality === "virtual" && isAppointment ? (
        <label className="block text-xs font-medium text-on-surface-variant" htmlFor={`${fieldId}-meeting-url`}>
          URL de reunion
          <input
            id={`${fieldId}-meeting-url`}
            name="meeting_url"
            type="url"
            required
            maxLength={240}
            placeholder="https://meet.google.com/..."
            className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
          />
        </label>
      ) : null}

      {modality === "virtual" && !isAppointment ? (
        <label className="block text-xs font-medium text-on-surface-variant" htmlFor={`${fieldId}-availability-url`}>
          URL base de tutoria
          <input
            id={`${fieldId}-availability-url`}
            name="location"
            type="url"
            required
            maxLength={240}
            placeholder="https://meet.google.com/..."
            className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
          />
        </label>
      ) : null}
    </div>
  );
}
