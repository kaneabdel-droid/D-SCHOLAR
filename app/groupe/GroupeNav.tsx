'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// Onglets de la vue groupe ; l'année choisie (?annee=2026-2027) suit la navigation.
export default function GroupeNav({ onglets }: { onglets: { href: string; libelle: string }[] }) {
  const pathname = usePathname()
  const annee = useSearchParams().get('annee')
  const suffixe = annee ? `?annee=${encodeURIComponent(annee)}` : ''
  return (
    <nav className="mx-auto max-w-7xl overflow-x-auto px-2 sm:px-4">
      <div className="flex min-w-max">
        {onglets.map((o) => {
          const actif = o.href === '/groupe' ? pathname === '/groupe' : pathname.startsWith(o.href)
          return (
            <Link key={o.href} href={o.href + suffixe} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${actif ? 'border-primary text-primary' : 'border-transparent text-foreground-muted hover:text-foreground'}`}>
              {o.libelle}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function SelecteurLibelle({ libelles, choisi, etiquette }: { libelles: string[]; choisi: string | null; etiquette: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  if (libelles.length === 0) return null
  return (
    <label className="flex items-center gap-2 text-sm text-foreground-muted">
      {etiquette}
      <select
        value={choisi ?? ''}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString())
          p.set('annee', e.target.value)
          router.push(`${pathname}?${p.toString()}`)
        }}
        className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground shadow-xs"
      >
        {libelles.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
    </label>
  )
}
