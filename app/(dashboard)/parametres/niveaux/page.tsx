import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { cycleAutorise, PALIERS } from '@/lib/abonnements/paliers'
import type { Ligne } from '@/lib/parametres/entites'
import { getDictionary, getLocale } from '@/dictionaries'
import EntiteTable from '../EntiteTable'

export default async function NiveauxPage() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  const [{ data: niveaux }, { data: series }, { data: options }] = await Promise.all([
    supabase.from('niveaux').select('id, ordre, code, nom, cycle, a_series, actif').order('ordre'),
    supabase.from('series').select('id, code, nom, actif').order('code'),
    supabase.from('options').select('id, code, nom, actif').order('code'),
  ])

  // Les séries n'ont de sens que pour un établissement qui a le lycée.
  const avecLycee = cycleAutorise(context.palier, 'secondaire')

  return (
    <div className="space-y-6">
      <EntiteTable cle="niveaux" lignes={(niveaux ?? []) as Ligne[]} dict={dict} cyclesAutorises={PALIERS[context.palier].cyclesAutorises} />
      {avecLycee && <EntiteTable cle="series" lignes={(series ?? []) as Ligne[]} dict={dict} />}
      <EntiteTable cle="options" lignes={(options ?? []) as Ligne[]} dict={dict} />
    </div>
  )
}
