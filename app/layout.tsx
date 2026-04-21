import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Rock — Agenda',
  description: 'Gerenciamento de shows e disponibilidade da banda The Rock',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
