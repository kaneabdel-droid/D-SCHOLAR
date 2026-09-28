import { createClient } from '@/utils/supabase/server'
import { getDictionary, getLocale } from '@/dictionaries'
import AnneesClient, { type Annee } from './AnneesClient'

export default async function AnneesPage() {
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  const { data } = await supabase
    .from('annees_scolaires')
    .select('id, libelle, date_debut, date_fin, decoupage, active, cloturee, periodes(id, rang, date_debut, date_fin, verrouillee)')
    .order('date_debut', { ascending: false })

  const annees = (data ?? []).map((a) => ({
    ...a,
    periodes: [...(a.periodes ?? [])].sort((x, y) => x.rang - y.rang),
  })) as Annee[]

  return <AnneesClient annees={annees} dict={dict} locale={locale} />
}
