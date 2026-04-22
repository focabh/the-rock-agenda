'use client'
import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/Shell'
import { getAvailabilityByMonth, upsertAvailability, deleteAvailability, getMusicianProfiles, type MusicianInfo } from '@/lib/db'
import type { MusicianAvailability, AvailabilityStatus, MusicianId } from '@/lib/types'
import { MUSICIANS } from '@/lib/types'
import { MONTH_NAMES, getDaysInMonth } from '@/lib/utils'
import { useAuth } from '@/components/AuthProvider'
import { useIsMobile } from '@/hooks/useIsMobile'

export default function DisponibilidadePage() {
  const { isAdmin, isProducer, musicianId } = useAuth()
  const isMobile = useIsMobile()
  const canManageAll = isAdmin || isProducer
  // Regular musicians only see/edit their own row
  const visibleMusicians = canManageAll
    ? MUSICIANS
    : MUSICIANS.filter((m) => m.id === musicianId)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear() >= 2026 ? Math.min(today.getFullYear(), 2027) : 2026)
  const [month, setMonth] = useState(
    today.getFullYear() >= 2026 && today.getFullYear() <= 2027 ? today.getMonth() + 1 : 1
  )
  const [availability, setAvailability] = useState<MusicianAvailability[]>([])
  const [musicianInfo, setMusicianInfo] = useState<Record<string, MusicianInfo>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, info] = await Promise.all([
        getAvailabilityByMonth(year, month),
        getMusicianProfiles(),
      ])
      setAvailability(data)
      setMusicianInfo(info)
    } catch {
      setAvailability([])
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  function getEntry(musicianId: string, date: string) {
    return availability.find((a) => a.musician_id === musicianId && a.date === date)
  }

  const days = getDaysInMonth(year, month)
  const dates = Array.from({ length: days }, (_, i) => {
    const d = i + 1
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  })

  async function toggleStatus(mId: MusicianId, date: string) {
    const existing = getEntry(mId, date)
    setSaving(true)
    try {
      if (!existing || existing.status === 'available') {
        await upsertAvailability({ musician_id: mId, date, status: 'unavailable' })
      } else if (existing.status === 'unavailable') {
        await upsertAvailability({ musician_id: mId, date, status: 'other_band' })
      } else {
        await deleteAvailability(mId, date)
      }
      await load()
    } finally {
      setSaving(false)
    }
  }

  const statusStyle = (status: AvailabilityStatus | undefined) => {
    if (!status || status === 'available') return { bg: 'transparent', color: 'var(--text-muted)', symbol: '·' }
    if (status === 'unavailable') return { bg: 'rgba(248,113,113,0.2)', color: 'var(--red)', symbol: '✗' }
    return { bg: 'rgba(96,165,250,0.2)', color: 'var(--blue)', symbol: '🎵' }
  }

  const canGoPrev = !(year === 2026 && month === 1)
  const canGoNext = !(year === 2027 && month === 12)

  function prev() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function next() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  return (
    <Shell>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? 10 : 0 }}>
            <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, flex: 1, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Disponibilidade</h1>
            {!isMobile && (
              <>
                <button disabled={!canGoPrev} onClick={prev} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, width: 36, height: 36, fontSize: 18 }}>‹</button>
                <span style={{ fontWeight: 700, minWidth: 160, textAlign: 'center', margin: '0 4px' }}>{MONTH_NAMES[month - 1]} {year}</span>
                <button disabled={!canGoNext} onClick={next} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, width: 36, height: 36, fontSize: 18 }}>›</button>
              </>
            )}
          </div>
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button disabled={!canGoPrev} onClick={prev} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, width: 36, height: 36, fontSize: 18, flexShrink: 0 }}>‹</button>
              <span style={{ fontWeight: 700, flex: 1, textAlign: 'center', fontSize: 15 }}>{MONTH_NAMES[month - 1]} {year}</span>
              <button disabled={!canGoNext} onClick={next} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, width: 36, height: 36, fontSize: 18, flexShrink: 0 }}>›</button>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>· Disponível</span>
          <span style={{ color: 'var(--red)' }}>✗ Indisponível pessoal</span>
          <span style={{ color: 'var(--blue)' }}>🎵 Outro compromisso</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>Clique na célula para alternar</span>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Carregando...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, width: 150, borderBottom: '1px solid var(--border)' }}>
                    Músico
                  </th>
                  {dates.map((d) => {
                    const day = Number(d.slice(8))
                    const dow = new Date(year, month - 1, day).getDay()
                    const isWeekend = dow === 0 || dow === 6
                    return (
                      <th key={d} style={{
                        padding: '4px 2px',
                        textAlign: 'center',
                        color: isWeekend ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: isWeekend ? 700 : 400,
                        fontSize: 11,
                        borderBottom: '1px solid var(--border)',
                        minWidth: 28,
                      }}>
                        {day}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleMusicians.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <p style={{ fontWeight: 600 }}>{musicianInfo[m.id]?.name ?? m.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {m.isOptional ? '(opcional) ' : ''}{m.role.split(' ')[0]}
                      </p>
                    </td>
                    {dates.map((d) => {
                      const entry = getEntry(m.id, d)
                      const s = statusStyle(entry?.status)
                      return (
                        <td key={d} style={{ padding: '2px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleStatus(m.id as MusicianId, d)}
                            disabled={saving || (!canManageAll && m.id !== musicianId)}
                            title={entry?.status === 'unavailable' ? `${m.name} — indisponível${entry.reason ? ': ' + entry.reason : ''}${entry.sub_name ? ' | Sub: ' + entry.sub_name : ''}` : entry?.status === 'other_band' ? `${m.name} — outro compromisso` : `${m.name} — disponível`}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              border: 'none',
                              background: s.bg,
                              color: s.color,
                              fontSize: entry?.status === 'other_band' ? 10 : 14,
                              cursor: (!canManageAll && m.id !== musicianId) ? 'default' : 'pointer',
                              opacity: (!canManageAll && m.id !== musicianId) ? 0.5 : 1,
                              transition: 'background 0.1s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto',
                            }}
                          >
                            {s.symbol}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          * Para adicionar motivo ou sub, acesse o calendário e clique no dia específico.
        </p>
      </div>
    </Shell>
  )
}
