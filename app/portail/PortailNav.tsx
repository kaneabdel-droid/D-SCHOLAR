'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Onglets du portail : accueil puis un onglet par enfant.
export default function PortailNav({ enfants, accueil }: { enfants: { id: string; prenom: string }[]; accueil: string }) {
  const pathname = usePathname()
  const lien = (href: string, texte: string, actif: boolean) => (
    <Link
      key={href}
      href={href}
      className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${actif ? 'border-primary text-primary' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
    >
      {texte}
    </Link>
  )
  return (
    <nav className="mx-auto max-w-5xl overflow-x-auto px-2 sm:px-4">
      <div className="flex min-w-max">
        {lien('/portail', accueil, pathname === '/portail')}
        {enfants.map((e) => lien(`/portail/${e.id}`, e.prenom, pathname.startsWith(`/portail/${e.id}`)))}
      </div>
    </nav>
  )
}
