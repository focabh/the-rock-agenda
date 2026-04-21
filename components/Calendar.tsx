'use client'
import { useState, useEffect } from 'react'
import { MONTH_NAMES, DAY_NAMES, getDaysInMonth, getFirstDayOfMonth } from '@/lib/utils'
import type { Show, MusicianAvailability } from '@/lib/types'
import { MUSICIANS } from '@/lib/types'
import DayModal from './DayModal'

interface Props {
  year: number
  month: number
  shows: Show[]
  availability: MusicianAvailability[]
  onNavigate: (year: number, month: number) => void
  onRefresh: () => void
}

export default function Calendar({ year, month, shows, availability, onNavigate, onRefresh }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  const days = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  function dateStr(day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function showsOnDay(day: number) {
    return shows.filter((s) => s.date === dateStr(day))
  }

  function blockedMusiciansOnDay(day: number) {
    return availability.filter(
      (a) => a.date === dateStr(day) && a.status !== 'available'
    )
  }

  function isBandBlocked(day: number) {
    const blocked = blockedMusiciansOnDay(day)
    // Band is truly blocked if any non-optional musician is unavailable without a sub
    return blocked.some((b) => {
      const m = MUSICIANS.find((x) => x.id === b.musician_id)
      if (!m || m.isOptional) return false
      return !b.sub_name
    })
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const canGoPrev = !(year === 2026 && month === 1)
  const canGoNext = !(year === 2027 && month === 12)

  function prev() {
    if (month === 1) onNavigate(year - 1, 12)
    else onNavigate(year, month - 1)
  }
  function next() {
    if (month === 12) onNavigate(year + 1, 1)
    else onNavigate(year, month + 1)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button
          onClick={prev}
          disabled={!canGoPrev}
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: canGoPrev ? 'var(--text)' : 'var(--text-muted)',
            borderRadius: 8,
            width: 36,
            height: 36,
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >‹</button>
        <h2 style={{ fontSize: 26, fontWeight: 800, minWidth: 220, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {MONTH_NAMES[month - 1]} <span style={{ color: 'var(--accent)' }}>{year}</span>
        </h2>
        <button
          onClick={next}
          disabled={!canGoNext}
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: canGoNext ? 'var(--text)' : 'var(--text-muted)',
            borderRadius: 8,
            width: 36,
            height: 36,
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >›</button>
        <div style={{ flex: 1 }} />
        <Legend />
      </div>

      {/* Day names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '4px 0', fontWeight: 600 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} style={{ minHeight: 90, borderRadius: 8 }} />
          }
          const ds = dateStr(day)
          const dayShows = showsOnDay(day)
          const blocked = blockedMusiciansOnDay(day)
          const hardBlocked = isBandBlocked(day)
          const isToday = ds === todayStr
          const isPast = ds < todayStr

          return (
            <button
              key={day}
              onClick={() => setSelected(ds)}
              style={{
                minHeight: 90,
                borderRadius: 8,
                border: `1px solid ${isToday ? 'var(--accent)' : hardBlocked ? 'var(--red)' : 'var(--border)'}`,
                background: isToday
                  ? 'rgba(204,26,26,0.08)'
                  : hardBlocked
                  ? 'rgba(248,113,113,0.05)'
                  : 'var(--surface)',
                padding: 6,
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                opacity: isPast ? 0.6 : 1,
                transition: 'border-color 0.15s, background 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isToday && !hardBlocked) e.currentTarget.style.borderColor = 'var(--accent-dim)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isToday ? 'var(--accent)' : hardBlocked ? 'var(--red)' : 'var(--border)'
              }}
            >
              <span style={{
                fontSize: 13,
                fontWeight: isToday ? 700 : 500,
                color: isToday ? 'var(--accent)' : 'var(--text)',
              }}>{day}</span>

              {dayShows.map((show) => (
                <div key={show.id} style={{
                  fontSize: 10,
                  background: show.status === 'confirmed' ? 'rgba(74,222,128,0.15)' : 'rgba(251,146,60,0.15)',
                  border: `1px solid ${show.status === 'confirmed' ? 'rgba(74,222,128,0.4)' : 'rgba(251,146,60,0.4)'}`,
                  color: show.status === 'confirmed' ? 'var(--green)' : 'var(--orange)',
                  borderRadius: 4,
                  padding: '2px 5px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}>
                  🎸 {show.client_name}
                </div>
              ))}

              {blocked.length > 0 && (
                <div style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 2,
                }}>
                  {blocked.map((b) => (
                    <span key={b.musician_id} style={{
                      background: 'rgba(248,113,113,0.12)',
                      border: '1px solid rgba(248,113,113,0.3)',
                      color: 'var(--red)',
                      borderRadius: 3,
                      padding: '1px 4px',
                    }}>{b.musician_id}</span>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <DayModal
          date={selected}
          shows={shows.filter((s) => s.date === selected)}
          availability={availability.filter((a) => a.date === selected)}
          onClose={() => setSelected(null)}
          onRefresh={() => { onRefresh(); setSelected(null) }}
        />
      )}
    </div>
  )
}

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(74,222,128,0.3)', display: 'inline-block' }} />
        Show confirmado
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(251,146,60,0.3)', display: 'inline-block' }} />
        Show pendente
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', display: 'inline-block' }} />
        Músico indisponível
      </span>
    </div>
  )
}
