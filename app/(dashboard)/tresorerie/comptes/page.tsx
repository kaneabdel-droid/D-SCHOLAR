import { getDictionary, getLocale } from '@/dictionaries'
import { createClient } from '@/utils/supabase/server'
import ComptesTable from './ComptesTable'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'

export default async function ComptesPage() {
  await requireParametrage()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  const { data: comptes } = await supabase
    .from('comptes_tresorerie')
    .select('*')
    .order('nom')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{dict.tresorerie.comptes.title}</h2>
      </div>
      
      <ComptesTable comptes={comptes || []} dict={dict} />
    </div>
  )
}
