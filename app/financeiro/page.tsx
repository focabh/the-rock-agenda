'use client'
import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/Shell'
import { getShows, updateShow } from '@/lib/db'
import type { Show } from '@/lib/types'
import { formatCurrency, formatDate, MONTH_NAMES } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAuth } from '@/components/AuthProvider'

export default function FinanceiroPage() {
  const { isAdmin, isProducer } = useAuth()
  const isMobile = useIsMobile()

  if (!isAdmin && !isProducer) return (
    <Shell>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        <p style={{ fontSize: 32, marginBottom: 8 }}>🔒</p>
        <p>Acesso restrito a administradores e produtores.</p>
      </div>
    </Shell>
  )
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [filterYear, setFilterYear] = useState<number>(
    new Date().getFullYear() >= 2026 ? Math.min(new Date().getFullYear(), 2027) : 2026
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getShows(filterYear)
      setShows(data.filter((s) => s.status !== 'cancelled'))
    } catch {
      setShows([])
    } finally {
      setLoading(false)
    }
  }, [filterYear])

  useEffect(() => { load() }, [load])

  async function togglePaid(show: Show) {
    await updateShow(show.id, { is_paid: !show.is_paid })
    load()
  }

  const totalFee = shows.reduce((s, x) => s + x.fee, 0)
  const totalCommission = shows.reduce((s, x) => s + (x.fee * x.commission_pct) / 100, 0)
  const totalPaid = shows.filter((x) => x.is_paid).reduce((s, x) => s + x.fee, 0)
  const totalPending = shows.filter((x) => !x.is_paid).reduce((s, x) => s + x.fee, 0)
  const bandNet = totalFee - totalCommission

  // Group by month
  const byMonth: Record<number, Show[]> = {}
  shows.forEach((s) => {
    const m = Number(s.date.slice(5, 7))
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(s)
  })

  return (
    <Shell>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, flex: 1, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Financeiro</h1>
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          <Card label="Shows confirmados" value={String(shows.length)} sub="no período" />
          <Card label="Cachê total" value={formatCurrency(totalFee)} sub={`Banda: ${formatCurrency(bandNet)}`} />
          <Card label="Comissão produtora" value={formatCurrency(totalCommission)} sub={`Média: ${shows.length > 0 ? (shows.reduce((s,x)=>s+x.commission_pct,0)/shows.length).toFixed(1) : 0}%`} />
          <Card label="A receber" value={formatCurrency(totalPending)} sub={`Pago: ${formatCurrency(totalPaid)}`} color="var(--orange)" />
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Carregando...</p>
        ) : shows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>💰</p>
            <p>Nenhum show registrado em {filterYear}.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {Object.entries(byMonth)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([m, monthShows]) => {
                const mFee = monthShows.reduce((s, x) => s + x.fee, 0)
                const mComm = monthShows.reduce((s, x) => s + (x.fee * x.commission_pct) / 100, 0)
                const mPending = monthShows.filter((x) => !x.is_paid).reduce((s, x) => s + x.fee, 0)
                return (
                  <div key={m}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {MONTH_NAMES[Number(m) - 1]}
                      </h3>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {monthShows.length} show{monthShows.length !== 1 ? 's' : ''} · {formatCurrency(mFee)} · comissão {formatCurrency(mComm)}
                        {mPending > 0 && ` · a receber ${formatCurrency(mPending)}`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {monthShows.map((show) => (
                        <div key={show.id} style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                        }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>{formatDate(show.date)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 14 }}>{show.client_name}</p>
                            {show.venue && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{show.venue}{show.city ? ` · ${show.city}` : ''}</p>}
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 130 }}>
                            <p style={{ fontWeight: 700 }}>{formatCurrency(show.fee)}</p>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Comissão: {formatCurrency(show.fee * show.commission_pct / 100)}</p>
                          </div>
                          <button
                            onClick={() => togglePaid(show)}
                            style={{
                              padding: '7px 14px',
                              borderRadius: 8,
                              border: `1px solid ${show.is_paid ? 'rgba(74,222,128,0.4)' : 'rgba(251,146,60,0.4)'}`,
                              background: show.is_paid ? 'rgba(74,222,128,0.1)' : 'rgba(251,146,60,0.1)',
                              color: show.is_paid ? 'var(--green)' : 'var(--orange)',
                              fontSize: 12,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {show.is_paid ? '✓ Pago' : '⏳ Marcar pago'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </Shell>
  )
}

function Card({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 18px',
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</p>}
    </div>
  )
}
