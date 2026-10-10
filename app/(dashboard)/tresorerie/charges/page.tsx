
import { getDictionary, getLocale } from '@/dictionaries'
import { createClient } from '@/utils/supabase/server'
import ChargesTable from './ChargesTable'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'

export default async function ChargesPage() {
  await requireParametrage()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  const { data: charges } = await supabase
    .from('categories_charges')
    .select('*')
    .order('nom')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{dict.tresorerie.charges.title}</h2>
      </div>

      <ChargesTable charges={charges || []} dict={dict} />
    </div>
  )
}
