'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Shell from '@/components/Shell'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/auth-types'
import { ROLES } from '@/lib/auth-types'
import { useIsMobile } from '@/hooks/useIsMobile'

export default function UsuariosPage() {
  const { isAdmin, isProducer, profile: me } = useAuth()
  const isMobile = useIsMobile()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setProfiles((data as Profile[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleAdmin(p: Profile) {
    if (p.id === me?.id) return // can't remove own admin
    setSaving(p.id)
    await supabase.from('profiles').update({ is_admin: !p.is_admin }).eq('id', p.id)
    await load()
    setSaving(null)
  }

  async function deleteUser(p: Profile) {
    if (p.id === me?.id) return
    if (!confirm(`Excluir o usuário "${p.full_name}"? Esta ação não pode ser desfeita.`)) return
    setSaving(p.id)
    await supabase.from('profiles').delete().eq('id', p.id)
    // Note: auth.users entry remains — clean up manually in Supabase dashboard if needed
    await load()
    setSaving(null)
  }

  if (!isAdmin && !isProducer) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🔒</p>
          <p>Acesso restrito a administradores.</p>
        </div>
      </Shell>
    )
  }

  const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role

  function getInitials(fullName: string) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '??'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  function Field({ label, value }: { label: string; value: string }) {
    return (
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: 13, color: 'var(--text)', fontFamily: label === 'CPF' || label === 'Chave PIX' ? 'monospace' : undefined }}>{value}</p>
      </div>
    )
  }

  return (
    <Shell>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, flex: 1, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Usuários
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{profiles.length} cadastrado{profiles.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Carregando...</p>
        ) : profiles.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Nenhum usuário cadastrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profiles.map((p) => {
              const isOpen = expanded === p.id
              const phone = p.phone ? `(${p.phone.slice(0,2)}) ${p.phone.length === 11 ? p.phone.slice(2,7) + '-' + p.phone.slice(7) : p.phone.slice(2,6) + '-' + p.phone.slice(6)}` : '—'
              const cpf = p.cpf ? `${p.cpf.slice(0,3)}.${p.cpf.slice(3,6)}.${p.cpf.slice(6,9)}-${p.cpf.slice(9)}` : '—'
              const cep = p.cep ? `${p.cep.slice(0,5)}-${p.cep.slice(5)}` : '—'
              const birth = p.birth_date ? p.birth_date.split('-').reverse().join('/') : '—'
              return (
                <div key={p.id} style={{
                  background: 'var(--surface)', border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s',
                }}>
                  {/* Header row */}
                  <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Top: avatar + name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: '50%',
                        background: p.is_admin ? 'rgba(204,26,26,0.2)' : 'var(--surface2)',
                        border: `2px solid ${p.is_admin ? 'var(--accent)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: p.is_admin ? 'var(--accent)' : 'var(--text)',
                        flexShrink: 0, overflow: 'hidden', position: 'relative',
                      }}>
                        {p.avatar_url ? (
                          <Image src={p.avatar_url} alt={p.nickname} fill style={{ objectFit: 'cover' }} unoptimized />
                        ) : (
                          getInitials(p.full_name)
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700 }}>{p.full_name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({p.nickname})</span>
                          {p.is_admin && (
                            <span style={{ fontSize: 11, color: 'var(--blue)', background: 'rgba(96,165,250,0.15)', padding: '2px 8px', borderRadius: 4 }}>⭐ Admin</span>
                          )}
                          {p.id === me?.id && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: 4 }}>Você</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <span>{roleLabel(p.role)}</span>
                          {p.is_backing_vocal && <span>· Backing Vocal</span>}
                        </div>
                      </div>
                    </div>
                    {/* Bottom: action buttons */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setExpanded(isOpen ? null : p.id)}
                        style={{
                          padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                          border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
                          background: isOpen ? 'rgba(204,26,26,0.08)' : 'transparent',
                          color: isOpen ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
                        }}
                      >
                        {isOpen ? 'Fechar' : 'Ver perfil'}
                      </button>
                      {isAdmin && p.id !== me?.id && (
                        <>
                          <button
                            onClick={() => toggleAdmin(p)}
                            disabled={saving === p.id}
                            style={{
                              padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                              border: `1px solid ${p.is_admin ? 'rgba(96,165,250,0.4)' : 'var(--border)'}`,
                              background: p.is_admin ? 'rgba(96,165,250,0.1)' : 'transparent',
                              color: p.is_admin ? 'var(--blue)' : 'var(--text-muted)',
                            }}
                          >
                            {p.is_admin ? '⭐ Admin' : 'Tornar Admin'}
                          </button>
                          <button
                            onClick={() => deleteUser(p)}
                            disabled={saving === p.id}
                            style={{
                              padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                              border: '1px solid rgba(255,107,107,0.3)', background: 'transparent', color: 'var(--red)',
                            }}
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded profile — read only */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '18px 18px 20px', background: 'var(--surface2)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px 24px' }}>
                        <Field label="Nome completo" value={p.full_name} />
                        <Field label="Apelido" value={p.nickname} />
                        <Field label="Data de nascimento" value={birth} />
                        <Field label="CPF" value={cpf} />
                        <Field label="Telefone / WhatsApp" value={phone} />
                        <Field label="CEP" value={cep} />
                        <Field label="Chave PIX" value={p.pix_key} />
                        <Field label="E-mail para contato" value={p.contact_email || '—'} />
                        <Field label="Função" value={roleLabel(p.role)} />
                        <Field label="Backing Vocal" value={p.is_backing_vocal ? 'Sim' : 'Não'} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Shell>
  )
}
