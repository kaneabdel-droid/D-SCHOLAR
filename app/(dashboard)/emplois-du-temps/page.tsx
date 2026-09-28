import PageHeader from '@/components/PageHeader'
import EmploiGrid from '@/components/EmploiGrid'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass, inputClass, labelClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { chargerCreneaux } from '@/lib/emploi'
import { anneesEtSelection } from '@/lib/scolarite'
import { getDictionary, getLocale } from '@/dictionaries'

export default async function EmploisPage({ searchParams }: { searchParams: Promise<{ annee?: string; classe?: string; enseignant?: string }> }) {
  await getCurrentUserContext()
  const sp = await searchParams
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.emplois
  const s = dict.scolarite

  const { annees, selection } = await anneesEtSelection(supabase, sp.annee)
  const [{ data: classes }, { data: enseignants }] = await Promise.all([
    selection ? supabase.from('classes').select('id, nom').eq('annee_id', selection.id).order('nom') : Promise.resolve({ data: [] }),
    supabase.from('enseignants').select('id, civilite, prenom, nom').eq('actif', true).order('nom'),
  ])

  // Par défaut : première classe de l'année.
  const classeId = sp.enseignant ? null : (classes ?? []).find((c) => c.id === sp.classe)?.id ?? (classes ?? [])[0]?.id ?? null
  const enseignantId = sp.enseignant && (enseignants ?? []).some((e) => e.id === sp.enseignant) ? sp.enseignant : null

  const creneaux = classeId
    ? await chargerCreneaux(supabase, { classeId })
    : enseignantId && selection
      ? await chargerCreneaux(supabase, { enseignantId, anneeId: selection.id })
      : []

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={<SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        {/* Deux formulaires GET : changer l'un remet l'autre à zéro. */}
        <form>
          {selection && <input type="hidden" name="annee" value={selection.id} />}
          <label className={labelClass} htmlFor="edt-classe">{t.parClasse}</label>
          <select id="edt-classe" name="classe" defaultValue={classeId ?? ''} className={inputClass}>
            <option value="" disabled>{t.choisir}</option>
            {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <button type="submit" className="mt-2 text-sm font-semibold text-primary hover:text-primary-hover">{t.afficher}</button>
        </form>
        <form>
          {selection && <input type="hidden" name="annee" value={selection.id} />}
          <label className={labelClass} htmlFor="edt-enseignant">{t.parEnseignant}</label>
          <select id="edt-enseignant" name="enseignant" defaultValue={enseignantId ?? ''} className={inputClass}>
            <option value="" disabled>{t.choisir}</option>
            {(enseignants ?? []).map((e) => <option key={e.id} value={e.id}>{`${e.civilite ?? ''} ${e.prenom} ${e.nom}`.trim()}</option>)}
          </select>
          <button type="submit" className="mt-2 text-sm font-semibold text-primary hover:text-primary-hover">{t.afficher}</button>
        </form>
      </div>
      <section className={cardClass}>
        {classeId || enseignantId ? <EmploiGrid creneaux={creneaux} jours={s.jours} vide={t.vide} /> : <p className="px-5 py-10 text-center text-sm text-foreground-muted">{t.invite}</p>}
      </section>
    </div>
  )
}
