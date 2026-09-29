import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { PALIER_CODES, PALIERS, type PalierCode } from '@/lib/abonnements/paliers'
import { montantsTranches, PLAN_CODES } from '@/lib/abonnements/plans'
import { PAYS_TELEPHONE_SUPPORTES } from '@/lib/abonnements/telephone'
import { intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import InscriptionForm from './InscriptionForm'

export default async function TarifsPage({ searchParams }: { searchParams: Promise<{ palier?: string }> }) {
  const { palier } = await searchParams
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.tarifs

  const offres = PALIER_CODES.map((p) => ({
    palier: p,
    prix: PALIERS[p].prixAnnuelFcfa,
    plans: PLAN_CODES.map((plan) => ({ plan, tranches: montantsTranches(p, plan) })),
  }))
  const descriptions = { elementaire: dict.landing.pricingElementaire, secondaire: dict.landing.pricingSecondaire, complet: dict.landing.pricingComplet }

  return (
    <div className="min-h-dvh bg-background">
      <header className="bg-[var(--sidebar)] text-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-heading text-lg font-semibold tracking-wide">D-Scholar</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-white/90">
              <LanguageSelector currentLang={locale} />
            </div>
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10">{t.connexion}</Link>
          </div>
        </nav>
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t.title}</h1>
          <p className="mt-3 max-w-2xl text-white/75">{t.subtitle}</p>
        </div>
      </header>

      <main className="mx-auto -mt-8 max-w-5xl px-4 pb-16 sm:px-6">
        <InscriptionForm
          offres={offres}
          palierInitial={PALIER_CODES.includes(palier as PalierCode) ? (palier as PalierCode) : 'complet'}
          descriptions={descriptions}
          pays={PAYS_TELEPHONE_SUPPORTES as string[]}
          locale={intlLocale(locale)}
          dict={dict}
        />
        <p className="mt-6 text-center text-sm text-foreground-muted">
          {t.dejaCompte} <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">{t.connexion}</Link>
        </p>
      </main>
    </div>
  )
}
