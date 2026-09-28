'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'

const THEMES = [
  { cle: 'academie', classe: 'theme-academie', pastille: '#2447B8' },
  { cle: 'ardoise', classe: 'theme-ardoise', pastille: '#94A3B8' },
  { cle: 'nuit', classe: 'theme-nuit', pastille: '#0B1220' },
] as const

type Libelles = { label: string; academie: string; ardoise: string; nuit: string }

function appliquer(classe: string) {
  THEMES.forEach((t) => document.documentElement.classList.remove(t.classe))
  if (classe !== 'theme-academie') document.documentElement.classList.add(classe)
}

export function ThemeSwitcher({ libelles }: { libelles: Libelles }) {
  const [courant, setCourant] = useState('theme-academie')
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      // Synchronisation avec le thème déjà posé par le script de app/layout.tsx.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCourant(localStorage.getItem('ds-theme') || 'theme-academie')
    } catch {}
  }, [])

  useEffect(() => {
    if (!ouvert) return
    const fermer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', fermer)
    return () => document.removeEventListener('mousedown', fermer)
  }, [ouvert])

  const choisir = (classe: string) => {
    setCourant(classe)
    setOuvert(false)
    appliquer(classe)
    try {
      localStorage.setItem('ds-theme', classe)
    } catch {}
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="flex items-center gap-2 rounded-lg p-2 text-foreground-muted transition-colors hover:bg-primary-soft hover:text-foreground"
        title={libelles.label}
        aria-label={libelles.label}
      >
        <Palette className="h-5 w-5" />
      </button>
      {ouvert && (
        <div className="absolute end-0 z-50 mt-2 w-44 rounded-xl border border-surface-border bg-surface py-1 shadow-xl">
          {THEMES.map((t) => (
            <button
              key={t.cle}
              type="button"
              onClick={() => choisir(t.classe)}
              className="flex w-full items-center gap-3 px-3 py-2 text-start text-sm text-foreground hover:bg-primary-soft"
            >
              <span className="h-4 w-4 rounded-full ring-1 ring-surface-border" style={{ background: t.pastille }} />
              <span className="flex-1">{libelles[t.cle]}</span>
              {courant === t.classe && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
