// apps/web/components/citas/CitasCalendar.tsx
'use client'
import { useMemo, useState } from 'react'
import type { Appointment } from '@/lib/citas'

const STATUS_COLORS = {
  pending:   'bg-amber-100 text-amber-700 border-amber-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-500 border-red-200 line-through',
  completed: 'bg-slate-100 text-slate-500 border-slate-200',
}

export function CitasCalendar({ citas }: { citas: Appointment[] }) {
  const [mes, setMes] = useState(new Date())

  const diasDelMes = useMemo(() => {
    const year = mes.getFullYear()
    const month = mes.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()
    return { firstDay, totalDays, year, month }
  }, [mes])

  const citasPorDia = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    citas.forEach(c => {
      const key = new Date(c.start_time).toISOString().split('T')[0]
      map[key] = [...(map[key] ?? []), c]
    })
    return map
  }, [citas])

  const navMes = (dir: number) =>
    setMes(m => new Date(m.getFullYear(), m.getMonth() + dir, 1))

  const nombreMes = mes.toLocaleString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navMes(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm">←</button>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize">{nombreMes}</span>
        <button onClick={() => navMes(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm">→</button>
      </div>

      {/* Grid días */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {['D','L','M','M','J','V','S'].map(d => (
          <div key={d} className="text-xs font-medium text-slate-400 py-1">{d}</div>
        ))}
        {Array.from({ length: diasDelMes.firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: diasDelMes.totalDays }).map((_, i) => {
          const dia = i + 1
          const key = `${diasDelMes.year}-${String(diasDelMes.month + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
          const tiene = citasPorDia[key]
          return (
            <div key={key} className={`relative p-1 rounded-lg text-xs cursor-pointer transition-colors
              ${tiene ? 'bg-indigo-50 dark:bg-indigo-950 font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              {dia}
              {tiene && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full" />}
            </div>
          )
        })}
      </div>

      {/* Lista próximas citas */}
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Próximas citas</p>
        {citas.filter(c => c.status !== 'cancelled' && new Date(c.start_time) >= new Date())
          .slice(0, 3)
          .map(c => (
            <div key={c.id} className={`text-xs px-3 py-2 rounded-lg border ${STATUS_COLORS[c.status]}`}>
              <p className="font-medium">{c.title}</p>
              <p className="opacity-75">{new Date(c.start_time).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>
            </div>
          ))
        }
        {citas.filter(c => c.status !== 'cancelled' && new Date(c.start_time) >= new Date()).length === 0 && (
          <p className="text-xs text-slate-400 text-center py-2">Sin citas próximas</p>
        )}
      </div>
    </div>
  )
}