'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { ROLES } from '@/lib/auth-types'
import { validatePhone, formatPhone, validateCEP, formatCEP, validatePassword } from '@/lib/validators'

const LABEL = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const FIELD = { display: 'flex', flexDirection: 'column' as const, gap: 5 }

export default function PerfilPage() {
  const { profile, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    full_name: '', nickname: '', birth_date: '', phone: '', cep: '', pix_key: '',
  })
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false })
  const [saving, setSaving] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [msg, setMsg] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        nickname: profile.nickname,
        birth_date: profile.birth_date,
        phone: formatPhone(profile.phone),
        cep: profile.cep ? `${profile.cep.slice(0,5)}-${profile.cep.slice(5)}` : '',
        pix_key: profile.pix_key,
      })
    }
  }, [profile])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => { const n = {...e}; delete n[key]; return n })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.full_name.trim()) errs.full_name = 'Obrigatório'
    if (!form.nickname.trim()) errs.nickname = 'Obrigatório'
    if (!validatePhone(form.phone)) errs.phone = 'Telefone inválido'
    if (form.cep && !validateCEP(form.cep)) errs.cep = 'CEP inválido'
    if (!form.pix_key.trim()) errs.pix_key = 'Obrigatório'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    setMsg('')
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      nickname: form.nickname.trim(),
      birth_date: form.birth_date,
      phone: form.phone.replace(/\D/g, ''),
      cep: form.cep ? form.cep.replace(/\D/g, '') : null,
      pix_key: form.pix_key.trim(),
    }).eq('id', profile!.id)

    if (error) setMsg('Erro ao salvar: ' + error.message)
    else { setMsg('✓ Perfil atualizado com sucesso!'); await refreshProfile() }
    setSaving(false)
  }

  async function handlePwChange(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const pwErr = validatePassword(pwForm.new)
    if (pwErr) errs.new = pwErr
    if (pwForm.new !== pwForm.confirm) errs.confirm = 'Senhas não coincidem'
    if (Object.keys(errs).length) { setPwErrors(errs); return }

    setSavingPw(true)
    setPwMsg('')
    const { error } = await supabase.auth.updateUser({ password: pwForm.new })
    if (error) setPwMsg('Erro: ' + error.message)
    else { setPwMsg('✓ Senha alterada!'); setPwForm({ current: '', new: '', confirm: '' }) }
    setSavingPw(false)
  }

  const roleLabel = ROLES.find((r) => r.value === profile?.role)?.label ?? ''

  return (
    <Shell>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 24, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Meu Perfil
        </h1>

        {/* Role badge */}
        {profile && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, background: 'rgba(204,26,26,0.15)', border: '1px solid rgba(204,26,26,0.4)', color: 'var(--accent)', padding: '4px 14px', borderRadius: 20, fontWeight: 600 }}>
              {roleLabel}
            </span>
            {profile.is_backing_vocal && (
              <span style={{ fontSize: 13, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '4px 14px', borderRadius: 20 }}>
                Backing Vocal
              </span>
            )}
            {profile.is_admin && (
              <span style={{ fontSize: 13, background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: 'var(--blue)', padding: '4px 14px', borderRadius: 20, fontWeight: 600 }}>
                ⭐ Administrador
              </span>
            )}
          </div>
        )}

        {/* Profile form */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Dados Pessoais</h2>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ ...FIELD, gridColumn: '1 / -1' }}>
                <label style={LABEL}>Nome completo</label>
                <input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
                {errors.full_name && <p style={{ fontSize: 12, color: 'var(--red)' }}>{errors.full_name}</p>}
              </div>
              <div style={FIELD}>
                <label style={LABEL}>Apelido</label>
                <input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} />
                {errors.nickname && <p style={{ fontSize: 12, color: 'var(--red)' }}>{errors.nickname}</p>}
              </div>
              <div style={FIELD}>
                <label style={LABEL}>Data de nascimento</label>
                <input type="date" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
              </div>
            </div>

            <div style={FIELD}>
              <label style={LABEL}>Email (login) — não editável aqui</label>
              <input value={profile?.id ? '' : ''} placeholder="Gerenciado pelo sistema" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
            </div>

            <div style={FIELD}>
              <label style={LABEL}>Telefone / WhatsApp</label>
              <input value={form.phone} onChange={(e) => set('phone', formatPhone(e.target.value))} inputMode="tel" />
              {errors.phone && <p style={{ fontSize: 12, color: 'var(--red)' }}>{errors.phone}</p>}
            </div>

            <div style={FIELD}>
              <label style={LABEL}>CEP (opcional)</label>
              <input value={form.cep} onChange={(e) => set('cep', formatCEP(e.target.value))} inputMode="numeric" />
              {errors.cep && <p style={{ fontSize: 12, color: 'var(--red)' }}>{errors.cep}</p>}
            </div>

            <div style={FIELD}>
              <label style={LABEL}>Chave PIX</label>
              <input value={form.pix_key} onChange={(e) => set('pix_key', e.target.value)} />
              {errors.pix_key && <p style={{ fontSize: 12, color: 'var(--red)' }}>{errors.pix_key}</p>}
            </div>

            <div style={FIELD}>
              <label style={LABEL}>Função</label>
              <input value={roleLabel} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>A função não pode ser alterada após o cadastro</p>
            </div>

            {msg && <p style={{ color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{msg}</p>}

            <button type="submit" disabled={saving} style={{
              padding: '10px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>

        {/* Password change */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Alterar Senha</h2>
          <form onSubmit={handlePwChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['new', 'confirm'] as const).map((key) => (
              <div key={key} style={FIELD}>
                <label style={LABEL}>{key === 'new' ? 'Nova senha' : 'Confirmar nova senha'}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw[key] ? 'text' : 'password'}
                    value={pwForm[key]}
                    onChange={(e) => setPwForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder="••••••••"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPw((s) => ({ ...s, [key]: !s[key] }))} style={EYE_BTN}>
                    {showPw[key] ? '🙈' : '👁️'}
                  </button>
                </div>
                {pwErrors[key] && <p style={{ fontSize: 12, color: 'var(--red)' }}>{pwErrors[key]}</p>}
              </div>
            ))}
            {pwMsg && <p style={{ color: pwMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{pwMsg}</p>}
            <button type="submit" disabled={savingPw} style={{
              padding: '10px', borderRadius: 8, border: 'none',
              background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 600, fontSize: 14,
            } as React.CSSProperties}>
              {savingPw ? 'Salvando...' : 'Alterar Senha'}
            </button>
          </form>
        </div>
      </div>
    </Shell>
  )
}

const EYE_BTN: React.CSSProperties = {
  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, padding: 2, cursor: 'pointer',
}
