import { createClient } from '@/utils/supabase/server'
import type { Ligne } from '@/lib/parametres/entites'
import { getDictionary, getLocale } from '@/dictionaries'
import EntiteTable from '../EntiteTable'

export default async function AppreciationsPage() {
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const { data } = await supabase.from('appreciations').select('id, moyenne_min, libelle, categorie, actif').order('moyenne_min', { ascending: false })

  return <EntiteTable cle="appreciations" lignes={(data ?? []) as Ligne[]} dict={dict} />
}
