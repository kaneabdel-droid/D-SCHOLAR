import PageHeader from '@/components/PageHeader'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { peutEcrire } from '@/lib/roles'
import { un } from '@/lib/scolarite'
import { intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import { NouvelleAnnonceButton, SupprimerAnnonce } from './CommunicationClient'

const TEINTES: Record<string, string> = {
  tous: 'bg-primary-soft text-primary',
  personnel: 'bg-secondary/15 text-foreground',
  familles: 'bg-success/10 text-success',
  classe: 'bg-warning/10 text-warning',
}

// Annonces de l'établissement : diffusées dans l'application (cloche de
// notifications) et sur le portail des familles — sans SMS.
export default async function CommunicationPage() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.communication
  const ecriture = peutEcrire(context.role, 'annonces') && context.acces === 'complet'

  const [{ data: annonces }, { data: classes }, { count: familles }] = await Promise.all([
    supabase.from('annonces').select('id, titre, contenu, cible, publiee_le, classes(nom)').order('publiee_le', { ascending: false }).limit(100),
    context.anneeActive ? supabase.from('classes').select('id, nom').eq('annee_id', context.anneeActive.id).order('nom') : Promise.resolve({ data: [] }),
    supabase.from('comptes_famille').select('id', { count: 'exact', head: true }).eq('actif', true),
  ])

  return (
    <div>
      <PageHeader title={t.title} subtitle={t.subtitle} actions={ecriture ? <NouvelleAnnonceButton classes={classes ?? []} dict={dict} /> : undefined} />
      <p className="mb-5 text-sm text-foreground-muted">{t.comptesFamille.replace('{n}', String(familles ?? 0))}</p>
      <div className="space-y-4">
        {(annonces ?? []).map((a) => (
          <article key={a.id} className={`${cardClass} p-5`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-base font-semibold text-foreground">{a.titre}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${TEINTES[a.cible] ?? ''}`}>
                    {t.cibles[a.cible as keyof typeof t.cibles]}{a.cible === 'classe' ? ` · ${un(a.classes as unknown as { nom: string } | null)?.nom ?? ''}` : ''}
                  </span>
                  {new Date(a.publiee_le).toLocaleString(loc, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {ecriture && <SupprimerAnnonce id={a.id} dict={dict} />}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-foreground">{a.contenu}</p>
          </article>
        ))}
        {(annonces ?? []).length === 0 && <p className={`${cardClass} px-5 py-12 text-center text-sm text-foreground-muted`}>{t.aucune}</p>}
      </div>
    </div>
  )
}
