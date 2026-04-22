'use client'
import { useEffect, useState } from 'react'
import { getMusicianProfiles } from '@/lib/db'
import { MUSICIANS } from '@/lib/types'
import type { Show } from '@/lib/types'

function brDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function buildMessage(name: string, show: Show): string {
  const lines = [
    `🎸 *THE ROCK — Novo Show!*`,
    ``,
    `Oi ${name}! Um show foi agendado. Confirme sua presença.`,
    ``,
    `📅 *Data:* ${brDate(show.date)}`,
    `⏰ *Horário:* ${show.time.slice(0, 5)}`,
    show.client_name ? `🎤 *Contratante:* ${show.client_name}` : null,
    show.venue ? `📍 *Local:* ${show.venue}` : null,
    show.city ? `🏙️ *Cidade:* ${show.city}` : null,
    show.fee ? `💰 *Cachê:* R$ ${show.fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null,
    ``,
    `Responde aqui confirmando se vai! 🤘`,
  ]
  return lines.filter((l) => l !== null).join('\n')
}

function waLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`
}

interface Props {
  show: Show
  onClose: () => void
}

export default function WhatsAppNotifyPanel({ show, onClose }: Props) {
  const [targets, setTargets] = useState<{ id: string; name: string; phone: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMusicianProfiles().then((profiles) => {
      const list: { id: string; name: string; phone: string }[] = []
      for (const m of MUSICIANS) {
        const info = profiles[m.id]
        if (info?.phone) list.push({ id: m.id, name: info.name, phone: info.phone })
      }
      setTargets(list)
      setLoading(false)
    })
  }, [])

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 24,
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>📲 Notificar músicos</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Clique para abrir o WhatsApp com a mensagem já preenchida para cada músico.
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}
        >
          ×
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando músicos...</p>
      ) : targets.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Nenhum músico com telefone cadastrado ainda.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {targets.map((t) => (
            <a
              key={t.id}
              href={waLink(t.phone, buildMessage(t.name, show))}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                textDecoration: 'none',
                color: 'var(--text)',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#25d366')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <span style={{ fontSize: 20 }}>💬</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {`(${t.phone.slice(0,2)}) ${t.phone.slice(2,7)}-${t.phone.slice(7)}`}
                </p>
              </div>
              <span style={{ fontSize: 12, color: '#25d366', fontWeight: 600 }}>Abrir WhatsApp →</span>
            </a>
          ))}
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          marginTop: 16,
          width: '100%',
          padding: '10px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-muted)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Fechar
      </button>
    </div>
  )
}
