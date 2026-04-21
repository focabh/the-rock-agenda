'use client'
import { useState } from 'react'
import type { Show, ShowStatus } from '@/lib/types'
import { createShow, updateShow } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Props {
  date?: string
  existing?: Show
  onSaved: (show: Show) => void
  onCancel?: () => void
}

const FIELD_STYLE = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
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
    payment_type: (existing?.payment_type ?? 'cache') as 'cache' | 'portaria',
    fee: existing?.fee ?? 0,
    portaria_pct: existing?.portaria_pct ?? 50,
    ticket_revenue: existing?.ticket_revenue ?? 0,
    commission_pct: existing?.commission_pct ?? 10,
    is_paid: existing?.is_paid ?? false,
    status: (existing?.status ?? 'pending') as ShowStatus,
    notes: existing?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }))

  const calculatedFee = form.payment_type === 'portaria' && form.ticket_revenue > 0
    ? Math.round(form.ticket_revenue * form.portaria_pct / 100 * 100) / 100
    : form.fee

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_name.trim()) { setError('Nome do contratante é obrigatório'); return }
    if (!form.date) { setError('Data é obrigatória'); return }
    if (form.payment_type === 'portaria' && (form.portaria_pct <= 0 || form.portaria_pct > 100)) {
      setError('Percentual de portaria deve ser entre 1 e 100'); return
    }
    setLoading(true)
    setError('')
    try {
      const payload = {
        ...form,
        fee: calculatedFee,
      }
      let saved: Show
      if (existing) {
        saved = await updateShow(existing.id, payload)
      } else {
        saved = await createShow(payload)
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
          <label style={LABEL}>Local do show</label>
          <input placeholder="Nome do local ou casa de show" value={form.venue} onChange={(e) => set('venue', e.target.value)} />
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

      {/* Payment type toggle */}
      <div style={FIELD_STYLE}>
        <label style={LABEL}>Tipo de pagamento</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['cache', 'portaria'] as const).map((t) => (
            <label key={t} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${form.payment_type === t ? 'var(--accent)' : 'var(--border)'}`,
              background: form.payment_type === t ? 'rgba(204,26,26,0.1)' : 'var(--surface2)',
              transition: 'all 0.15s',
            }}>
              <input
                type="radio"
                name="payment_type"
                value={t}
                checked={form.payment_type === t}
                onChange={() => set('payment_type', t)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {t === 'cache' ? '💵 Cachê fixo' : '🎟 Portaria (%)'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Cachê fixo fields */}
      {form.payment_type === 'cache' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div style={FIELD_STYLE}>
            <label style={LABEL}>Cachê (R$)</label>
            <input
              type="number" min={0} step={50}
              value={form.fee}
              onChange={(e) => set('fee', Number(e.target.value))}
            />
          </div>
          <div style={FIELD_STYLE}>
            <label style={LABEL}>Comissão da produtora (%)</label>
            <input
              type="number" min={0} max={100} step={1}
              value={form.commission_pct}
              onChange={(e) => set('commission_pct', Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Portaria fields */}
      {form.payment_type === 'portaria' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={FIELD_STYLE}>
              <label style={LABEL}>Percentual da portaria (%)</label>
              <input
                type="number" min={1} max={100} step={1}
                value={form.portaria_pct}
                onChange={(e) => set('portaria_pct', Number(e.target.value))}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ex: 50 = banda recebe 50% da bilheteria</p>
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL}>Comissão da produtora (%)</label>
              <input
                type="number" min={0} max={100} step={1}
                value={form.commission_pct}
                onChange={(e) => set('commission_pct', Number(e.target.value))}
              />
            </div>
          </div>
          <div style={FIELD_STYLE}>
            <label style={LABEL}>Total arrecadado na bilheteria (R$)</label>
            <input
              type="number" min={0} step={100}
              value={form.ticket_revenue}
              onChange={(e) => set('ticket_revenue', Number(e.target.value))}
              placeholder="Preencher após o show"
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pode ser preenchido depois do show</p>
          </div>
          {/* Calculated preview */}
          <div style={{
            background: 'rgba(204,26,26,0.08)', border: '1px solid rgba(204,26,26,0.2)',
            borderRadius: 8, padding: '10px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Cachê calculado ({form.portaria_pct}% de {formatCurrency(form.ticket_revenue)}):
            </span>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent)', fontFamily: "'Barlow Condensed', sans-serif" }}>
              {formatCurrency(calculatedFee)}
            </span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div style={FIELD_STYLE}>
          <label style={LABEL}>Situação do show</label>
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
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: 'var(--bg)',
            fontWeight: 700, fontSize: 14, opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Salvando...' : existing ? 'Atualizar' : 'Cadastrar Show'}
        </button>
      </div>
    </form>
  )
}
