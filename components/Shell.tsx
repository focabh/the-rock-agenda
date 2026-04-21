'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', label: 'Calendário' },
  { href: '/shows', label: 'Shows' },
  { href: '/disponibilidade', label: 'Disponibilidade' },
  { href: '/financeiro', label: 'Financeiro' },
]

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        height: 60,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
            THE ROCK
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>AGENDA</span>
        </div>
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                color: path === item.href ? 'var(--bg)' : 'var(--text-muted)',
                background: path === item.href ? 'var(--accent)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  )
}
