'use client'
import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/Shell'
import Calendar from '@/components/Calendar'
import { getShowsByMonth, getAvailabilityByMonth } from '@/lib/db'
import type { Show, MusicianAvailability } from '@/lib/types'

export default function Home() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear() >= 2026 ? Math.min(today.getFullYear(), 2027) : 2026)
  const [month, setMonth] = useState(
    today.getFullYear() >= 2026 && today.getFullYear() <= 2027 ? today.getMonth() + 1 : 1
  )
  const [shows, setShows] = useState<Show[]>([])
  const [availability, setAvailability] = useState<MusicianAvailability[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, a] = await Promise.all([
        getShowsByMonth(year, month),
        getAvailabilityByMonth(year, month),
      ])
      setShows(s)
      setAvailability(a)
    } catch {
      // Supabase not configured yet — show empty calendar
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  return (
    <Shell>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)' }}>
          Carregando...
        </div>
      ) : (
        <Calendar
          year={year}
          month={month}
          shows={shows}
          availability={availability}
          onNavigate={(y, m) => { setYear(y); setMonth(m) }}
          onRefresh={load}
        />
      )}
    </Shell>
  )
}
