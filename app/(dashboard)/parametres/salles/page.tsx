import { createClient } from '@/utils/supabase/server'
import type { Ligne } from '@/lib/parametres/entites'
import { getDictionary, getLocale } from '@/dictionaries'
import EntiteTable from '../EntiteTable'

export default async function SallesPage() {
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const { data } = await supabase.from('salles').select('id, nom, type, capacite, actif').order('nom')

  return <EntiteTable cle="salles" lignes={(data ?? []) as Ligne[]} dict={dict} />
}
