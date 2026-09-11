"use client";

import { useMemo, useState } from "react";

type Tutor = { id: string; label: string };
type Availability = {
  tutorId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  modality: "presencial" | "virtual";
  location: string | null;
};
type BusySlot = { tutorId: string; date: string; startsAt: string; endsAt: string };

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slotLabel(slot: Availability) {
  const time = `${slot.startsAt.slice(0, 5)}-${slot.endsAt.slice(0, 5)}`;
  return slot.modality === "presencial"
    ? `${time} · Presencial${slot.location ? ` · ${slot.location}` : ""}`
    : `${time} · En linea`;
}

export function AppointmentSlotPicker({ tutors, availability, busySlots }: { tutors: Tutor[]; availability: Availability[]; busySlots: BusySlot[] }) {
  const today = useMemo(() => { const value = new Date(); value.setHours(0, 0, 0, 0); return value; }, []);
  const [tutorId, setTutorId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);
  const month = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthLabel = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(month);
  const slots = availability.filter((slot) => slot.tutorId === tutorId);
  const busy = new Set(busySlots.filter((item) => item.tutorId === tutorId).map((item) => `${item.date}|${item.startsAt}|${item.endsAt}`));
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - month.getDay() + 1));
  const selectedDaySlots = selectedDate ? slots.filter((slot) => slot.dayOfWeek === new Date(`${selectedDate}T12:00:00`).getDay()) : [];
  const selectedSlot = selectedSlotIndex ? selectedDaySlots[Number(selectedSlotIndex)] : undefined;

  function selectTutor(value: string) {
    setTutorId(value); setSelectedDate(""); setSelectedSlotIndex(""); setMonthOffset(0);
  }

  return <div className="space-y-3">
    <label className="block text-xs font-medium text-on-surface-variant">Tutor asignado
      <select name="tutor_id" value={tutorId} onChange={(event) => selectTutor(event.target.value)} required disabled={tutors.length === 0} className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface disabled:opacity-50">
        <option value="">Selecciona tutor</option>{tutors.map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.label}</option>)}
      </select>
    </label>
    {/* La modalidad y el lugar los hereda el servidor del bloque elegido: no se
        piden aparte para que no puedan contradecirlo. */}
    <input type="hidden" name="scheduled_date" value={selectedDate} />
    <input type="hidden" name="starts_at" value={selectedSlot?.startsAt ?? ""} />
    <input type="hidden" name="ends_at" value={selectedSlot?.endsAt ?? ""} />
    {tutorId ? <div className="rounded border border-outline-variant bg-surface p-3">
      <div className="flex items-center justify-between"><button type="button" disabled={monthOffset === 0} onClick={() => setMonthOffset((value) => value - 1)} className="rounded px-3 py-1 text-on-surface disabled:opacity-30">‹</button><p className="text-sm font-bold capitalize text-on-surface">{monthLabel}</p><button type="button" disabled={monthOffset >= 2} onClick={() => setMonthOffset((value) => value + 1)} className="rounded px-3 py-1 text-on-surface disabled:opacity-30">›</button></div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-on-surface-variant">{["Do","Lu","Ma","Mi","Ju","Vi","Sa"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">{days.map((date) => {
        const value = dateValue(date); const weekday = date.getDay(); const sameMonth = date.getMonth() === month.getMonth();
        const daySlots = slots.filter((slot) => slot.dayOfWeek === weekday);
        const allSlotsBusy = daySlots.length > 0 && daySlots.every((slot) => busy.has(`${value}|${slot.startsAt}|${slot.endsAt}`));
        // Los dias habiles salen de la disponibilidad publicada por el tutor.
        // Bloquear sabado y domingo en duro dejaba huecos imposibles de reservar.
        const unavailable = date < today || daySlots.length === 0 || allSlotsBusy;
        return <button key={value} type="button" disabled={unavailable || !sameMonth} onClick={() => { setSelectedDate(value); setSelectedSlotIndex(""); }} title={allSlotsBusy ? "Todos los horarios estan ocupados" : unavailable ? "Sin disponibilidad" : "Disponible"} className={`aspect-square rounded text-xs ${selectedDate === value ? "bg-primary text-on-primary" : unavailable || !sameMonth ? "text-on-surface-variant opacity-25" : "bg-surface-container text-on-surface hover:bg-primary-container"}`}>{date.getDate()}</button>;
      })}</div>
      <p className="mt-3 text-[11px] text-on-surface-variant">Solo se pueden elegir los dias con horarios publicados por tu tutor. Los dias con todos sus horarios ocupados aparecen deshabilitados.</p>
    </div> : null}
    {selectedDate ? <label className="block text-xs font-medium text-on-surface-variant">Horario disponible
      <select value={selectedSlotIndex} onChange={(event) => setSelectedSlotIndex(event.target.value)} required className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"><option value="">Selecciona horario</option>{selectedDaySlots.map((slot, index) => {
        const slotBusy = busy.has(`${selectedDate}|${slot.startsAt}|${slot.endsAt}`);
        return <option key={`${slot.startsAt}-${slot.endsAt}-${slot.modality}`} value={String(index)} disabled={slotBusy}>{slotLabel(slot)}{slotBusy ? " · ocupado" : ""}</option>;
      })}</select>
    </label> : null}
    {selectedSlot ? <p className="rounded border border-outline-variant bg-surface px-3 py-2 text-xs text-on-surface-variant">
      <span className="font-semibold text-on-surface">{selectedSlot.modality === "presencial" ? "Presencial" : "En linea"}</span>
      {selectedSlot.modality === "presencial"
        ? selectedSlot.location ? ` · ${selectedSlot.location}` : " · tu tutor confirmara el aula"
        : " · recibiras el enlace al confirmarse la cita"}
    </p> : null}
  </div>;
}
