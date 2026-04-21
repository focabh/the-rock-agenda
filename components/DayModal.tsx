'use client'
import { useState } from 'react'
import type { Show, MusicianAvailability } from '@/lib/types'
import { MUSICIANS } from '@/lib/types'
import { formatDate, formatCurrency, formatDuration } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
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
  const isMobile = useIsMobile()

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: isMobile ? '16px 16px 0 0' : 16,
        width: '100%',
        maxWidth: isMobile ? '100%' : 560,
        maxHeight: isMobile ? '92vh' : '90vh',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '16px 20px 12px' : '18px 24px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: 'var(--surface)',
          zIndex: 1,
        }}>
          {/* Drag handle on mobile */}
          {isMobile && (
            <div style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 36,
              height: 4,
              background: 'var(--border)',
              borderRadius: 2,
            }} />
          )}
          <h3 style={{ fontSize: isMobile ? 17 : 18, fontWeight: 700, marginTop: isMobile ? 8 : 0 }}>{formatDate(date)}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: isMobile ? '10px 16px 0' : '12px 24px 0', borderBottom: '1px solid var(--border)' }}>
          {(['overview', 'show', 'availability'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: isMobile ? '7px 12px' : '8px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                fontSize: isMobile ? 12 : 13,
                fontWeight: 600,
                background: tab === t ? 'var(--surface2)' : 'transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {t === 'overview' ? 'Resumo' : t === 'show' ? '+ Show' : '+ Disponib.'}
            </button>
          ))}
        </div>

        <div style={{ padding: isMobile ? '16px' : 24, overflowY: 'auto' }}>
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

function Overview({ shows, availability }: { date: string; shows: Show[]; availability: MusicianAvailability[] }) {
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
                <div style={{ display: 'flex', gap: 14, fontSize: 13, flexWrap: 'wrap' }}>
                  <span>🕐 {show.time}</span>
                  <span>⏱ {formatDuration(show.duration_minutes)}</span>
                  {show.payment_type === 'portaria' ? (
                    <span>🎟 {show.portaria_pct}% portaria{show.fee > 0 ? ` · ${formatCurrency(show.fee)}` : ' · bilheteria a apurar'}</span>
                  ) : (
                    <span>💰 {formatCurrency(show.fee)}</span>
                  )}
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
                  border: '1px solid rgba(255,107,107,0.25)',
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
                      <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 2 }}>👤 Sub: {b.sub_name}</div>
                    )}
                  </div>
                  {!m.isOptional && !b.sub_name && (
                    <span style={{ fontSize: 11, color: 'var(--red)', background: 'rgba(255,107,107,0.1)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
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
    cancelled: { label: 'Cancelado', color: 'var(--red)', bg: 'rgba(255,107,107,0.12)' },
  }
  const s = map[status] ?? map.pending
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}
