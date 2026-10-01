import Link from 'next/link'
import { ArrowRight, Backpack, Building2, GraduationCap, Info, Presentation, School, Users } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { getDictionary, getLocale } from '@/dictionaries'
import { connexionDemo } from './actions'

export default async function DecouvrirPage({ searchParams }: { searchParams?: Promise<{ demo_error?: string }> }) {
  const erreur = (await searchParams)?.demo_error === '1'
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.demo

  const roles = [
    { role: 'dg', icone: Building2, titre: t.dg.titre, desc: t.dg.desc },
    { role: 'direction', icone: School, titre: t.direction.titre, desc: t.direction.desc },
    { role: 'enseignant', icone: Presentation, titre: t.enseignant.titre, desc: t.enseignant.desc },
    { role: 'parent', icone: Users, titre: t.parent.titre, desc: t.parent.desc },
    { role: 'eleve', icone: Backpack, titre: t.eleve.titre, desc: t.eleve.desc },
  ]

  return (
    <div className="min-h-dvh bg-background">
      <header className="relative overflow-hidden bg-[var(--sidebar)] text-white">
        <div aria-hidden className="pointer-events-none absolute -top-40 end-0 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, #5B7FEA, transparent 70%)' }} />
        <nav className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-heading text-lg font-semibold tracking-wide">D-Scholar</span>
          </Link>
          <div className="rounded-lg bg-white/90">
            <LanguageSelector currentLang={locale} />
          </div>
        </nav>
        <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-10 text-center sm:px-6">
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/75">{t.subtitle}</p>
        </div>
      </header>

      <main className="mx-auto -mt-10 max-w-5xl px-4 pb-16 sm:px-6">
        {erreur && <p className="mb-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-center text-sm text-danger">{t.erreur}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map(({ role, icone: Icone, titre, desc }) => (
            <form key={role} action={connexionDemo} className="flex flex-col rounded-2xl border border-surface-border bg-surface p-6 shadow-sm transition hover:shadow-md">
              <input type="hidden" name="role" value={role} />
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icone className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-heading text-xl font-semibold text-foreground">{titre}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground-muted">{desc}</p>
              <button type="submit" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover">
                {t.bouton} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
              </button>
            </form>
          ))}
        </div>
        <div className="mt-6 space-y-2 text-center text-sm text-foreground-muted">
          <p className="flex items-start justify-center gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" /> {t.avertissement}</p>
          <p>{t.astuce}</p>
        </div>
      </main>
    </div>
  )
}
