import { redirect } from 'next/navigation'
import { PauseCircle } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { fmt } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'

// Hors du layout (dashboard) : c'est lui qui redirige ici quand l'établissement
// est suspendu. Le paiement en ligne des tranches arrive au lot 2.
export default async function CompteSuspenduPage() {
  const context = await getCurrentUserContext()
  if (context.etablissementStatut === 'actif') redirect('/dashboard')

  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.suspendu

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="absolute top-4 end-4">
        <LanguageSelector currentLang={locale} />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
          <PauseCircle className="h-7 w-7" />
        </span>
        <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">{t.title}</h1>
        <p className="mt-2 text-sm text-foreground-muted">{fmt(t.desc, { nom: context.etablissementNom })}</p>
        <p className="mt-4 text-sm text-foreground">{context.role === 'direction' ? t.contactPlateforme : t.contactDirection}</p>
        <a href="/logout" className="mt-8 inline-block text-sm font-medium text-foreground-muted hover:text-danger">{dict.common.logout}</a>
      </div>
    </div>
  )
}
