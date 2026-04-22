'use client'
import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/Shell'
import ShowForm from '@/components/ShowForm'
import ShowMusiciansForm from '@/components/ShowMusiciansForm'
import WhatsAppNotifyPanel from '@/components/WhatsAppNotifyPanel'
import { getShows, deleteShow } from '@/lib/db'
import { useAuth } from '@/components/AuthProvider'
import type { Show } from '@/lib/types'
import { formatDate, formatCurrency, formatDuration } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

export default function ShowsPage() {
  const { isAdmin, isProducer } = useAuth()
  const canManage = isAdmin || isProducer
  const isMobile = useIsMobile()
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Show | null>(null)
  const [adding, setAdding] = useState(false)
  const [pendingParticipation, setPendingParticipation] = useState<Show | null>(null)
  const [notifyShow, setNotifyShow] = useState<Show | null>(null)
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear() >= 2026 ? Math.min(new Date().getFullYear(), 2027) : 2026)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPaid, setFilterPaid] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getShows(filterYear)
      setShows(data)
    } catch {
      setShows([])
    } finally {
      setLoading(false)
    }
  }, [filterYear])

  useEffect(() => { load() }, [load])

  const filtered = shows.filter((s) => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false
    if (filterPaid === 'paid' && !s.is_paid) return false
    if (filterPaid === 'pending' && s.is_paid) return false
    return true
  })

  async function handleDelete(show: Show) {
    if (!confirm(`Excluir show "${show.client_name}" em ${formatDate(show.date)}?`)) return
    await deleteShow(show.id)
    load()
  }

  if (!canManage) return (
    <Shell>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        <p style={{ fontSize: 32, marginBottom: 8 }}>🔒</p>
        <p>Acesso restrito a administradores e produtores.</p>
      </div>
    </Shell>
  )

  const statusColors: Record<string, string> = {
    confirmed: 'var(--green)',
    pending: 'var(--orange)',
    cancelled: 'var(--red)',
  }
  const statusLabels: Record<string, string> = {
    confirmed: 'Confirmado',
    pending: 'Pendente',
    cancelled: 'Cancelado',
  }

  return (
    <Shell>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, flex: 1, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Shows</h1>
          <button
            onClick={() => { setAdding(true); setEditing(null) }}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--bg)',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            + Novo Show
          </button>
        </div>

        {/* Step 1: Show form */}
        {(adding || editing) && !pendingParticipation && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              {editing ? 'Editar Show' : 'Novo Show'}
            </h2>
            <ShowForm
              existing={editing ?? undefined}
              onSaved={(show) => { setAdding(false); setEditing(null); setPendingParticipation(show) }}
              onCancel={() => { setAdding(false); setEditing(null) }}
            />
          </div>
        )}

        {/* Step 2: Musician participation */}
        {pendingParticipation && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Participação dos Músicos</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Confirme quem vai tocar neste show e o cachê individual de cada músico.
            </p>
            <ShowMusiciansForm
              show={pendingParticipation}
              onSaved={() => { setNotifyShow(pendingParticipation); setPendingParticipation(null); load() }}
              onBack={() => { setEditing(pendingParticipation); setPendingParticipation(null) }}
            />
          </div>
        )}

        {/* Step 3: WhatsApp notification */}
        {notifyShow && (
          <WhatsAppNotifyPanel
            show={notifyShow}
            onClose={() => setNotifyShow(null)}
          />
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Todos os status</option>
            <option value="confirmed">Confirmados</option>
            <option value="pending">Pendentes</option>
            <option value="cancelled">Cancelados</option>
          </select>
          <select value={filterPaid} onChange={(e) => setFilterPaid(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Todos os pagamentos</option>
            <option value="paid">Pagos</option>
            <option value="pending">A receber</option>
          </select>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Carregando...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🎸</p>
            <p>Nenhum show encontrado.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((show) => (
              <div key={show.id} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: isMobile ? '12px 14px' : '14px 18px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: isMobile ? 10 : 16,
              }}>
                {/* Date + Info row on mobile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <div style={{ minWidth: 52, textAlign: 'center' }}>
                    <p style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, lineHeight: 1, color: 'var(--accent)' }}>
                      {show.date.slice(8)}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(show.date.slice(5, 7)) - 1]}
                      {' '}{show.date.slice(0, 4)}
                    </p>
                  </div>

                  <div style={{ width: 1, height: 36, background: 'var(--border)', flexShrink: 0 }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: 700, fontSize: 14 }}>{show.client_name}</p>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: statusColors[show.status],
                        background: `${statusColors[show.status]}20`,
                        padding: '2px 7px',
                        borderRadius: 4,
                      }}>{statusLabels[show.status]}</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {show.venue && `${show.venue} · `}
                      {show.city && `${show.city} · `}
                      {show.time} · {formatDuration(show.duration_minutes)}
                    </p>
                  </div>

                  {/* Finance — top right on mobile */}
                  {isMobile && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {show.payment_type === 'portaria' ? (
                        <>
                          <p style={{ fontWeight: 700, fontSize: 13 }}>🎟 {show.portaria_pct}%</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{show.fee > 0 ? formatCurrency(show.fee) : 'A apurar'}</p>
                        </>
                      ) : (
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{formatCurrency(show.fee)}</p>
                      )}
                      <p style={{ fontSize: 11, color: show.is_paid ? 'var(--green)' : 'var(--orange)' }}>
                        {show.is_paid ? '✓ Pago' : '⏳ A receber'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Desktop: finance + actions in same row */}
                {!isMobile && (
                  <>
                    <div style={{ textAlign: 'right', minWidth: 140 }}>
                      {show.payment_type === 'portaria' ? (
                        <>
                          <p style={{ fontWeight: 700, fontSize: 14 }}>🎟 {show.portaria_pct}% portaria</p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {show.fee > 0 ? `Cachê: ${formatCurrency(show.fee)}` : 'Bilheteria a apurar'}
                          </p>
                        </>
                      ) : (
                        <>
                          <p style={{ fontWeight: 700, fontSize: 15 }}>{formatCurrency(show.fee)}</p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Comissão: {formatCurrency(show.fee * show.commission_pct / 100)}
                          </p>
                        </>
                      )}
                      <p style={{ fontSize: 12, color: show.is_paid ? 'var(--green)' : 'var(--orange)' }}>
                        {show.is_paid ? '✓ Pago' : '⏳ A receber'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditing(show); setAdding(false) }} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }}>Editar</button>
                      <button onClick={() => handleDelete(show)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(255,107,107,0.3)', background: 'transparent', color: 'var(--red)', fontSize: 13 }}>Excluir</button>
                    </div>
                  </>
                )}

                {/* Mobile: actions row */}
                {isMobile && (
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <button onClick={() => { setEditing(show); setAdding(false) }} style={{ flex: 1, padding: '8px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>Editar</button>
                    <button onClick={() => handleDelete(show)} style={{ flex: 1, padding: '8px', borderRadius: 7, border: '1px solid rgba(255,107,107,0.3)', background: 'transparent', color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>Excluir</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 20, padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <Stat label="Shows" value={String(filtered.length)} />
            <Stat label="Cachê total" value={formatCurrency(filtered.reduce((s, x) => s + x.fee, 0))} />
            <Stat label="Comissão total" value={formatCurrency(filtered.reduce((s, x) => s + x.fee * x.commission_pct / 100, 0))} />
            <Stat label="A receber" value={formatCurrency(filtered.filter((x) => !x.is_paid).reduce((s, x) => s + x.fee, 0))} color="var(--orange)" />
          </div>
        )}
      </div>
    </Shell>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</p>
      <p style={{ fontWeight: 700, fontSize: 16, color: color ?? 'var(--text)' }}>{value}</p>
    </div>
  )
}
