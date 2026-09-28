import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import type { Ligne } from '@/lib/parametres/entites'
import { getDictionary, getLocale } from '@/dictionaries'
import EntiteTable from '../EntiteTable'
import SeuilsForm from './SeuilsForm'

export default async function EvaluationsPage() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  const [{ data: types }, { data: etab }] = await Promise.all([
    supabase.from('types_evaluation').select('id, ordre, code, libelle, nombre_par_periode, poids, actif').order('ordre'),
    supabase.from('etablissements').select('moyenne_passage, moyenne_repechage').eq('id', context.etablissementId).single(),
  ])

  return (
    <div className="space-y-6">
      <EntiteTable cle="evaluations" lignes={(types ?? []) as Ligne[]} dict={dict} />
      <SeuilsForm passage={Number(etab?.moyenne_passage ?? 10)} repechage={Number(etab?.moyenne_repechage ?? 9)} dict={dict} />
    </div>
  )
}
