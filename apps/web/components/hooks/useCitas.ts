// apps/web/hooks/useCitas.ts
'use client'
import { useEffect, useState } from 'react'
import { getCitas, createCita, updateCitaStatus, type Appointment } from '@/lib/citas'

export function useCitas(userId: string) {
  const [citas, setCitas] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCitas = async () => {
    try {
      setLoading(true)
      const data = await getCitas(userId)
      setCitas(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId) fetchCitas()
  }, [userId])

  const crear = async (cita: Omit<Appointment, 'id' | 'created_at'>) => {
    const nueva = await createCita(cita)
    setCitas(prev => [...prev, nueva].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    ))
    return nueva
  }

  const cancelar = async (id: string) => {
    await updateCitaStatus(id, 'cancelled')
    setCitas(prev => prev.map(c => c.id === id ? { ...c, status: 'cancelled' } : c))
  }

  const confirmar = async (id: string) => {
    await updateCitaStatus(id, 'confirmed')
    setCitas(prev => prev.map(c => c.id === id ? { ...c, status: 'confirmed' } : c))
  }

  return { citas, loading, error, crear, cancelar, confirmar, refetch: fetchCitas }
}