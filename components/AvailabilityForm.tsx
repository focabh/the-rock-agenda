'use client'
import { useState } from 'react'
import type { MusicianAvailability, AvailabilityStatus, MusicianId } from '@/lib/types'
import { MUSICIANS } from '@/lib/types'
import { upsertAvailability, deleteAvailability } from '@/lib/db'

interface Props {
  date: string
  existing: MusicianAvailability[]
  onSaved: () => void
}

const LABEL = { fontSize: 12, fontWeight: 600 as const, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

export default function AvailabilityForm({ date, existing, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const existingMap: Record<string, MusicianAvailability> = {}
  existing.forEach((a) => { existingMap[a.musician_id] = a })

  const [entries, setEntries] = useState<Record<string, {
    status: AvailabilityStatus
    reason: string
    sub_name: string
  }>>(
    Object.fromEntries(
      MUSICIANS.map((m) => [
        m.id,
        {
          status: existingMap[m.id]?.status ?? 'available',
          reason: existingMap[m.id]?.reason ?? '',
          sub_name: existingMap[m.id]?.sub_name ?? '',
        },
      ])
    )
  )

  function setEntry(id: string, key: string, value: string) {
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      for (const m of MUSICIANS) {
        const e = entries[m.id]
        if (e.status === 'available') {
          // Remove if it was previously set
          if (existingMap[m.id]) {
            await deleteAvailability(m.id as MusicianId, date)
          }
        } else {
          await upsertAvailability({
            musician_id: m.id as MusicianId,
            date,
            status: e.status,
            reason: e.reason || undefined,
            sub_name: !m.isOptional && e.sub_name ? e.sub_name : undefined,
          })
        }
      }
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {MUSICIANS.map((m) => {
        const e = entries[m.id]
        const isUnavailable = e.status !== 'available'
        return (
          <div key={m.id} style={{
            background: 'var(--surface2)',
            border: `1px solid ${isUnavailable ? 'rgba(248,113,113,0.3)' : 'var(--border)'}`,
            borderRadius: 10,
            padding: 14,
            transition: 'border-color 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isUnavailable ? 12 : 0 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {m.role}
                  {m.isOptional && <span style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 11 }}>(opcional)</span>}
                </p>
              </div>
              <select
                value={e.status}
                onChange={(ev) => setEntry(m.id, 'status', ev.target.value)}
                style={{ width: 'auto', minWidth: 180 }}
              >
                <option value="available">✓ Disponível</option>
                <option value="unavailable">✗ Indisponível (pessoal)</option>
                <option value="other_band">🎵 Outro compromisso</option>
              </select>
            </div>

            {isUnavailable && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={LABEL}>Motivo (opcional)</label>
                  <input
                    placeholder="Ex: viagem, compromisso familiar..."
                    value={e.reason}
                    onChange={(ev) => setEntry(m.id, 'reason', ev.target.value)}
                    style={{ marginTop: 4 }}
                  />
                </div>
                {!m.isOptional && (
                  <div>
                    <label style={LABEL}>Nome do Sub</label>
                    <input
                      placeholder="Nome de quem vai substituir"
                      value={e.sub_name}
                      onChange={(ev) => setEntry(m.id, 'sub_name', ev.target.value)}
                      style={{ marginTop: 4, borderColor: !e.sub_name ? 'rgba(248,113,113,0.5)' : 'var(--border)' }}
                    />
                    {!e.sub_name && (
                      <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
                        ⚠ Sub necessário — sem substituto a banda não pode tocar
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={loading}
        style={{
          padding: '11px 24px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--accent)',
          color: 'var(--bg)',
          fontWeight: 700,
          fontSize: 14,
          opacity: loading ? 0.7 : 1,
          alignSelf: 'flex-end',
        }}
      >
        {loading ? 'Salvando...' : 'Salvar Disponibilidade'}
      </button>
    </div>
  )
}
