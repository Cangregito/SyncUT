'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCita } from '@/lib/citas'

export default function NuevaCitaPage() {
  const router = useRouter()
  const [form, setForm] = useState({ title: '', description: '', start_time: '', end_time: '', tutor_id: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      await createCita({ ...form, student_id: 'USER_ID_AQUI', status: 'pending' })
      router.push('/(citas)')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Nueva Cita</h1>
      {error && <p className="text-xs text-red-500 mb-4 p-3 bg-red-50 rounded-xl">{error}</p>}
      <div className="space-y-4">
        <input className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          placeholder="Título de la sesión" value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
        <textarea className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          placeholder="Descripción (opcional)" rows={3} value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Inicio</label>
            <input type="datetime-local" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Fin</label>
            <input type="datetime-local" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
          </div>
        </div>
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-3 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
          {loading ? 'Agendando...' : 'Agendar Cita'}
        </button>
      </div>
    </div>
  )
}