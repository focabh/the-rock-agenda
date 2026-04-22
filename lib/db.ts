import { supabase } from './supabase'
import type { Show, ShowMusician, MusicianAvailability, MusicianId } from './types'
import { MUSICIANS } from './types'
import { ROLE_TO_MUSICIAN_ID, type RoleType } from './auth-types'

// Shows
export async function getShows(year?: number) {
  let query = supabase.from('shows').select('*').order('date', { ascending: true })
  if (year) {
    query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
  }
  const { data, error } = await query
  if (error) throw error
  return data as Show[]
}

export async function getShowsByMonth(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  const { data, error } = await supabase
    .from('shows')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date')
  if (error) throw error
  return data as Show[]
}

export async function createShow(show: Omit<Show, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('shows').insert(show).select().single()
  if (error) throw error
  return data as Show
}

export async function updateShow(id: string, show: Partial<Omit<Show, 'id' | 'created_at'>>) {
  const { data, error } = await supabase.from('shows').update(show).eq('id', id).select().single()
  if (error) throw error
  return data as Show
}

export async function deleteShow(id: string) {
  const { error } = await supabase.from('shows').delete().eq('id', id)
  if (error) throw error
}

// Show musicians
export async function getShowMusicians(showId: string) {
  const { data, error } = await supabase
    .from('show_musicians')
    .select('*')
    .eq('show_id', showId)
  if (error) throw error
  return data as ShowMusician[]
}

export async function getShowMusiciansForShows(showIds: string[]) {
  if (showIds.length === 0) return []
  const { data, error } = await supabase
    .from('show_musicians')
    .select('*')
    .in('show_id', showIds)
  if (error) throw error
  return data as ShowMusician[]
}

export async function upsertShowMusicians(entries: Omit<ShowMusician, 'id' | 'created_at'>[]) {
  const { error } = await supabase
    .from('show_musicians')
    .upsert(entries, { onConflict: 'show_id,musician_id' })
  if (error) throw error
}

// Availability
export async function getAvailabilityByMonth(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  const { data, error } = await supabase
    .from('musician_availability')
    .select('*')
    .gte('date', start)
    .lte('date', end)
  if (error) throw error
  return data as MusicianAvailability[]
}

export async function getAvailabilityByDate(date: string) {
  const { data, error } = await supabase
    .from('musician_availability')
    .select('*')
    .eq('date', date)
  if (error) throw error
  return data as MusicianAvailability[]
}

export async function upsertAvailability(availability: Omit<MusicianAvailability, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('musician_availability')
    .upsert(availability, { onConflict: 'musician_id,date' })
    .select()
    .single()
  if (error) throw error
  return data as MusicianAvailability
}

export async function deleteAvailability(musicianId: MusicianId, date: string) {
  const { error } = await supabase
    .from('musician_availability')
    .delete()
    .eq('musician_id', musicianId)
    .eq('date', date)
  if (error) throw error
}

// Musician profiles — merges DB profiles with hardcoded MUSICIANS defaults
// Returns a map: musicianId → { name, phone }
export interface MusicianInfo { name: string; phone?: string }
export async function getMusicianProfiles(): Promise<Record<string, MusicianInfo>> {
  const result: Record<string, MusicianInfo> = {}
  for (const m of MUSICIANS) result[m.id] = { name: m.name }

  const { data } = await supabase
    .from('profiles')
    .select('role, nickname, phone')
    .in('role', Object.keys(ROLE_TO_MUSICIAN_ID))
  if (data) {
    for (const p of data) {
      const mid = ROLE_TO_MUSICIAN_ID[p.role as RoleType]
      if (mid) result[mid] = { name: p.nickname, phone: p.phone }
    }
  }
  return result
}

// Stats
export async function getFinancialStats(year: number) {
  const { data, error } = await supabase
    .from('shows')
    .select('fee, commission_pct, is_paid, status')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .neq('status', 'cancelled')
  if (error) throw error
  const shows = data as Pick<Show, 'fee' | 'commission_pct' | 'is_paid' | 'status'>[]
  const totalFee = shows.reduce((s, x) => s + x.fee, 0)
  const totalCommission = shows.reduce((s, x) => s + (x.fee * x.commission_pct) / 100, 0)
  const paid = shows.filter((x) => x.is_paid).reduce((s, x) => s + x.fee, 0)
  const pending = shows.filter((x) => !x.is_paid).reduce((s, x) => s + x.fee, 0)
  return { totalFee, totalCommission, paid, pending, count: shows.length }
}
