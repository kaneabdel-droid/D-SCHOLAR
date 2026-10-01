import Link from 'next/link'
import { GraduationCap, Lock, LogOut } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import Notifications from '@/components/Notifications'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { getFamilleContext } from '@/lib/auth/getFamilleContext'
import { getDictionary, getLocale } from '@/dictionaries'
import PortailNav from './PortailNav'

// Portail des familles (parents et élèves) : lecture seule, pensé d'abord pour
// le téléphone. getFamilleContext renvoie le personnel vers son tableau de bord.
export default async function PortailLayout({ children }: { children: React.ReactNode }) {
  const famille = await getFamilleContext()
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const nom = [famille.prenom, famille.nom].filter(Boolean).join(' ')

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-surface-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/portail" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/30"><GraduationCap className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{famille.etablissementNom}</span>
              <span className="block truncate text-xs text-foreground-muted">{dict.portail.espace[famille.type]}{nom ? ` · ${nom}` : ''}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-0.5">
            <Notifications dict={dict} locale={locale} />
            <LanguageSelector currentLang={locale} />
            <ThemeSwitcher libelles={dict.theme} />
            <a href="/logout" title={dict.common.logout} aria-label={dict.common.logout} className="rounded-lg p-2 text-foreground-muted hover:bg-primary-soft hover:text-danger">
              <LogOut className="h-5 w-5 rtl:-scale-x-100" />
            </a>
          </div>
        </div>
        {!famille.verrouille && famille.enfants.length > 0 && (
          <PortailNav enfants={famille.enfants.map((e) => ({ id: e.id, prenom: e.prenom }))} accueil={dict.portail.accueil} />
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {famille.verrouille ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-surface-border bg-surface p-8 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
              <Lock className="h-7 w-7" />
            </span>
            <h1 className="mt-4 font-heading text-xl font-semibold text-foreground">{dict.portail.verrouille.titre}</h1>
            <p className="mt-2 text-sm text-foreground-muted">{dict.portail.verrouille.texte}</p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
