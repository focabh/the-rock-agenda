'use client'
import { useState, useEffect } from 'react'
import type { Show } from '@/lib/types'
import { MUSICIANS } from '@/lib/types'
import { getShowMusicians, upsertShowMusicians } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'

interface MusicianEntry {
  musician_id: string
  is_participating: boolean
  fee: number
}

interface Props {
  show: Show
  onSaved: () => void
  onBack?: () => void
}

export default function ShowMusiciansForm({ show, onSaved, onBack }: Props) {
  const [entries, setEntries] = useState<MusicianEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const net = show.fee - show.fee * show.commission_pct / 100
  const participating = entries.filter((e) => e.is_participating)
  const suggestedFee = participating.length > 0 ? Math.round(net / participating.length * 100) / 100 : 0
  const totalDistributed = entries.filter((e) => e.is_participating).reduce((s, e) => s + e.fee, 0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const existing = await getShowMusicians(show.id)
        if (existing.length > 0) {
          // Restore saved data
          setEntries(MUSICIANS.map((m) => {
            const ex = existing.find((e) => e.musician_id === m.id)
            return {
              musician_id: m.id,
              is_participating: ex?.is_participating ?? true,
              fee: ex?.fee ?? 0,
            }
          }))
        } else {
          // Default: all participating with equal suggested fee
          const defaultFee = Math.round(net / MUSICIANS.length * 100) / 100
          setEntries(MUSICIANS.map((m) => ({
            musician_id: m.id,
            is_participating: true,
            fee: defaultFee,
          })))
        }
      } catch {
        setEntries(MUSICIANS.map((m) => ({
          musician_id: m.id,
          is_participating: true,
          fee: 0,
        })))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [show.id, net])

  function toggleParticipation(musicianId: string) {
    setEntries((prev) => {
      const updated = prev.map((e) =>
        e.musician_id === musicianId ? { ...e, is_participating: !e.is_participating } : e
      )
      // Auto-suggest fee when count changes
      const count = updated.filter((e) => e.is_participating).length
      const suggested = count > 0 ? Math.round(net / count * 100) / 100 : 0
      return updated.map((e) => ({
        ...e,
        fee: e.musician_id === musicianId && !prev.find(p => p.musician_id === musicianId)?.is_participating
          ? suggested
          : e.fee,
      }))
    })
  }

  function applyEqualSplit() {
    const count = entries.filter((e) => e.is_participating).length
    if (count === 0) return
    const each = Math.round(net / count * 100) / 100
    setEntries((prev) => prev.map((e) => ({ ...e, fee: e.is_participating ? each : e.fee })))
  }

  function setFee(musicianId: string, fee: number) {
    setEntries((prev) => prev.map((e) => e.musician_id === musicianId ? { ...e, fee } : e))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await upsertShowMusicians(
        entries.map((e) => ({ show_id: show.id, ...e }))
      )
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar participação')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Carregando...</p>

  const overBudget = totalDistributed > net + 0.01
  const underBudget = totalDistributed < net - 0.01

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Show summary */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{show.client_name}</p>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>{formatDate(show.date)}</span>
          {show.payment_type === 'portaria' ? (
            <span>🎟 {show.portaria_pct}% portaria{show.fee > 0 ? ` · ${formatCurrency(show.fee)}` : ' · a apurar'}</span>
          ) : (
            <span>💰 Cachê: {formatCurrency(show.fee)}</span>
          )}
          <span>Comissão produtora: {formatCurrency(show.fee * show.commission_pct / 100)}</span>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>Líquido a distribuir: {formatCurrency(net)}</span>
        </div>
      </div>

      {/* Musicians */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Participação por músico
          </p>
          <button
            type="button"
            onClick={applyEqualSplit}
            style={{
              fontSize: 12, color: 'var(--text-muted)', background: 'none',
              border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            }}
          >
            Dividir igualmente
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MUSICIANS.map((m) => {
            const entry = entries.find((e) => e.musician_id === m.id)!
            return (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: entry.is_participating ? 'var(--surface)' : 'rgba(0,0,0,0.2)',
                border: `1px solid ${entry.is_participating ? 'var(--border)' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: 10, padding: '10px 14px',
                opacity: entry.is_participating ? 1 : 0.5,
                transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                }}>
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.role}</p>
                </div>
                {entry.is_participating && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={entry.fee}
                      onChange={(e) => setFee(m.id, Number(e.target.value))}
                      style={{ width: 110, textAlign: 'right', fontSize: 14, fontWeight: 700 }}
                    />
                    {suggestedFee > 0 && Math.abs(entry.fee - suggestedFee) > 0.5 && (
                      <button
                        type="button"
                        onClick={() => setFee(m.id, suggestedFee)}
                        style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Sugerido: {formatCurrency(suggestedFee)}
                      </button>
                    )}
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={entry.is_participating}
                    onChange={() => toggleParticipation(m.id)}
                    style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {entry.is_participating ? 'Presente' : 'Ausente'}
                  </span>
                </label>
              </div>
            )
          })}
        </div>
      </div>

      {/* Budget summary */}
      <div style={{
        background: overBudget ? 'rgba(255,107,107,0.1)' : underBudget ? 'rgba(251,146,60,0.08)' : 'rgba(74,222,128,0.08)',
        border: `1px solid ${overBudget ? 'rgba(255,107,107,0.3)' : underBudget ? 'rgba(251,146,60,0.3)' : 'rgba(74,222,128,0.3)'}`,
        borderRadius: 8, padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Total distribuído:
        </span>
        <span style={{ fontWeight: 700, fontSize: 15, color: overBudget ? 'var(--red)' : underBudget ? 'var(--orange)' : 'var(--green)' }}>
          {formatCurrency(totalDistributed)}
          {overBudget && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6 }}>· excede o líquido em {formatCurrency(totalDistributed - net)}</span>}
          {underBudget && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6 }}>· restam {formatCurrency(net - totalDistributed)} sem atribuição</span>}
        </span>
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 14 }}
          >
            ← Voltar ao show
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14,
            opacity: saving ? 0.7 : 1, cursor: 'pointer',
          }}
        >
          {saving ? 'Salvando...' : 'Confirmar participação'}
        </button>
      </div>
    </div>
  )
}
