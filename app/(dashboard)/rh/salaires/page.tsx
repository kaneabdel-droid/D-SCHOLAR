import { getDictionary, getLocale } from '@/dictionaries'
import { createClient } from '@/utils/supabase/server'
import SalairesTable from './SalairesTable'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'

export default async function SalairesPage() {
  const context = await requireParametrage()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  const [
    { data: salaires },
    { data: personnel }
  ] = await Promise.all([
    supabase
      .from('paiements_salaires')
      .select('*, enseignants(nom, prenom, statut)')
      .eq('annee_id', context.anneeActive?.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('enseignants')
      .select('id, nom, prenom, statut, salaire_de_base, taux_horaire')
      .eq('etablissement_id', context.etablissementId)
      .order('nom')
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{dict.rh.salaires.title}</h2>
      </div>
      
      <SalairesTable 
        salaires={salaires || []} 
        personnel={personnel || []} 
        dict={dict} 
      />
    </div>
  )
}
