import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { peutEcrire } from '@/lib/roles'
import { anneesEtSelection } from '@/lib/scolarite'
import { intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import AdmissionsClient, { type Candidature } from './AdmissionsClient'

export default async function AdmissionsPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const context = await getCurrentUserContext()
  const sp = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const s = dict.scolarite

  // Par défaut : l'année active (les admissions préparent la rentrée).
  const { annees, selection } = await anneesEtSelection(supabase, sp.annee)
  const [{ data: candidatures }, { data: niveaux }, { data: series }, { data: classes }] = await Promise.all([
    selection
      ? supabase.from('candidatures').select('*, niveaux(nom), series(code)').eq('annee_id', selection.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from('niveaux').select('id, nom, a_series').eq('actif', true).order('ordre'),
    supabase.from('series').select('id, code, nom').eq('actif', true).order('code'),
    selection ? supabase.from('classes').select('id, nom, niveau_id').eq('annee_id', selection.id).order('nom') : Promise.resolve({ data: [] }),
  ])

  return (
    <div>
      <PageHeader
        title={dict.admissions.title}
        subtitle={dict.admissions.subtitle}
        actions={<SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />}
      />
      {selection && (
        <AdmissionsClient
          anneeId={selection.id}
          candidatures={(candidatures ?? []) as unknown as Candidature[]}
          niveaux={niveaux ?? []}
          series={series ?? []}
          classes={classes ?? []}
          gestion={peutEcrire(context.role, 'admissions')}
          locale={intlLocale(locale)}
          dict={dict}
        />
      )}
    </div>
  )
}
