'use client'
import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/Shell'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/auth-types'
import { ROLES } from '@/lib/auth-types'

export default function UsuariosPage() {
  const { isAdmin, isProducer, profile: me } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

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

  return (
    <Shell>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, flex: 1, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
            {profiles.map((p) => (
              <div key={p.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: p.is_admin ? 'rgba(204,26,26,0.2)' : 'var(--surface2)',
                  border: `2px solid ${p.is_admin ? 'var(--accent)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: p.is_admin ? 'var(--accent)' : 'var(--text)',
                  flexShrink: 0,
                }}>
                  {p.nickname.slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{p.full_name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({p.nickname})</span>
                    {p.is_admin && (
                      <span style={{ fontSize: 11, color: 'var(--blue)', background: 'rgba(96,165,250,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                        ⭐ Admin
                      </span>
                    )}
                    {p.id === me?.id && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: 4 }}>
                        Você
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{roleLabel(p.role)}</span>
                    {p.is_backing_vocal && <span>· Backing Vocal</span>}
                    <span>· 🔑 {p.pix_key}</span>
                  </div>
                </div>

                {/* Actions — admin only */}
                {isAdmin && p.id !== me?.id && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => toggleAdmin(p)}
                      disabled={saving === p.id}
                      title={p.is_admin ? 'Remover admin' : 'Tornar admin'}
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
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
