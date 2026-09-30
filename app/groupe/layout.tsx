import { Suspense } from 'react'
import Link from 'next/link'
import { Building2, LogOut } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { getGroupeContext } from '@/lib/auth/getGroupeContext'
import { getDictionary, getLocale } from '@/dictionaries'
import GroupeNav from './GroupeNav'

// Vue du propriétaire / directeur général : lecture seule sur tous les sites.
export default async function GroupeLayout({ children }: { children: React.ReactNode }) {
  const groupe = await getGroupeContext()
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.groupe
  const nom = [groupe.prenom, groupe.nom].filter(Boolean).join(' ')

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-surface-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/groupe" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/30"><Building2 className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{groupe.groupeNom}</span>
              <span className="block truncate text-xs text-foreground-muted">{t.roles[groupe.role]}{nom ? ` · ${nom}` : ''} · {t.lectureSeule}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-0.5">
            <LanguageSelector currentLang={locale} />
            <ThemeSwitcher libelles={dict.theme} />
            <a href="/logout" title={dict.common.logout} aria-label={dict.common.logout} className="rounded-lg p-2 text-foreground-muted hover:bg-primary-soft hover:text-danger">
              <LogOut className="h-5 w-5 rtl:-scale-x-100" />
            </a>
          </div>
        </div>
        <Suspense>
          <GroupeNav
            onglets={[
              { href: '/groupe', libelle: t.onglets.synthese },
              { href: '/groupe/comparatifs', libelle: t.onglets.comparatifs },
              { href: '/groupe/finances', libelle: t.onglets.finances },
              { href: '/groupe/etablissements', libelle: t.onglets.etablissements },
            ]}
          />
        </Suspense>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
