'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useState } from 'react'

const NAV = [
  { href: '/', label: 'Calendário' },
  { href: '/shows', label: 'Shows' },
  { href: '/disponibilidade', label: 'Disponibilidade' },
  { href: '/financeiro', label: 'Financeiro' },
]

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const [logoError, setLogoError] = useState(false)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--navy)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        height: 64,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 0 rgba(204,26,26,0.3)',
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {!logoError ? (
            <Image
              src="/logo.png"
              alt="The Rock"
              width={100}
              height={50}
              style={{ objectFit: 'contain', objectPosition: 'left center' }}
              onError={() => setLogoError(true)}
              priority
            />
          ) : (
            <TextLogo />
          )}
        </Link>

        {/* Divider */}
        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV.map((item) => {
            const active = path === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  color: active ? '#fff' : 'var(--text-muted)',
                  background: active ? 'var(--accent)' : 'transparent',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  )
}

function TextLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{
        fontSize: 26,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800,
        color: '#ffffff',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>
        THE ROCK
      </span>
      <span style={{
        fontSize: 10,
        color: 'var(--accent)',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        ⚡
      </span>
    </div>
  )
}
