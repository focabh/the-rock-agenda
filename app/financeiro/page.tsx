'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Shell from '@/components/Shell'
import { supabase } from '@/lib/supabase'
import { getShows, updateShow, getShowMusiciansForShows } from '@/lib/db'
import type { Show, ShowMusician } from '@/lib/types'
import { MUSICIANS } from '@/lib/types'
import { formatCurrency, formatDate, MONTH_NAMES } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAuth } from '@/components/AuthProvider'

export default function FinanceiroPage() {
  const { isAdmin, isProducer, musicianId: myMusicianId } = useAuth()
  const canManageAll = isAdmin || isProducer
  const isMobile = useIsMobile()

  const [shows, setShows] = useState<Show[]>([])
  const [showMusicians, setShowMusicians] = useState<ShowMusician[]>([])
  const [loading, setLoading] = useState(true)
  const [filterYear, setFilterYear] = useState<number>(
    new Date().getFullYear() >= 2026 ? Math.min(new Date().getFullYear(), 2027) : 2026
  )
  const [activeMusicianFilter, setActiveMusicianFilter] = useState<string>('all')
  const [expandedMusician, setExpandedMusician] = useState<string | null>(null)
  const [uploadingForShow, setUploadingForShow] = useState<string | null>(null)
  const [attachOnly, setAttachOnly] = useState(false)
  const [proofError, setProofError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const proofInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getShows(filterYear)
      const nonCancelled = data.filter((s) => s.status !== 'cancelled')
      setShows(nonCancelled)
      const sm = await getShowMusiciansForShows(nonCancelled.map((s) => s.id))
      setShowMusicians(sm)
    } catch {
      setShows([]); setShowMusicians([])
    } finally {
      setLoading(false)
    }
  }, [filterYear])

  useEffect(() => { load() }, [load])

  // --- Proof upload handlers ---
  async function handleProofFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadingForShow) { setUploadingForShow(null); setAttachOnly(false); return }
    setUploading(true); setProofError(null)
    const ext = file.name.split('.').pop() ?? 'pdf'
    const path = `${uploadingForShow}/proof.${ext}`
    const { error: uploadErr } = await supabase.storage.from('payment-proofs').upload(path, file, { upsert: true })
    if (uploadErr) { setProofError('Erro ao enviar comprovante'); setUploading(false); setUploadingForShow(null); setAttachOnly(false); e.target.value = ''; return }
    const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(path)
    await updateShow(uploadingForShow, { payment_proof_url: urlData.publicUrl, ...(attachOnly ? {} : { is_paid: true }) })
    await load()
    setUploading(false); setUploadingForShow(null); setAttachOnly(false); e.target.value = ''
  }

  function triggerProofUpload(showId: string, attachOnlyMode: boolean) {
    setUploadingForShow(showId); setAttachOnly(attachOnlyMode); proofInputRef.current?.click()
  }

  async function handleMarkPaid(show: Show) {
    if (show.is_paid) { await updateShow(show.id, { is_paid: false }); await load(); return }
    if (show.payment_proof_url) { await updateShow(show.id, { is_paid: true }); await load(); return }
    triggerProofUpload(show.id, false)
  }

  // --- Band-level calculations ---
  const paidShows = shows.filter((s) => s.is_paid)
  const pendingShows = shows.filter((s) => !s.is_paid)
  const totalFee = shows.reduce((s, x) => s + x.fee, 0)
  const totalCommission = shows.reduce((s, x) => s + x.fee * x.commission_pct / 100, 0)
  const paidFee = paidShows.reduce((s, x) => s + x.fee, 0)
  const paidCommission = paidShows.reduce((s, x) => s + x.fee * x.commission_pct / 100, 0)
  const pendingFee = pendingShows.reduce((s, x) => s + x.fee, 0)
  const avgFee = shows.length > 0 ? totalFee / shows.length : 0

  // --- Per-musician calculations from show_musicians ---
  function musicianTotal(mid: string, paid: boolean) {
    return showMusicians
      .filter((sm) => sm.musician_id === mid && sm.is_participating)
      .reduce((sum, sm) => {
        const show = shows.find((s) => s.id === sm.show_id)
        if (!show) return sum
        if (paid && show.is_paid) return sum + sm.fee
        if (!paid && !show.is_paid) return sum + sm.fee
        return sum
      }, 0)
  }

  function musicianShows(mid: string) {
    return showMusicians
      .filter((sm) => sm.musician_id === mid && sm.is_participating)
      .map((sm) => ({ sm, show: shows.find((s) => s.id === sm.show_id) }))
      .filter((x): x is { sm: ShowMusician; show: Show } => !!x.show)
      .sort((a, b) => a.show.date.localeCompare(b.show.date))
  }

  // Group shows by month
  const byMonth: Record<number, Show[]> = {}
  shows.forEach((s) => {
    const m = Number(s.date.slice(5, 7))
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(s)
  })

  // Shows filtered by musician (for per-musician tab in show list)
  const filteredShows = activeMusicianFilter === 'all'
    ? shows
    : shows.filter((s) => showMusicians.some((sm) => sm.show_id === s.id && sm.musician_id === activeMusicianFilter && sm.is_participating))

  const byMonthFiltered: Record<number, Show[]> = {}
  filteredShows.forEach((s) => {
    const m = Number(s.date.slice(5, 7))
    if (!byMonthFiltered[m]) byMonthFiltered[m] = []
    byMonthFiltered[m].push(s)
  })

  if (!canManageAll && !myMusicianId) return (
    <Shell>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        <p style={{ fontSize: 32, marginBottom: 8 }}>🔒</p>
        <p>Acesso restrito.</p>
      </div>
    </Shell>
  )

  return (
    <Shell>
      <input ref={proofInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleProofFileSelected} />

      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, flex: 1, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Financeiro</h1>
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>

        {proofError && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{proofError}</p>}

        {/* ── Band dashboard (everyone sees this) ── */}
        <SectionLabel>Resumo da Banda — {filterYear}</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10, marginBottom: 28 }}>
          <Card label="Cachê total" value={formatCurrency(totalFee)} sub={`${shows.length} show${shows.length !== 1 ? 's' : ''} confirmados`} />
          <Card label="Média por show" value={formatCurrency(avgFee)} sub={shows.length > 0 ? `Maior: ${formatCurrency(Math.max(...shows.map(s => s.fee)))}` : '—'} />
          <Card label="Comissão produtora" value={formatCurrency(totalCommission)} sub={`Paga: ${formatCurrency(paidCommission)}`} />
          <Card label="Pago ✓" value={formatCurrency(paidFee)} sub={`${paidShows.length} show${paidShows.length !== 1 ? 's' : ''}`} color="var(--green)" />
          <Card label="A receber" value={formatCurrency(pendingFee)} sub={`${pendingShows.length} show${pendingShows.length !== 1 ? 's' : ''} pendentes`} color={pendingFee > 0 ? 'var(--orange)' : undefined} />
          <Card label="Líquido pago (banda)" value={formatCurrency(paidFee - paidCommission)} sub="após comissão" color="var(--text)" />
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Carregando...</p>
        ) : (
          <>
            {/* ── Admin: per-musician section ── */}
            {canManageAll && (
              <div style={{ marginBottom: 28 }}>
                <SectionLabel>Por Músico</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {MUSICIANS.map((m) => {
                    const paid = musicianTotal(m.id, true)
                    const pending = musicianTotal(m.id, false)
                    const isExpanded = expandedMusician === m.id
                    const mShows = musicianShows(m.id)
                    const isMe = m.id === myMusicianId
                    return (
                      <div key={m.id} style={{
                        background: isMe ? 'rgba(204,26,26,0.06)' : 'var(--surface)',
                        border: `1px solid ${isMe ? 'rgba(204,26,26,0.25)' : 'var(--border)'}`,
                        borderRadius: 10, overflow: 'hidden',
                      }}>
                        <button
                          onClick={() => setExpandedMusician(isExpanded ? null : m.id)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                            {m.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                              {m.name} {isMe && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 4 }}>· Você</span>}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.role}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontWeight: 700, color: 'var(--green)', fontSize: 14 }}>{formatCurrency(paid)}</p>
                            {pending > 0 && <p style={{ fontSize: 11, color: 'var(--orange)' }}>+ {formatCurrency(pending)} a receber</p>}
                          </div>
                          <span style={{ fontSize: 16, color: 'var(--text-muted)', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                        </button>
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px 12px' }}>
                            {mShows.length === 0 ? (
                              <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Sem participação confirmada neste período.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {mShows.map(({ sm, show }) => (
                                  <div key={sm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>{formatDate(show.date)}</span>
                                    <span style={{ flex: 1, fontSize: 13 }}>{show.client_name}</span>
                                    <span style={{ fontSize: 12, color: show.is_paid ? 'var(--green)' : 'var(--orange)', fontWeight: 600 }}>
                                      {formatCurrency(sm.fee)} {show.is_paid ? '✓' : '⏳'}
                                    </span>
                                  </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, gap: 16, fontSize: 12, fontWeight: 600 }}>
                                  <span style={{ color: 'var(--green)' }}>Pago: {formatCurrency(paid)}</span>
                                  {pending > 0 && <span style={{ color: 'var(--orange)' }}>A receber: {formatCurrency(pending)}</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Produtora */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(204,26,26,0.06)', border: '1px solid rgba(204,26,26,0.2)', borderRadius: 10, padding: '10px 16px' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'rgba(204,26,26,0.15)', border: '1px solid rgba(204,26,26,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎬</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Produtora</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Comissão sobre cachês</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>{formatCurrency(paidCommission)}</p>
                      {(totalCommission - paidCommission) > 0 && <p style={{ fontSize: 11, color: 'var(--orange)' }}>+ {formatCurrency(totalCommission - paidCommission)} a receber</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Regular user: own participation ── */}
            {!canManageAll && myMusicianId && (
              <div style={{ marginBottom: 28 }}>
                <SectionLabel>Minha Participação</SectionLabel>
                {(() => {
                  const myPaid = musicianTotal(myMusicianId, true)
                  const myPending = musicianTotal(myMusicianId, false)
                  const myShows = musicianShows(myMusicianId)
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                        <Card label="Recebido ✓" value={formatCurrency(myPaid)} color="var(--green)" />
                        <Card label="A receber" value={formatCurrency(myPending)} color={myPending > 0 ? 'var(--orange)' : undefined} />
                      </div>
                      {myShows.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sem participação confirmada neste período.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {myShows.map(({ sm, show }) => (
                            <div key={sm.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>{formatDate(show.date)}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 600, fontSize: 13 }}>{show.client_name}</p>
                                {show.venue && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{show.venue}</p>}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ fontWeight: 700, fontSize: 14, color: show.is_paid ? 'var(--green)' : 'var(--orange)' }}>
                                  {formatCurrency(sm.fee)}
                                </p>
                                <p style={{ fontSize: 11, color: show.is_paid ? 'var(--green)' : 'var(--orange)' }}>
                                  {show.is_paid ? '✓ Pago' : '⏳ A receber'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            {/* ── Show list (admin: filterable by musician; all: monthly view) ── */}
            {canManageAll && shows.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <SectionLabel style={{ marginBottom: 0 }}>Histórico por Mês</SectionLabel>
                  <select
                    value={activeMusicianFilter}
                    onChange={(e) => setActiveMusicianFilter(e.target.value)}
                    style={{ width: 'auto', marginLeft: 'auto' }}
                  >
                    <option value="all">Todos os músicos</option>
                    {MUSICIANS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {Object.entries(byMonthFiltered)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([m, monthShows]) => {
                    const mFee = monthShows.reduce((s, x) => s + x.fee, 0)
                    const mComm = monthShows.reduce((s, x) => s + x.fee * x.commission_pct / 100, 0)
                    const mPending = monthShows.filter((x) => !x.is_paid).reduce((s, x) => s + x.fee, 0)
                    return (
                      <div key={m} style={{ marginBottom: 24 }}>
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
                          {monthShows.map((show) => {
                            const musicianEntry = activeMusicianFilter !== 'all'
                              ? showMusicians.find((sm) => sm.show_id === show.id && sm.musician_id === activeMusicianFilter)
                              : null
                            const hasParticipation = showMusicians.some((sm) => sm.show_id === show.id)
                            const netPerMusician = musicianEntry ? musicianEntry.fee : null
                            return (
                              <ShowRow
                                key={show.id}
                                show={show}
                                isMobile={isMobile}
                                uploading={uploading && uploadingForShow === show.id}
                                netPerMusician={netPerMusician}
                                hasParticipation={hasParticipation}
                                onMarkPaid={() => handleMarkPaid(show)}
                                onAttachProof={() => triggerProofUpload(show.id, true)}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  )
}

function ShowRow({ show, isMobile, uploading, netPerMusician, hasParticipation, onMarkPaid, onAttachProof }: {
  show: Show; isMobile: boolean; uploading: boolean
  netPerMusician: number | null; hasParticipation: boolean
  onMarkPaid: () => void; onAttachProof: () => void
}) {
  const feeDisplay = show.payment_type === 'portaria'
    ? `🎟 ${show.portaria_pct}%${show.fee > 0 ? ' · ' + formatCurrency(show.fee) : ' · a apurar'}`
    : formatCurrency(show.fee)

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${show.is_paid ? 'rgba(74,222,128,0.2)' : 'var(--border)'}`,
      borderRadius: 10, padding: isMobile ? '12px 14px' : '12px 16px',
    }}>
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{show.client_name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {formatDate(show.date)}{show.venue ? ` · ${show.venue}` : ''}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: 700, fontSize: 14 }}>{feeDisplay}</p>
              {netPerMusician !== null && <p style={{ fontSize: 11, color: 'var(--green)' }}>Seu cachê: {formatCurrency(netPerMusician)}</p>}
              {!hasParticipation && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Participação pendente</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ProofArea show={show} uploading={uploading} onAttach={onAttachProof} />
            <button onClick={onMarkPaid} disabled={uploading} style={paidBtnStyle(show.is_paid)}>
              {uploading ? '⏳ Enviando...' : show.is_paid ? '✓ Pago' : '📎 Marcar pago'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>{formatDate(show.date)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>{show.client_name}</p>
            {show.venue && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{show.venue}{show.city ? ` · ${show.city}` : ''}</p>}
          </div>
          <div style={{ textAlign: 'right', minWidth: 180 }}>
            <p style={{ fontWeight: 700 }}>{feeDisplay}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Comissão: {formatCurrency(show.fee * show.commission_pct / 100)}
            </p>
            {netPerMusician !== null && <p style={{ fontSize: 11, color: 'var(--green)' }}>Seu cachê: {formatCurrency(netPerMusician)}</p>}
            {!hasParticipation && <p style={{ fontSize: 11, color: 'var(--orange)' }}>⚠ Participação não confirmada</p>}
          </div>
          <ProofArea show={show} uploading={uploading} onAttach={onAttachProof} />
          <button onClick={onMarkPaid} disabled={uploading} style={paidBtnStyle(show.is_paid)}>
            {uploading ? '⏳' : show.is_paid ? '✓ Pago' : '📎 Marcar pago'}
          </button>
        </div>
      )}
    </div>
  )
}

function ProofArea({ show, uploading, onAttach }: { show: Show; uploading: boolean; onAttach: () => void }) {
  if (show.payment_proof_url) {
    return (
      <a href={show.payment_proof_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--blue)', textDecoration: 'none', padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        📄 Comprovante
      </a>
    )
  }
  return (
    <button onClick={onAttach} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}>
      📎 Anexar
    </button>
  )
}

function paidBtnStyle(isPaid: boolean): React.CSSProperties {
  return { padding: '7px 14px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0, border: `1px solid ${isPaid ? 'rgba(74,222,128,0.4)' : 'rgba(251,146,60,0.4)'}`, background: isPaid ? 'rgba(74,222,128,0.1)' : 'rgba(251,146,60,0.1)', color: isPaid ? 'var(--green)' : 'var(--orange)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, ...style }}>
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
