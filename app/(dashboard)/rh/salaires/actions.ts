'use server'

import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'

export async function addSalaire(formData: FormData) {
  const context = await requireParametrage()
  const supabase = await createClient()

  const { data: userData } = await supabase.from('utilisateurs').select('etablissement_id, id').single()
  const etablissement_id = userData?.etablissement_id
  const utilisateur_id = userData?.id

  if (!etablissement_id || !utilisateur_id) return { error: 'Etablissement introuvable' }

  const enseignant_id = formData.get('enseignant_id') as string
  const mois_concerne = formData.get('mois_concerne') as string
  const montant = parseInt(formData.get('montant') as string, 10)
  const mode_paiement = formData.get('mode_paiement') as string
  const date_paiement = formData.get('date_paiement') as string

  if (!enseignant_id || !mois_concerne || !date_paiement || isNaN(montant) || montant <= 0) {
    return { error: 'Veuillez remplir correctement tous les champs obligatoires' }
  }

  const { error } = await supabase.from('paiements_salaires').insert({
    etablissement_id,
    annee_id: context.anneeActive?.id,
    enseignant_id,
    mois_concerne,
    montant,
    mode_paiement,
    date_paiement,
    created_by: utilisateur_id
  })

  if (error) {
    console.error(error)
    return { error: 'Erreur lors de l\'enregistrement du salaire' }
  }

  revalidatePath('/rh/salaires')
  revalidatePath('/tresorerie/mouvements')
  revalidatePath('/tresorerie/bilan')
  return { success: true }
}

export async function deleteSalaire(id: string) {
  await requireParametrage()
  const supabase = await createClient()

  const { error } = await supabase.from('paiements_salaires').delete().eq('id', id)
  if (error) return { error: 'Impossible de supprimer ce paiement.' }

  revalidatePath('/rh/salaires')
  revalidatePath('/tresorerie/mouvements')
  revalidatePath('/tresorerie/bilan')
  return { success: true }
}
