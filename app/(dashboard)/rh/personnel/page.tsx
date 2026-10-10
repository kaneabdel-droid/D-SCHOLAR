import { getDictionary, getLocale } from '@/dictionaries'
import { createClient } from '@/utils/supabase/server'
import PersonnelTable from './PersonnelTable'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'

export default async function PersonnelPage() {
  const context = await requireParametrage()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  const { data: personnel } = await supabase
    .from('enseignants')
    .select('*')
    .eq('etablissement_id', context.etablissementId)
    .order('nom')
    .order('prenom')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{dict.rh.personnel.title}</h2>
      </div>
      
      <PersonnelTable 
        personnel={personnel || []} 
        dict={dict} 
      />
    </div>
  )
}
