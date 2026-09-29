import { createClient } from '@/utils/supabase/server'
import { getDictionary, getLocale } from '@/dictionaries'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { PALIERS } from '@/lib/abonnements/paliers'
import AnneesClient, { type Annee } from './AnneesClient'

export default async function AnneesPage() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  const { data } = await supabase
    .from('annees_scolaires')
    .select('id, libelle, date_debut, date_fin, decoupage, decoupage_cycles, active, cloturee, periodes(id, rang, decoupage, date_debut, date_fin, verrouillee)')
    .order('date_debut', { ascending: false })

  const annees = (data ?? []).map((a) => ({
    ...a,
    periodes: [...(a.periodes ?? [])].sort((x, y) => x.decoupage.localeCompare(y.decoupage) || x.rang - y.rang),
  })) as Annee[]

  return <AnneesClient annees={annees} dict={dict} locale={locale} cycles={PALIERS[context.palier].cyclesAutorises} />
}
