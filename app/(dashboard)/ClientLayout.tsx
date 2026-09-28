'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarClock,
  CalendarDays,
  AlertTriangle,
  ClipboardCheck,
  CreditCard,
  FileBadge,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  PenLine,
  School,
  TrendingUp,
  Settings,
  Shirt,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import LanguageSelector from '@/components/LanguageSelector'
import type { Dictionary } from '@/dictionaries'
import { peutGererParametres, type Role } from '@/lib/roles'

type CleNav = keyof Dictionary['nav']
type Item = { key: CleNav; href: string; icon: LucideIcon; bientot?: boolean }
type Section = { titre: CleNav; items: Item[] }

export type Bandeau = {
  niveau: 'alerte' | 'avertissement'
  texte: string
  action?: { libelle: string; href: string }
  complement?: string
}

// Les modules marqués `bientot` arrivent dans les lots suivants : affichés
// (feuille de route visible) mais non cliquables.
function sections(role: Role): Section[] {
  const parametrage = peutGererParametres(role)
  return [
    {
      titre: 'sectionPilotage',
      items: [{ key: 'dashboard', href: '/dashboard', icon: LayoutDashboard }],
    },
    {
      titre: 'sectionScolarite',
      items: [
        { key: 'admissions', href: '/admissions', icon: UserPlus, bientot: true },
        { key: 'eleves', href: '/eleves', icon: GraduationCap },
        { key: 'passages', href: '/passages', icon: TrendingUp },
        { key: 'attestations', href: '/attestations', icon: FileBadge, bientot: true },
      ],
    },
    {
      titre: 'sectionPedagogie',
      items: [
        { key: 'classes', href: '/classes', icon: School },
        { key: 'enseignants', href: '/enseignants', icon: Users },
        { key: 'emplois', href: '/emplois-du-temps', icon: CalendarClock },
        { key: 'notes', href: '/notes', icon: PenLine, bientot: true },
        { key: 'releves', href: '/releves', icon: FileText, bientot: true },
      ],
    },
    {
      titre: 'sectionVieScolaire',
      items: [
        { key: 'assiduite', href: '/assiduite', icon: ClipboardCheck },
        { key: 'services', href: '/services', icon: Shirt, bientot: true },
        { key: 'communication', href: '/communication', icon: Megaphone, bientot: true },
      ],
    },
    ...(parametrage
      ? [
          {
            titre: 'sectionAdministration' as CleNav,
            items: [
              { key: 'parametres' as CleNav, href: '/parametres', icon: Settings },
              ...(role === 'direction' ? [{ key: 'abonnement' as CleNav, href: '/abonnement', icon: CreditCard }] : []),
            ],
          },
        ]
      : []),
  ]
}

function initiales(nom: string) {
  return nom
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join('')
}

export default function ClientLayout({
  children,
  role,
  etablissementNom,
  anneeLibelle,
  utilisateurNom,
  bandeau,
  locale,
  dict,
}: {
  children: React.ReactNode
  role: Role
  etablissementNom: string
  anneeLibelle: string | null
  utilisateurNom: string
  bandeau: Bandeau | null
  locale: string
  dict: Dictionary
}) {
  const [ouvert, setOuvert] = useState(false)
  const pathname = usePathname()
  const [pathnamePrecedent, setPathnamePrecedent] = useState(pathname)
  const nav = dict.nav

  // Referme le tiroir mobile à chaque changement de route (ajustement d'état
  // pendant le rendu plutôt qu'un effet, cf. react-hooks/set-state-in-effect).
  if (pathname !== pathnamePrecedent) {
    setPathnamePrecedent(pathname)
    setOuvert(false)
  }

  const estActif = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const contenuSidebar = (
    <div className="flex h-full flex-col bg-[var(--sidebar)]">
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/30">
          <GraduationCap className="h-5 w-5" />
        </span>
        <span className="font-heading text-lg font-semibold tracking-wide text-sidebar-text-strong">D-Scholar</span>
      </div>

      <div className="mx-3 mb-2 rounded-xl border border-sidebar-line bg-sidebar-hover px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-sidebar-text-strong" title={etablissementNom}>{etablissementNom}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-sidebar-text">
          <CalendarDays className="h-3.5 w-3.5" />
          {anneeLibelle ? `${nav.anneeActive} ${anneeLibelle}` : nav.aucuneAnnee}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {sections(role).map((section) => (
          <div key={section.titre} className="mt-4">
            <p className="px-3 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-sidebar-text/60">{nav[section.titre]}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) =>
                item.bientot ? (
                  <li key={item.key}>
                    <span className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-text/45">
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="flex-1 truncate">{nav[item.key]}</span>
                      <span className="rounded-full border border-sidebar-line px-1.5 py-px text-[0.62rem] font-medium">{dict.common.soon}</span>
                    </span>
                  </li>
                ) : (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        estActif(item.href)
                          ? 'bg-sidebar-active text-sidebar-text-strong'
                          : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong'
                      }`}
                    >
                      {estActif(item.href) && <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-secondary" />}
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{nav[item.key]}</span>
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-sidebar-line px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-sidebar-text-strong">
          {initiales(utilisateurNom)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-text-strong">{utilisateurNom}</p>
          <p className="truncate text-xs text-sidebar-text">{dict.roles[role]}</p>
        </div>
        <a href="/logout" title={dict.common.logout} aria-label={dict.common.logout} className="rounded-lg p-2 text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong">
          <LogOut className="h-4 w-4 rtl:-scale-x-100" />
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh">
      {/* Tiroir mobile */}
      {ouvert && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setOuvert(false)} />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] shadow-2xl">
            {contenuSidebar}
            <button
              type="button"
              className="absolute top-4 -end-12 rounded-lg p-2 text-white"
              onClick={() => setOuvert(false)}
              aria-label={nav.closeSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar fixe desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:start-0 lg:z-40 lg:flex lg:w-64">{contenuSidebar}</div>

      <div className="lg:ps-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-surface-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button type="button" className="-ms-1 rounded-lg p-2 text-foreground-muted hover:bg-primary-soft lg:hidden" onClick={() => setOuvert(true)} aria-label={nav.openSidebar}>
            <Menu className="h-6 w-6" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground lg:hidden">{etablissementNom}</p>
          <div className="hidden flex-1 lg:block" />
          <div className="flex shrink-0 items-center gap-1">
            <LanguageSelector currentLang={locale} />
            <ThemeSwitcher libelles={dict.theme} />
          </div>
        </header>

        {bandeau && (
          <div
            role="status"
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 text-sm sm:px-6 lg:px-8 ${
              bandeau.niveau === 'alerte' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warning/20 bg-warning/10 text-warning'
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 font-medium">
              {bandeau.texte}
              {bandeau.complement && <span className="font-normal"> {bandeau.complement}</span>}
            </p>
            {bandeau.action && (
              <Link href={bandeau.action.href} className="rounded-lg bg-surface px-3 py-1 text-xs font-semibold text-foreground shadow-xs hover:bg-background">
                {bandeau.action.libelle}
              </Link>
            )}
          </div>
        )}

        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
