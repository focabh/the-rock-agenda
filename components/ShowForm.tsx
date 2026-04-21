'use client'
import { useState } from 'react'
import type { Show, ShowStatus } from '@/lib/types'
import { createShow, updateShow } from '@/lib/db'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Props {
  date?: string
  existing?: Show
  onSaved: (show: Show) => void
  onCancel?: () => void
}

const FIELD_STYLE = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
}
const LABEL = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

export default function ShowForm({ date, existing, onSaved, onCancel }: Props) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState({
    date: existing?.date ?? date ?? '',
    time: existing?.time ?? '20:00',
    duration_minutes: existing?.duration_minutes ?? 120,
    client_name: existing?.client_name ?? '',
    venue: existing?.venue ?? '',
    city: existing?.city ?? '',
    fee: existing?.fee ?? 0,
    commission_pct: existing?.commission_pct ?? 10,
    is_paid: existing?.is_paid ?? false,
    status: (existing?.status ?? 'pending') as ShowStatus,
    notes: existing?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_name.trim()) { setError('Nome do contratante é obrigatório'); return }
    if (!form.date) { setError('Data é obrigatória'); return }
    setLoading(true)
    setError('')
    try {
      let saved: Show
      if (existing) {
        saved = await updateShow(existing.id, form)
      } else {
        saved = await createShow(form)
      }
      onSaved(saved)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div style={FIELD_STYLE}>
          <label style={LABEL}>Data</label>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} min="2026-01-01" max="2027-12-31" />
        </div>
        <div style={FIELD_STYLE}>
          <label style={LABEL}>Horário</label>
          <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
        </div>
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL}>Contratante *</label>
        <input
          placeholder="Nome do contratante / evento"
          value={form.client_name}
          onChange={(e) => set('client_name', e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div style={FIELD_STYLE}>
          <label style={LABEL}>Local / Venue</label>
          <input placeholder="Nome do local" value={form.venue} onChange={(e) => set('venue', e.target.value)} />
        </div>
        <div style={FIELD_STYLE}>
          <label style={LABEL}>Cidade</label>
          <input placeholder="Cidade" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL}>Duração do show</label>
        <select value={form.duration_minutes} onChange={(e) => set('duration_minutes', Number(e.target.value))}>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>1 hora</option>
          <option value={90}>1h30</option>
          <option value={120}>2 horas</option>
          <option value={150}>2h30</option>
          <option value={180}>3 horas</option>
          <option value={240}>4 horas</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div style={FIELD_STYLE}>
          <label style={LABEL}>Cachê (R$)</label>
          <input
            type="number"
            min={0}
            step={50}
            value={form.fee}
            onChange={(e) => set('fee', Number(e.target.value))}
          />
        </div>
        <div style={FIELD_STYLE}>
          <label style={LABEL}>Comissão da produtora (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={form.commission_pct}
            onChange={(e) => set('commission_pct', Number(e.target.value))}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div style={FIELD_STYLE}>
          <label style={LABEL}>Status do show</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value as ShowStatus)}>
            <option value="pending">Pendente</option>
            <option value="confirmed">Confirmado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div style={FIELD_STYLE}>
          <label style={LABEL}>Pagamento</label>
          <select value={String(form.is_paid)} onChange={(e) => set('is_paid', e.target.value === 'true')}>
            <option value="false">⏳ Pendente</option>
            <option value="true">✓ Pago</option>
          </select>
        </div>
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL}>Observações</label>
        <textarea
          rows={2}
          placeholder="Informações adicionais..."
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 14 }}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent)',
            color: 'var(--bg)',
            fontWeight: 700,
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Salvando...' : existing ? 'Atualizar' : 'Cadastrar Show'}
        </button>
      </div>
    </form>
  )
}
