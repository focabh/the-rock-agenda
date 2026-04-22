'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { ROLES, BACKING_VOCAL_ROLES, type RoleType } from '@/lib/auth-types'
import AvatarUpload from '@/components/AvatarUpload'
import {
  validateCPF, formatCPF,
  validatePhone, formatPhone,
  validateCEP, formatCEP,
  validateEmail, validatePassword,
} from '@/lib/validators'

const LABEL = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const FIELD = { display: 'flex', flexDirection: 'column' as const, gap: 5 }

export default function CadastroPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [takenRoles, setTakenRoles] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    full_name: '',
    nickname: '',
    birth_date: '',
    cpf: '',
    email: '',
    phone: '',
    cep: '',
    pix_key: '',
    role: '' as RoleType | '',
    is_backing_vocal: false,
    password: '',
    confirm_password: '',
  })

  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [loading, user, router])

  useEffect(() => {
    // Load which roles are already taken
    supabase.rpc('get_taken_roles').then(({ data }) => {
      if (data) setTakenRoles(data as string[])
    })
  }, [])

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!avatarFile) e.avatar = 'Foto de perfil é obrigatória'
    if (!form.full_name.trim()) e.full_name = 'Obrigatório'
    if (!form.nickname.trim()) e.nickname = 'Obrigatório'
    if (!form.birth_date) e.birth_date = 'Obrigatório'
    if (!validateCPF(form.cpf)) e.cpf = 'CPF inválido'
    if (!validateEmail(form.email)) e.email = 'Email inválido'
    if (!validatePhone(form.phone)) e.phone = 'Telefone inválido (mínimo 10 dígitos)'
    if (form.cep && !validateCEP(form.cep)) e.cep = 'CEP inválido (8 dígitos)'
    if (!form.pix_key.trim()) e.pix_key = 'Obrigatório'
    if (!form.role) e.role = 'Selecione uma função'
    const pwErr = validatePassword(form.password)
    if (pwErr) e.password = pwErr
    if (form.password !== form.confirm_password) e.confirm_password = 'Senhas não coincidem'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)

    try {
      // Only the designated admin email receives is_admin = true
      const ADMIN_EMAIL = 'focabh@gmail.com'
      const isFirstUser = form.email.toLowerCase() === ADMIN_EMAIL

      // Create auth user
      const { data: { user: newUser }, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (authErr) throw new Error(authErr.message)
      if (!newUser) throw new Error('Erro ao criar usuário')

      // Upload avatar
      let avatar_url: string | null = null
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() ?? 'jpg'
        const path = `${newUser.id}/avatar.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true })
        if (uploadErr) throw new Error('Erro ao enviar foto: ' + uploadErr.message)
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = urlData.publicUrl
      }

      // Insert profile
      const { error: profileErr } = await supabase.from('profiles').insert({
        id: newUser.id,
        full_name: form.full_name.trim(),
        nickname: form.nickname.trim(),
        birth_date: form.birth_date,
        cpf: form.cpf.replace(/\D/g, ''),
        phone: form.phone.replace(/\D/g, ''),
        cep: form.cep ? form.cep.replace(/\D/g, '') : null,
        pix_key: form.pix_key.trim(),
        role: form.role,
        is_backing_vocal: BACKING_VOCAL_ROLES.includes(form.role as RoleType) ? form.is_backing_vocal : false,
        is_admin: isFirstUser,
        avatar_url,
      })
      if (profileErr) throw new Error(profileErr.message)

      // Full page reload ensures AuthProvider re-reads profile from DB
      window.location.href = '/'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar'
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('duplicate')) {
        setErrors({ email: 'Este email já está cadastrado' })
      } else if (msg.toLowerCase().includes('unique') && msg.toLowerCase().includes('cpf')) {
        setErrors({ cpf: 'Este CPF já está cadastrado' })
      } else if (msg.toLowerCase().includes('unique') && msg.toLowerCase().includes('role')) {
        setErrors({ role: 'Esta função já foi preenchida por outro membro' })
      } else {
        setErrors({ _global: msg })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const showBackingVocal = BACKING_VOCAL_ROLES.includes(form.role as RoleType)

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px 40px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{
            fontSize: 36, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
            color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>THE ROCK</span>
          <div style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 2 }}>
            ⚡ Nova Conta ⚡
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <AvatarUpload
              value={avatarFile}
              onChange={(file) => {
                setAvatarFile(file)
                if (errors.avatar) setErrors((e) => { const n = { ...e }; delete n.avatar; return n })
              }}
              error={errors.avatar}
              size={100}
            />

            <Section title="Dados Pessoais">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Nome completo" error={errors.full_name} style={{ gridColumn: '1 / -1' }}>
                  <input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Seu nome completo" />
                </Field>
                <Field label="Apelido" error={errors.nickname}>
                  <input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder="Ex: Foca" />
                </Field>
                <Field label="Data de nascimento" error={errors.birth_date}>
                  <input type="date" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
                </Field>
              </div>
              <Field label="CPF" error={errors.cpf}>
                <input
                  value={form.cpf}
                  onChange={(e) => set('cpf', formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </Field>
            </Section>

            <Section title="Contato">
              <Field label="Email (usado para login)" error={errors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="seuemail@email.com"
                  autoComplete="email"
                />
              </Field>
              <Field label="Telefone / WhatsApp" error={errors.phone}>
                <input
                  value={form.phone}
                  onChange={(e) => set('phone', formatPhone(e.target.value))}
                  placeholder="(31) 99999-9999"
                  inputMode="tel"
                />
              </Field>
              <Field label="CEP (opcional)" error={errors.cep}>
                <input
                  value={form.cep}
                  onChange={(e) => set('cep', formatCEP(e.target.value))}
                  placeholder="00000-000"
                  inputMode="numeric"
                />
              </Field>
            </Section>

            <Section title="Dados Financeiros">
              <Field label="Chave PIX" error={errors.pix_key}>
                <input
                  value={form.pix_key}
                  onChange={(e) => set('pix_key', e.target.value)}
                  placeholder="CPF, email, telefone ou chave aleatória"
                />
              </Field>
            </Section>

            <Section title="Função na Banda">
              <Field label="Selecione sua função" error={errors.role}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ROLES.map((r) => {
                    const taken = takenRoles.includes(r.value)
                    const selected = form.role === r.value
                    return (
                      <label key={r.value} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 8, cursor: taken && !selected ? 'not-allowed' : 'pointer',
                        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        background: selected ? 'rgba(204,26,26,0.1)' : taken ? 'rgba(0,0,0,0.2)' : 'var(--surface2)',
                        opacity: taken && !selected ? 0.5 : 1,
                        transition: 'all 0.15s',
                      }}>
                        <input
                          type="radio"
                          name="role"
                          value={r.value}
                          checked={selected}
                          disabled={taken && !selected}
                          onChange={() => set('role', r.value)}
                          style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                        />
                        <span style={{ fontSize: 14, fontWeight: selected ? 700 : 500, flex: 1 }}>{r.label}</span>
                        {taken && !selected && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: 4 }}>Ocupado</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </Field>

              {showBackingVocal && (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--surface2)', marginTop: 4,
                }}>
                  <input
                    type="checkbox"
                    checked={form.is_backing_vocal}
                    onChange={(e) => set('is_backing_vocal', e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                  />
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Backing Vocal</span>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Marque se você também faz backing vocal
                    </p>
                  </div>
                </label>
              )}
            </Section>

            <Section title="Senha">
              <Field label="Senha" error={errors.password}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={EYE_BTN}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  Mín. 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 especial
                </p>
              </Field>
              <Field label="Confirmar senha" error={errors.confirm_password}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw2 ? 'text' : 'password'}
                    value={form.confirm_password}
                    onChange={(e) => set('confirm_password', e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPw2(!showPw2)} style={EYE_BTN}>
                    {showPw2 ? '🙈' : '👁️'}
                  </button>
                </div>
              </Field>
            </Section>

            {errors._global && <p style={{ color: 'var(--red)', fontSize: 13 }}>{errors._global}</p>}

            <button type="submit" disabled={submitting} style={{
              padding: '12px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 15,
              opacity: submitting ? 0.7 : 1,
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              {submitting ? 'Cadastrando...' : 'Criar Conta'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          Já tem conta?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Entrar</Link>
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, error, children, style }: { label: string; error?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...FIELD, ...style }}>
      <label style={LABEL}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>{error}</p>}
    </div>
  )
}

const EYE_BTN: React.CSSProperties = {
  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, padding: 2, cursor: 'pointer',
}
