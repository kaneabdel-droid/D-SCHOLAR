'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ONGLETS = ['factures', 'paiements'] as const

export default function FacturationTabs({ libelles }: { libelles: Record<(typeof ONGLETS)[number], string> }) {
  const pathname = usePathname()

  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-xl border border-surface-border bg-surface p-1 shadow-xs">
        {ONGLETS.map((onglet) => {
          const href = `/facturation/${onglet}`
          const actif = pathname.startsWith(href)
          return (
            <li key={onglet}>
              <Link
                href={href}
                className={`block whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  actif ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground-muted hover:bg-primary-soft hover:text-foreground'
                }`}
              >
                {libelles[onglet]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
