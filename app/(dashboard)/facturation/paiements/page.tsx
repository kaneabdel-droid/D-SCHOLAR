import { getDictionary, getLocale } from '@/dictionaries'
import { createClient } from '@/utils/supabase/server'
import PaiementsTable from './PaiementsTable'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'

export default async function PaiementsPage() {
  const context = await requireParametrage()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  const [
    { data: paiements },
    { data: factures },
    { data: eleves }
  ] = await Promise.all([
    supabase
      .from('paiements_eleves')
      .select('*, eleves(nom, prenom, matricule)')
      .eq('annee_id', context.anneeActive?.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('factures_eleves')
      .select('id, eleve_id, motif, montant, statut')
      .eq('annee_id', context.anneeActive?.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('eleves')
      .select('id, nom, prenom, matricule')
      .eq('etablissement_id', context.etablissementId)
      .order('nom')
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{dict.facturation.paiements.title}</h2>
      </div>
      
      <PaiementsTable 
        paiements={paiements || []} 
        factures={factures || []} 
        eleves={eleves || []} 
        dict={dict} 
      />
    </div>
  )
}
