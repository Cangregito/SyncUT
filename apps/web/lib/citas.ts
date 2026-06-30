// apps/web/lib/citas.ts
import { createClient } from '@/lib/supabase/client'

export type Appointment = {
  id: string
  student_id: string
  tutor_id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  created_at: string
}

const supabase = createClient()

export async function getCitas(userId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .or(`student_id.eq.${userId},tutor_id.eq.${userId}`)
    .order('start_time', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createCita(cita: Omit<Appointment, 'id' | 'created_at'>) {
  // Validar colisiones antes de insertar
  const { data: colision } = await supabase
    .from('appointments')
    .select('id')
    .eq('tutor_id', cita.tutor_id)
    .neq('status', 'cancelled')
    .lt('start_time', cita.end_time)
    .gt('end_time', cita.start_time)

  if (colision && colision.length > 0) {
    throw new Error('El tutor ya tiene una cita en ese horario')
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert(cita)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCitaStatus(id: string, status: Appointment['status']) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCita(id: string) {
  return updateCitaStatus(id, 'cancelled')
}