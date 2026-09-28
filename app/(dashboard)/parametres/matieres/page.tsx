import { createClient } from '@/utils/supabase/server'
import type { Ligne } from '@/lib/parametres/entites'
import { getDictionary, getLocale } from '@/dictionaries'
import EntiteTable from '../EntiteTable'

export default async function MatieresPage() {
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const { data } = await supabase.from('matieres').select('id, couleur, code, nom, actif').order('nom')

  return <EntiteTable cle="matieres" lignes={(data ?? []) as Ligne[]} dict={dict} />
}
