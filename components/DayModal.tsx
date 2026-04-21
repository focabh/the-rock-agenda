'use client'
import { useState } from 'react'
import type { Show, MusicianAvailability } from '@/lib/types'
import { MUSICIANS } from '@/lib/types'
import { formatDate, formatCurrency, formatDuration } from '@/lib/utils'
import ShowForm from './ShowForm'
import AvailabilityForm from './AvailabilityForm'

interface Props {
  date: string
  shows: Show[]
  availability: MusicianAvailability[]
  onClose: () => void
  onRefresh: () => void
}

export default function DayModal({ date, shows, availability, onClose, onRefresh }: Props) {
  const [tab, setTab] = useState<'overview' | 'show' | 'availability'>('overview')

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>{formatDate(date)}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0', borderBottom: '1px solid var(--border)' }}>
          {(['overview', 'show', 'availability'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                background: tab === t ? 'var(--surface2)' : 'transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {t === 'overview' ? 'Resumo' : t === 'show' ? '+ Show' : '+ Disponibilidade'}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {tab === 'overview' && (
            <Overview date={date} shows={shows} availability={availability} />
          )}
          {tab === 'show' && (
            <ShowForm date={date} onSaved={() => { onRefresh(); setTab('overview') }} />
          )}
          {tab === 'availability' && (
            <AvailabilityForm date={date} existing={availability} onSaved={() => { onRefresh(); setTab('overview') }} />
          )}
        </div>
      </div>
    </div>
  )
}

function Overview({ date, shows, availability }: { date: string; shows: Show[]; availability: MusicianAvailability[] }) {
  const blocked = availability.filter((a) => a.status !== 'available')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {shows.length === 0 && blocked.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nenhum registro para este dia. Use as abas acima para adicionar.</p>
      )}

      {shows.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shows</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shows.map((show) => (
              <div key={show.id} style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 14,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>{show.client_name}</p>
                    {show.venue && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{show.venue}{show.city ? ` · ${show.city}` : ''}</p>}
                  </div>
                  <StatusBadge status={show.status} />
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                  <span>🕐 {show.time}</span>
                  <span>⏱ {formatDuration(show.duration_minutes)}</span>
                  <span>💰 {formatCurrency(show.fee)}</span>
                  <span style={{ color: show.is_paid ? 'var(--green)' : 'var(--orange)' }}>
                    {show.is_paid ? '✓ Pago' : '⏳ Pendente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {blocked.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Indisponibilidades
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {blocked.map((b) => {
              const m = MUSICIANS.find((x) => x.id === b.musician_id)!
              return (
                <div key={b.id} style={{
                  background: 'var(--surface2)',
                  border: '1px solid rgba(248,113,113,0.25)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{m.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>{m.role}</span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {b.status === 'other_band' ? '🎵 Outro compromisso musical' : '🚫 Indisponível pessoal'}
                      {b.reason && ` · ${b.reason}`}
                    </div>
                    {b.sub_name && (
                      <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 2 }}>
                        👤 Sub: {b.sub_name}
                      </div>
                    )}
                  </div>
                  {!m.isOptional && !b.sub_name && (
                    <span style={{ fontSize: 11, color: 'var(--red)', background: 'rgba(248,113,113,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                      Sem sub
                    </span>
                  )}
                  {m.isOptional && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: 4 }}>
                      Opcional
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    confirmed: { label: 'Confirmado', color: 'var(--green)', bg: 'rgba(74,222,128,0.12)' },
    pending: { label: 'Pendente', color: 'var(--orange)', bg: 'rgba(251,146,60,0.12)' },
    cancelled: { label: 'Cancelado', color: 'var(--red)', bg: 'rgba(248,113,113,0.12)' },
  }
  const s = map[status] ?? map.pending
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, padding: '3px 10px', borderRadius: 6 }}>
      {s.label}
    </span>
  )
}
