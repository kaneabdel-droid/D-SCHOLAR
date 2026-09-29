'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, ClipboardCheck, Megaphone, PenLine, Ticket } from 'lucide-react'
import { marquerNotificationsLues } from '@/app/actions/notifications'

type Item = { id: string; texte: string; type: string; lien: string | null; lu: boolean; quand: string }
const ICONES = { absence: ClipboardCheck, note: PenLine, annonce: Megaphone, billet: Ticket } as const

export default function NotificationsMenu({ items, libelles }: { items: Item[]; libelles: { titre: string; vide: string } }) {
  const [ouvert, setOuvert] = useState(false)
  const [nonLues, setNonLues] = useState(items.filter((i) => !i.lu).length)
  const zone = useRef<HTMLDivElement>(null)

  // Fermeture au clic extérieur ou sur Échap.
  useEffect(() => {
    if (!ouvert) return
    const clic = (e: MouseEvent) => { if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false) }
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('mousedown', clic)
      document.removeEventListener('keydown', touche)
    }
  }, [ouvert])

  const basculer = () => {
    setOuvert((o) => !o)
    if (!ouvert && nonLues > 0) {
      setNonLues(0)
      void marquerNotificationsLues()
    }
  }

  return (
    <div ref={zone} className="relative">
      <button type="button" onClick={basculer} aria-label={libelles.titre} aria-expanded={ouvert} className="relative rounded-lg p-2 text-foreground-muted hover:bg-primary-soft hover:text-foreground">
        <Bell className="h-5 w-5" />
        {nonLues > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[0.65rem] font-bold text-white">{nonLues > 9 ? '9+' : nonLues}</span>
        )}
      </button>
      {ouvert && (
        <div className="absolute end-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-surface-border bg-surface shadow-xl">
          <p className="border-b border-surface-border px-4 py-3 text-sm font-semibold text-foreground">{libelles.titre}</p>
          <ul className="max-h-96 divide-y divide-surface-border overflow-y-auto">
            {items.map((i) => {
              const Icone = ICONES[i.type as keyof typeof ICONES] ?? Bell
              const contenu = (
                <span className="flex gap-3 px-4 py-3">
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${i.lu ? 'bg-background text-foreground-muted' : 'bg-primary-soft text-primary'}`}><Icone className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${i.lu ? 'text-foreground-muted' : 'font-medium text-foreground'}`}>{i.texte}</span>
                    <span className="mt-0.5 block text-xs text-foreground-muted">{i.quand}</span>
                  </span>
                </span>
              )
              return (
                <li key={i.id}>
                  {i.lien ? <Link href={i.lien} onClick={() => setOuvert(false)} className="block hover:bg-background">{contenu}</Link> : contenu}
                </li>
              )
            })}
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-foreground-muted">{libelles.vide}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
