'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'

interface Props {
  value: File | null
  previewUrl?: string       // existing URL (edit mode)
  onChange: (file: File) => void
  error?: string
  size?: number
}

export default function AvatarUpload({ value, previewUrl, onChange, error, size = 96 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const display = localPreview ?? previewUrl ?? null

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    onChange(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          width: size, height: size, borderRadius: '50%',
          border: `2px dashed ${error ? 'var(--red)' : display ? 'var(--accent)' : 'var(--border)'}`,
          background: 'var(--surface2)',
          cursor: 'pointer',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          transition: 'border-color 0.15s',
          flexShrink: 0,
        }}
      >
        {display ? (
          <Image src={display} alt="Foto" fill style={{ objectFit: 'cover' }} unoptimized />
        ) : (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>
              Clique ou<br />arraste aqui
            </div>
          </div>
        )}
        {/* Overlay on hover */}
        {display && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.2s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0' }}
          >
            <span style={{ fontSize: 20 }}>✏️</span>
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {display ? 'Clique na foto para alterar' : 'Foto de perfil *'}
        </p>
        {error && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>{error}</p>}
      </div>
    </div>
  )
}
