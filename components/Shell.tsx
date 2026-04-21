'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

const NAV = [
  { href: '/', label: 'Calendário', icon: '📅' },
  { href: '/shows', label: 'Shows', icon: '🎸' },
  { href: '/disponibilidade', label: 'Disponível', icon: '👥' },
  { href: '/financeiro', label: 'Financeiro', icon: '💰' },
]

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const isMobile = useIsMobile()
  const [logoError, setLogoError] = useState(false)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top header */}
      <header style={{
        background: 'var(--navy)',
        borderBottom: '1px solid var(--border)',
        padding: isMobile ? '0 16px' : '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 0 : 28,
        height: 60,
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
              width={isMobile ? 80 : 100}
              height={isMobile ? 40 : 50}
              style={{ objectFit: 'contain', objectPosition: 'left center' }}
              onError={() => setLogoError(true)}
              priority
            />
          ) : (
            <TextLogo />
          )}
        </Link>

        {/* Desktop nav */}
        {!isMobile && (
          <>
            <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
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
                    }}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </>
        )}
      </header>

      {/* Main content */}
      <main style={{
        flex: 1,
        padding: isMobile ? '16px 12px' : 24,
        paddingBottom: isMobile ? 80 : 24,
      }}>
        {children}
      </main>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: 'var(--navy)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          zIndex: 100,
          boxShadow: '0 -1px 0 rgba(204,26,26,0.2)',
        }}>
          {NAV.map((item) => {
            const active = path === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  textDecoration: 'none',
                  paddingBottom: 4,
                  borderTop: active ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'color 0.15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}

function TextLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{
        fontSize: 24,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800,
        color: '#ffffff',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>
        THE ROCK
      </span>
      <span style={{ fontSize: 10, color: 'var(--accent)' }}>⚡</span>
    </div>
  )
}
