'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Shell from '@/components/Shell'
import { supabase } from '@/lib/supabase'
import { getShows, updateShow } from '@/lib/db'
import type { Show } from '@/lib/types'
import { MUSICIANS } from '@/lib/types'
import { formatCurrency, formatDate, MONTH_NAMES } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAuth } from '@/components/AuthProvider'

const NUM_MUSICIANS = MUSICIANS.length // 5

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
  const [uploadingForShow, setUploadingForShow] = useState<string | null>(null)
  const [attachOnly, setAttachOnly] = useState(false)
  const [proofError, setProofError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const proofInputRef = useRef<HTMLInputElement>(null)

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

  async function handleProofFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadingForShow) { setUploadingForShow(null); setAttachOnly(false); return }

    setUploading(true)
    setProofError(null)
    const ext = file.name.split('.').pop() ?? 'pdf'
    const path = `${uploadingForShow}/proof.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('payment-proofs')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setProofError('Erro ao enviar comprovante: ' + uploadErr.message)
      setUploading(false); setUploadingForShow(null); setAttachOnly(false)
      e.target.value = ''
      return
    }

    const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(path)
    await updateShow(uploadingForShow, {
      payment_proof_url: urlData.publicUrl,
      ...(attachOnly ? {} : { is_paid: true }),
    })
    await load()
    setUploading(false); setUploadingForShow(null); setAttachOnly(false)
    e.target.value = ''
  }

  function triggerProofUpload(showId: string, attachOnlyMode: boolean) {
    setUploadingForShow(showId)
    setAttachOnly(attachOnlyMode)
    proofInputRef.current?.click()
  }

  async function handleMarkPaid(show: Show) {
    if (show.is_paid) {
      await updateShow(show.id, { is_paid: false })
      await load()
      return
    }
    if (show.payment_proof_url) {
      await updateShow(show.id, { is_paid: true })
      await load()
      return
    }
    // No proof yet — upload triggers pay
    triggerProofUpload(show.id, false)
  }

  // --- Derived metrics ---
  const paidShows = shows.filter((s) => s.is_paid)
  const pendingShows = shows.filter((s) => !s.is_paid)

  const totalFee = shows.reduce((s, x) => s + x.fee, 0)
  const totalCommission = shows.reduce((s, x) => s + (x.fee * x.commission_pct) / 100, 0)
  const paidFee = paidShows.reduce((s, x) => s + x.fee, 0)
  const paidCommission = paidShows.reduce((s, x) => s + (x.fee * x.commission_pct) / 100, 0)
  const paidNet = paidFee - paidCommission
  const pendingFee = pendingShows.reduce((s, x) => s + x.fee, 0)
  const avgFee = shows.length > 0 ? totalFee / shows.length : 0
  const perMusician = paidNet / NUM_MUSICIANS

  // Group by month
  const byMonth: Record<number, Show[]> = {}
  shows.forEach((s) => {
    const m = Number(s.date.slice(5, 7))
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(s)
  })

  return (
    <Shell>
      <input
        ref={proofInputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={handleProofFileSelected}
      />

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, flex: 1, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Financeiro</h1>
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>

        {proofError && (
          <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{proofError}</p>
        )}

        {/* Mini dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          <Card label="Cachê total" value={formatCurrency(totalFee)} sub={`${shows.length} show${shows.length !== 1 ? 's' : ''} confirmados`} />
          <Card label="Média por show" value={formatCurrency(avgFee)} sub={shows.length > 0 ? `Maior: ${formatCurrency(Math.max(...shows.map(s => s.fee)))}` : '—'} />
          <Card label="Comissão produtora" value={formatCurrency(totalCommission)} sub={shows.length > 0 ? `Média ${(shows.reduce((s,x)=>s+x.commission_pct,0)/shows.length).toFixed(1)}%` : '—'} />
          <Card label="Líquido banda (pago)" value={formatCurrency(paidNet)} sub={`Bruto pago: ${formatCurrency(paidFee)}`} color="var(--green)" />
          <Card label="A receber" value={formatCurrency(pendingFee)} sub={`${pendingShows.length} show${pendingShows.length !== 1 ? 's' : ''} pendentes`} color={pendingFee > 0 ? 'var(--orange)' : undefined} />
          <Card label="Pago ✓" value={formatCurrency(paidFee)} sub={`Comissão paga: ${formatCurrency(paidCommission)}`} color="var(--text)" />
        </div>

        {/* Per musician */}
        {paidShows.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionTitle>Distribuição por Músico</SectionTitle>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Baseado em {paidShows.length} show{paidShows.length !== 1 ? 's' : ''} pagos · divisão igual entre {NUM_MUSICIANS} músicos
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MUSICIANS.map((m) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                  }}>
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.role}{m.isOptional ? ' · opcional' : ''}</p>
                  </div>
                  <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--green)', fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {formatCurrency(perMusician)}
                  </p>
                </div>
              ))}
              {/* Produtora row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(204,26,26,0.06)', border: '1px solid rgba(204,26,26,0.25)', borderRadius: 10, padding: '10px 16px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(204,26,26,0.15)', border: '1px solid rgba(204,26,26,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>
                  🎬
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>Produtora</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Comissão média {paidShows.length > 0 ? (paidShows.reduce((s,x)=>s+x.commission_pct,0)/paidShows.length).toFixed(1) : 0}%
                  </p>
                </div>
                <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent)', fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {formatCurrency(paidCommission)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Shows by month */}
        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Carregando...</p>
        ) : shows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>💰</p>
            <p>Nenhum show registrado em {filterYear}.</p>
          </div>
        ) : (
          <>
            <SectionTitle>Histórico por Mês</SectionTitle>
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

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {monthShows.map((show) => (
                          <ShowRow
                            key={show.id}
                            show={show}
                            isMobile={isMobile}
                            uploading={uploading && uploadingForShow === show.id}
                            onMarkPaid={() => handleMarkPaid(show)}
                            onAttachProof={() => triggerProofUpload(show.id, true)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}

function ShowRow({
  show, isMobile, uploading, onMarkPaid, onAttachProof,
}: {
  show: Show
  isMobile: boolean
  uploading: boolean
  onMarkPaid: () => void
  onAttachProof: () => void
}) {
  const netPerMusician = (show.fee - show.fee * show.commission_pct / 100) / NUM_MUSICIANS

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${show.is_paid ? 'rgba(74,222,128,0.2)' : 'var(--border)'}`,
      borderRadius: 10,
      padding: isMobile ? '12px 14px' : '12px 16px',
    }}>
      {isMobile ? (
        // Mobile: stacked
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{show.client_name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {formatDate(show.date)}{show.venue ? ` · ${show.venue}` : ''}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {show.payment_type === 'portaria' ? (
                <>
                  <p style={{ fontWeight: 700, fontSize: 13 }}>🎟 {show.portaria_pct}%</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{show.fee > 0 ? formatCurrency(show.fee) : 'A apurar'}</p>
                </>
              ) : (
                <>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{formatCurrency(show.fee)}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Comissão: {formatCurrency(show.fee * show.commission_pct / 100)}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--green)' }}>
                    /músico: {formatCurrency(netPerMusician)}
                  </p>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ProofArea show={show} uploading={uploading} onAttach={onAttachProof} />
            <button
              onClick={onMarkPaid}
              disabled={uploading}
              style={paidBtnStyle(show.is_paid)}
            >
              {uploading ? '⏳ Enviando...' : show.is_paid ? '✓ Pago' : '📎 Marcar pago'}
            </button>
          </div>
        </div>
      ) : (
        // Desktop: single row
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>{formatDate(show.date)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>{show.client_name}</p>
            {show.venue && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{show.venue}{show.city ? ` · ${show.city}` : ''}</p>}
          </div>
          <div style={{ textAlign: 'right', minWidth: 150 }}>
            {show.payment_type === 'portaria' ? (
              <>
                <p style={{ fontWeight: 700 }}>🎟 {show.portaria_pct}% portaria</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {show.fee > 0 ? `Cachê: ${formatCurrency(show.fee)}` : 'Bilheteria a apurar'}
                </p>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 700 }}>{formatCurrency(show.fee)}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Comissão: {formatCurrency(show.fee * show.commission_pct / 100)}
                  &nbsp;·&nbsp;
                  <span style={{ color: 'var(--green)' }}>/músico: {formatCurrency(netPerMusician)}</span>
                </p>
              </>
            )}
          </div>
          <ProofArea show={show} uploading={uploading} onAttach={onAttachProof} />
          <button
            onClick={onMarkPaid}
            disabled={uploading}
            style={paidBtnStyle(show.is_paid)}
          >
            {uploading ? '⏳ Enviando...' : show.is_paid ? '✓ Pago' : '📎 Marcar pago'}
          </button>
        </div>
      )}
    </div>
  )
}

function ProofArea({ show, uploading, onAttach }: { show: Show; uploading: boolean; onAttach: () => void }) {
  if (show.payment_proof_url) {
    return (
      <a
        href={show.payment_proof_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 12, color: 'var(--blue)', textDecoration: 'none',
          padding: '5px 10px', borderRadius: 6,
          border: '1px solid rgba(96,165,250,0.3)',
          background: 'rgba(96,165,250,0.08)',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        📄 Comprovante
      </a>
    )
  }
  return (
    <button
      onClick={onAttach}
      disabled={uploading}
      title="Anexar comprovante de pagamento"
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 12, color: 'var(--text-muted)',
        padding: '5px 10px', borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'transparent',
        whiteSpace: 'nowrap', flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      📎 Anexar
    </button>
  )
}

function paidBtnStyle(isPaid: boolean): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0,
    border: `1px solid ${isPaid ? 'rgba(74,222,128,0.4)' : 'rgba(251,146,60,0.4)'}`,
    background: isPaid ? 'rgba(74,222,128,0.1)' : 'rgba(251,146,60,0.1)',
    color: isPaid ? 'var(--green)' : 'var(--orange)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
      {children}
    </p>
  )
}

function Card({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</p>}
    </div>
  )
}
