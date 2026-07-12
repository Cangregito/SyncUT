"use client";

import { useMemo, useState } from "react";

type Tutor = { id: string; label: string };
type Availability = { tutorId: string; dayOfWeek: number; startsAt: string; endsAt: string };
type BusyDate = { tutorId: string; date: string };

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AppointmentSlotPicker({ tutors, availability, busyDates }: { tutors: Tutor[]; availability: Availability[]; busyDates: BusyDate[] }) {
  const today = useMemo(() => { const value = new Date(); value.setHours(0, 0, 0, 0); return value; }, []);
  const [tutorId, setTutorId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);
  const month = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthLabel = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(month);
  const slots = availability.filter((slot) => slot.tutorId === tutorId);
  const busy = new Set(busyDates.filter((item) => item.tutorId === tutorId).map((item) => item.date));
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - month.getDay() + 1));
  const selectedDaySlots = selectedDate ? slots.filter((slot) => slot.dayOfWeek === new Date(`${selectedDate}T12:00:00`).getDay()) : [];
  const [startsAt, endsAt] = selectedSlot.split("|");

  function selectTutor(value: string) {
    setTutorId(value); setSelectedDate(""); setSelectedSlot(""); setMonthOffset(0);
  }

  return <div className="space-y-3">
    <label className="block text-xs font-medium text-on-surface-variant">Tutor asignado
      <select name="tutor_id" value={tutorId} onChange={(event) => selectTutor(event.target.value)} required disabled={tutors.length === 0} className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface disabled:opacity-50">
        <option value="">Selecciona tutor</option>{tutors.map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.label}</option>)}
      </select>
    </label>
    <input type="hidden" name="scheduled_date" value={selectedDate} />
    <input type="hidden" name="starts_at" value={startsAt ?? ""} />
    <input type="hidden" name="ends_at" value={endsAt ?? ""} />
    {tutorId ? <div className="rounded border border-outline-variant bg-surface p-3">
      <div className="flex items-center justify-between"><button type="button" disabled={monthOffset === 0} onClick={() => setMonthOffset((value) => value - 1)} className="rounded px-3 py-1 text-on-surface disabled:opacity-30">‹</button><p className="text-sm font-bold capitalize text-on-surface">{monthLabel}</p><button type="button" disabled={monthOffset >= 2} onClick={() => setMonthOffset((value) => value + 1)} className="rounded px-3 py-1 text-on-surface disabled:opacity-30">›</button></div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-on-surface-variant">{["Do","Lu","Ma","Mi","Ju","Vi","Sa"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">{days.map((date) => {
        const value = dateValue(date); const weekday = date.getDay(); const sameMonth = date.getMonth() === month.getMonth();
        const unavailable = date < today || weekday === 0 || weekday === 6 || !slots.some((slot) => slot.dayOfWeek === weekday) || busy.has(value);
        return <button key={value} type="button" disabled={unavailable || !sameMonth} onClick={() => { setSelectedDate(value); setSelectedSlot(""); }} title={busy.has(value) ? "El tutor ya tiene una cita este día" : unavailable ? "Sin disponibilidad" : "Disponible"} className={`aspect-square rounded text-xs ${selectedDate === value ? "bg-primary text-on-primary" : unavailable || !sameMonth ? "text-on-surface-variant opacity-25" : "bg-surface-container text-on-surface hover:bg-primary-container"}`}>{date.getDate()}</button>;
      })}</div>
      <p className="mt-3 text-[11px] text-on-surface-variant">Los fines de semana, días sin disponibilidad y días ya ocupados aparecen deshabilitados.</p>
    </div> : null}
    {selectedDate ? <label className="block text-xs font-medium text-on-surface-variant">Horario disponible
      <select value={selectedSlot} onChange={(event) => setSelectedSlot(event.target.value)} required className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"><option value="">Selecciona horario</option>{selectedDaySlots.map((slot) => <option key={`${slot.startsAt}-${slot.endsAt}`} value={`${slot.startsAt}|${slot.endsAt}`}>{slot.startsAt.slice(0,5)}–{slot.endsAt.slice(0,5)}</option>)}</select>
    </label> : null}
  </div>;
}
