import { BadgeCheck } from 'lucide-react'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { PALIERS } from '@/lib/abonnements/paliers'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import EtablissementForm from './EtablissementForm'

export default async function EtablissementPage() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.etablissement

  const [{ data: etab }, { data: niveaux }] = await Promise.all([
    supabase
      .from('etablissements')
      .select('nom, sigle, adresse, ville, telephone, email, niveau_min_compte_eleve, statut_juridique, mois_scolarite, palier, abonnement_expire_le')
      .eq('id', context.etablissementId)
      .single(),
    supabase.from('niveaux').select('code, nom').eq('actif', true).order('ordre'),
  ])

  const palier = PALIERS[context.palier]

  return (
    <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
      <section className={`${cardClass} p-5 sm:p-6`}>
        <h2 className="font-heading text-base font-semibold text-foreground">{t.title}</h2>
        <p className="mt-0.5 text-sm text-foreground-muted">{t.desc}</p>
        <EtablissementForm
          dict={dict}
          valeurs={etab ?? {}}
          niveaux={niveaux ?? []}
          lectureSeule={context.role !== 'direction'}
        />
      </section>

      <aside className={`${cardClass} h-fit p-5 sm:p-6`}>
        <h2 className="font-heading text-base font-semibold text-foreground">{t.abonnementTitle}</h2>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary-soft px-4 py-3">
          <BadgeCheck className="h-6 w-6 text-primary" />
          <div>
            <p className="text-xs text-foreground-muted">{t.palier}</p>
            <p className="font-heading text-lg font-semibold text-primary">{dict.paliers[context.palier]}</p>
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t.cyclesOuverts}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {palier.cyclesAutorises.map((cycle) => (
            <li key={cycle} className="rounded-full border border-surface-border px-3 py-1 text-xs font-medium text-foreground">{dict.cycles[cycle]}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-foreground-muted">
          {etab?.abonnement_expire_le
            ? fmt(t.expireLe, { date: new Date(etab.abonnement_expire_le).toLocaleDateString(intlLocale(locale)) })
            : t.nonPaye}
        </p>
      </aside>
    </div>
  )
}
