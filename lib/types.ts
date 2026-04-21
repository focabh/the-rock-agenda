export type MusicianId = 'foca' | 'marco' | 'felipe' | 'ester' | 'rafa'

export interface Musician {
  id: MusicianId
  name: string
  role: string
  isOptional: boolean // Marco is optional
}

export const MUSICIANS: Musician[] = [
  { id: 'foca', name: 'Foca', role: 'Vocalista / Líder', isOptional: false },
  { id: 'marco', name: 'Marco', role: 'Guitarrista Base', isOptional: true },
  { id: 'felipe', name: 'Felipe', role: 'Guitarrista Base e Solo', isOptional: false },
  { id: 'ester', name: 'Ester', role: 'Bateria', isOptional: false },
  { id: 'rafa', name: 'Rafa', role: 'Baixo', isOptional: false },
]

export type AvailabilityStatus = 'available' | 'unavailable' | 'other_band'

export interface MusicianAvailability {
  id: string
  musician_id: MusicianId
  date: string // YYYY-MM-DD
  status: AvailabilityStatus
  reason?: string
  sub_name?: string
  created_at: string
}

export type ShowStatus = 'confirmed' | 'pending' | 'cancelled'

export interface Show {
  id: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  duration_minutes: number
  client_name: string
  venue?: string
  city?: string
  fee: number
  commission_pct: number
  payment_type: 'cache' | 'portaria'
  portaria_pct?: number
  ticket_revenue?: number
  is_paid: boolean
  payment_proof_url?: string
  status: ShowStatus
  notes?: string
  created_at: string
}

export type CalendarEvent =
  | { type: 'show'; data: Show }
  | { type: 'availability'; data: MusicianAvailability }
