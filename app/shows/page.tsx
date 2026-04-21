'use client'
import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/Shell'
import ShowForm from '@/components/ShowForm'
import { getShows, deleteShow } from '@/lib/db'
import type { Show } from '@/lib/types'
import { formatDate, formatCurrency, formatDuration } from '@/lib/utils'

export default function ShowsPage() {
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Show | null>(null)
  const [adding, setAdding] = useState(false)
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
          <h1 style={{ fontSize: 32, fontWeight: 800, flex: 1, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Shows</h1>
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

        {/* New/Edit form */}
        {(adding || editing) && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              {editing ? 'Editar Show' : 'Novo Show'}
            </h2>
            <ShowForm
              existing={editing ?? undefined}
              onSaved={() => { setAdding(false); setEditing(null); load() }}
              onCancel={() => { setAdding(false); setEditing(null) }}
            />
          </div>
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
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                transition: 'border-color 0.15s',
              }}>
                {/* Date */}
                <div style={{ minWidth: 70, textAlign: 'center' }}>
                  <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: 'var(--accent)' }}>
                    {show.date.slice(8)}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(show.date.slice(5, 7)) - 1]}
                    {' '}{show.date.slice(0, 4)}
                  </p>
                </div>

                <div style={{ width: 1, height: 40, background: 'var(--border)' }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>{show.client_name}</p>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: statusColors[show.status],
                      background: `${statusColors[show.status]}20`,
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}>{statusLabels[show.status]}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {show.venue && `${show.venue} · `}
                    {show.city && `${show.city} · `}
                    {show.time} · {formatDuration(show.duration_minutes)}
                  </p>
                </div>

                {/* Finance */}
                <div style={{ textAlign: 'right', minWidth: 130 }}>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{formatCurrency(show.fee)}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Comissão: {formatCurrency(show.fee * show.commission_pct / 100)}
                  </p>
                  <p style={{ fontSize: 12, color: show.is_paid ? 'var(--green)' : 'var(--orange)' }}>
                    {show.is_paid ? '✓ Pago' : '⏳ A receber'}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { setEditing(show); setAdding(false) }}
                    style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(show)}
                    style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(248,113,113,0.3)', background: 'transparent', color: 'var(--red)', fontSize: 13 }}
                  >
                    Excluir
                  </button>
                </div>
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
