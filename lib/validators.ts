// CPF
export function validateCPF(raw: string): boolean {
  const n = raw.replace(/\D/g, '')
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += +n[i] * (10 - i)
  let r = (s * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== +n[9]) return false
  s = 0
  for (let i = 0; i < 10; i++) s += +n[i] * (11 - i)
  r = (s * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === +n[10]
}

export function formatCPF(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 11)
  if (n.length <= 3) return n
  if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`
  if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`
  return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`
}

// Phone — 10 or 11 digits (Brazilian)
export function validatePhone(v: string): boolean {
  const n = v.replace(/\D/g, '')
  return n.length === 10 || n.length === 11
}

export function formatPhone(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 11)
  if (n.length <= 2) return n.length ? `(${n}` : ''
  if (n.length <= 6) return `(${n.slice(0,2)}) ${n.slice(2)}`
  if (n.length <= 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`
  return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
}

// CEP — 8 digits
export function validateCEP(v: string): boolean {
  return v.replace(/\D/g, '').length === 8
}

export function formatCEP(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 8)
  if (n.length <= 5) return n
  return `${n.slice(0,5)}-${n.slice(5)}`
}

// Email
export function validateEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

// Password — min 8 chars, 1 upper, 1 lower, 1 digit, 1 special
export function validatePassword(v: string): string | null {
  if (v.length < 8) return 'Mínimo 8 caracteres'
  if (!/[A-Z]/.test(v)) return 'Precisa de ao menos uma letra maiúscula'
  if (!/[a-z]/.test(v)) return 'Precisa de ao menos uma letra minúscula'
  if (!/\d/.test(v)) return 'Precisa de ao menos um número'
  if (!/[^A-Za-z0-9]/.test(v)) return 'Precisa de ao menos um caractere especial (@, #, !, etc.)'
  return null
}
