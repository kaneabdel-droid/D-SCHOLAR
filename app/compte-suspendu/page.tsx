import { redirect } from 'next/navigation'
import { PauseCircle } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import AbonnementPanel from '@/app/(dashboard)/abonnement/AbonnementPanel'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { fmt } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'

// Hors du layout (dashboard) : c'est lui qui redirige ici quand l'accès est
// suspendu (retard > 30 jours ou suspension manuelle). La direction peut payer
// directement depuis cette page pour rétablir l'accès.
export default async function CompteSuspenduPage() {
  const context = await getCurrentUserContext()
  if (context.etablissementStatut === 'actif' && context.acces !== 'suspendu') redirect('/dashboard')

  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.suspendu
  // Une suspension manuelle (plateforme) ne se lève pas par un paiement en ligne.
  const peutPayer = context.role === 'direction' && context.etablissementStatut === 'actif'

  return (
    <div className="relative min-h-dvh bg-background px-4 py-12">
      <div className="absolute top-4 end-4">
        <LanguageSelector currentLang={locale} />
      </div>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="rounded-2xl border border-surface-border bg-surface p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <PauseCircle className="h-7 w-7" />
          </span>
          <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="mt-2 text-sm text-foreground-muted">{fmt(t.desc, { nom: context.etablissementNom })}</p>
          <p className="mt-4 text-sm text-foreground">{context.role === 'direction' ? t.contactPlateforme : t.contactDirection}</p>
          <a href="/logout" className="mt-6 inline-block text-sm font-medium text-foreground-muted hover:text-danger">{dict.common.logout}</a>
        </div>
        {peutPayer && <AbonnementPanel context={context} dict={dict} locale={locale} />}
      </div>
    </div>
  )
}
