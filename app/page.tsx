import { ArrowRight, Check, FileBadge, GraduationCap, Route, School, Users } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { PALIERS, PALIER_CODES } from '@/lib/abonnements/paliers'
import { intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'

export default async function LandingPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.landing

  const features = [
    { icon: Route, titre: t.features.cursusTitle, texte: t.features.cursusText },
    { icon: School, titre: t.features.pedagogieTitle, texte: t.features.pedagogieText },
    { icon: FileBadge, titre: t.features.documentsTitle, texte: t.features.documentsText },
    { icon: Users, titre: t.features.famillesTitle, texte: t.features.famillesText },
  ]

  const descriptions = { elementaire: t.pricingElementaire, secondaire: t.pricingSecondaire, complet: t.pricingComplet }

  return (
    <div className="min-h-dvh bg-background">
      <header className="relative overflow-hidden bg-[var(--sidebar)] text-white">
        <div aria-hidden className="pointer-events-none absolute -top-40 end-0 h-[32rem] w-[32rem] rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, #5B7FEA, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 start-0 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #C9972B, transparent 70%)' }} />

        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-heading text-lg font-semibold tracking-wide">D-Scholar</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-white/90">
              <LanguageSelector currentLang={locale} />
            </div>
            <a href="/login" className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-[var(--sidebar)] hover:bg-white/90">{dict.common.loginLink}</a>
          </div>
        </nav>

        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
          <p className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">{t.badge}</p>
          <h1 className="rise-in mt-6 max-w-3xl font-heading text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">{t.title}</h1>
          <p className="rise-in mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg" style={{ '--rise-delay': '80ms' } as React.CSSProperties}>{t.subtitle}</p>
          <a href="/login" className="rise-in mt-10 inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 hover:brightness-105" style={{ '--rise-delay': '160ms' } as React.CSSProperties}>
            {t.cta} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          </a>
        </div>
      </header>

      <section className="mx-auto -mt-12 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, titre, texte }) => (
            <div key={titre} className="rounded-2xl border border-surface-border bg-surface p-6 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-heading text-base font-semibold text-foreground">{titre}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">{texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground">{t.pricingTitle}</h2>
          <p className="mt-3 text-foreground-muted">{t.pricingSubtitle}</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PALIER_CODES.map((code) => {
            const vedette = code === 'complet'
            return (
              <div
                key={code}
                className={`rounded-2xl border p-6 ${vedette ? 'border-primary bg-[var(--sidebar)] text-white shadow-xl shadow-primary/10' : 'border-surface-border bg-surface'}`}
              >
                <p className={`font-heading text-lg font-semibold ${vedette ? '' : 'text-foreground'}`}>{dict.paliers[code]}</p>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className={`font-heading text-4xl font-semibold tabular-nums ${vedette ? '' : 'text-foreground'}`}>
                    {PALIERS[code].prixAnnuelFcfa.toLocaleString(intlLocale(locale))}
                  </span>
                  <span className={`text-sm ${vedette ? 'text-white/60' : 'text-foreground-muted'}`}>{t.perYear}</span>
                </p>
                <p className={`mt-4 flex items-start gap-2 text-sm ${vedette ? 'text-white/80' : 'text-foreground-muted'}`}>
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${vedette ? 'text-secondary' : 'text-primary'}`} /> {descriptions[code]}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <footer className="border-t border-surface-border py-8 text-center text-sm text-foreground-muted">{t.footer}</footer>
    </div>
  )
}
