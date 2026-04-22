export type RoleType =
  | 'produtor'
  | 'vocalista'
  | 'guitarrista_base'
  | 'guitarrista_solo'
  | 'baixista'
  | 'baterista'

export interface Profile {
  id: string
  full_name: string
  nickname: string
  birth_date: string
  cpf: string
  phone: string
  cep?: string
  pix_key: string
  contact_email?: string | null
  role: RoleType
  is_backing_vocal: boolean
  is_admin: boolean
  avatar_url?: string
  created_at: string
}

export const ROLES: { value: RoleType; label: string }[] = [
  { value: 'produtor', label: 'Produtor(a)' },
  { value: 'vocalista', label: 'Vocalista' },
  { value: 'guitarrista_base', label: 'Guitarrista Base' },
  { value: 'guitarrista_solo', label: 'Guitarrista Solo' },
  { value: 'baixista', label: 'Baixista' },
  { value: 'baterista', label: 'Baterista' },
]

// Maps profile role to the musician_id used in availability table
export const ROLE_TO_MUSICIAN_ID: Partial<Record<RoleType, string>> = {
  vocalista: 'foca',
  guitarrista_base: 'marco',
  guitarrista_solo: 'felipe',
  baterista: 'ester',
  baixista: 'rafa',
}

// Roles that can be backing vocal
export const BACKING_VOCAL_ROLES: RoleType[] = [
  'guitarrista_base',
  'guitarrista_solo',
  'baixista',
  'baterista',
]
