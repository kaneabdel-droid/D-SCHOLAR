import { getDictionary, getLocale } from '@/dictionaries'
import { createClient } from '@/utils/supabase/server'
import MouvementsTable from './MouvementsTable'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'

export default async function MouvementsPage() {
  await requireParametrage()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  const [
    { data: mouvements },
    { data: comptes },
    { data: charges }
  ] = await Promise.all([
    supabase
      .from('mouvements_tresorerie')
      .select('*, comptes_tresorerie(nom), categories_charges(nom)')
      .order('date_mouvement', { ascending: false }),
    supabase.from('comptes_tresorerie').select('id, nom').order('nom'),
    supabase.from('categories_charges').select('id, nom').order('nom')
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{dict.tresorerie.mouvements.title}</h2>
      </div>
      
      <MouvementsTable 
        mouvements={mouvements || []} 
        comptes={comptes || []} 
        charges={charges || []} 
        dict={dict} 
      />
    </div>
  )
}
