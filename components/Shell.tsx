'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAuth } from '@/components/AuthProvider'

const PUBLIC_ROUTES = ['/login', '/cadastro']

const NAV_ADMIN = [
  { href: '/', label: 'Calendário', icon: '📅' },
  { href: '/shows', label: 'Shows', icon: '🎸' },
  { href: '/disponibilidade', label: 'Disponível', icon: '👥' },
  { href: '/financeiro', label: 'Financeiro', icon: '💰' },
  { href: '/usuarios', label: 'Usuários', icon: '⚙️' },
]

const NAV_USER = [
  { href: '/', label: 'Calendário', icon: '📅' },
  { href: '/disponibilidade', label: 'Disponível', icon: '👥' },
  { href: '/perfil', label: 'Meu Perfil', icon: '👤' },
]

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [logoError, setLogoError] = useState(false)
  const { user, profile, isAdmin, isProducer, loading, signOut } = useAuth()

  useEffect(() => {
    if (!loading && !user && !PUBLIC_ROUTES.includes(path)) {
      router.replace('/login')
    }
  }, [loading, user, path, router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text-muted)' }}>
        Carregando...
      </div>
    )
  }

  if (!user && !PUBLIC_ROUTES.includes(path)) return null

  const canManage = isAdmin || isProducer
  const NAV = canManage ? NAV_ADMIN : NAV_USER

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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

        {!isMobile && user && (
          <>
            <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
            <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} style={{
                  padding: '7px 16px', borderRadius: 6, fontSize: 14, fontWeight: 600,
                  color: path === item.href ? '#fff' : 'var(--text-muted)',
                  background: path === item.href ? 'var(--accent)' : 'transparent',
                  transition: 'all 0.15s',
                }}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
              <Link href="/perfil" style={{
                fontSize: 13, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {profile?.nickname?.slice(0, 2).toUpperCase() ?? '??'}
                </span>
                {profile?.nickname ?? ''}
              </Link>
              <button onClick={handleSignOut} style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-muted)', fontSize: 12,
              }}>
                Sair
              </button>
            </div>
          </>
        )}
      </header>

      <main style={{
        flex: 1,
        padding: isMobile ? '16px 12px' : 24,
        paddingBottom: isMobile && user ? 80 : isMobile ? 16 : 24,
      }}>
        {children}
      </main>

      {isMobile && user && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
          background: 'var(--navy)', borderTop: '1px solid var(--border)',
          display: 'flex', zIndex: 100, boxShadow: '0 -1px 0 rgba(204,26,26,0.2)',
        }}>
          {NAV.slice(0, 5).map((item) => {
            const active = path === item.href
            return (
              <Link key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                fontSize: 9, fontWeight: active ? 700 : 500,
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                borderTop: active ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.15s', paddingBottom: 4,
              }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
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
        fontSize: 24, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
        color: '#ffffff', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1,
      }}>
        THE ROCK
      </span>
      <span style={{ fontSize: 10, color: 'var(--accent)' }}>⚡</span>
    </div>
  )
}
