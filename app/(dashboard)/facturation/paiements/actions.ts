'use server'

import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'

export async function addPaiement(formData: FormData) {
  const context = await requireParametrage()
  const supabase = await createClient()
  
  const eleve_id = formData.get('eleve_id') as string
  const facture_id = formData.get('facture_id') as string || null
  const libelle = formData.get('libelle') as string
  const mode = formData.get('mode') as string
  const reference = formData.get('reference') as string || null
  const date_paiement = formData.get('date_paiement') as string
  const montant = parseInt(formData.get('montant') as string, 10)

  if (!eleve_id || !libelle || !mode || !date_paiement || isNaN(montant) || montant <= 0) {
    return { error: 'Veuillez remplir correctement tous les champs obligatoires' }
  }

  const { data: userData } = await supabase.from('utilisateurs').select('etablissement_id, id').single()
  const etablissement_id = userData?.etablissement_id
  const utilisateur_id = userData?.id

  if (!etablissement_id || !utilisateur_id) return { error: 'Etablissement introuvable' }

  // Le trigger trg_paiement_tresorerie s'occupera d'insérer dans mouvements_tresorerie
  // Le trigger trg_paiement_maj_facture s'occupera de mettre à jour le statut de la facture

  const { error } = await supabase.from('paiements_eleves').insert({
    etablissement_id,
    annee_id: context.anneeActive?.id,
    eleve_id,
    facture_id: facture_id ? facture_id : null,
    libelle,
    montant,
    mode,
    reference,
    date_paiement,
    created_by: utilisateur_id
  })

  if (error) {
    console.error(error)
    return { error: 'Erreur lors de l\'enregistrement du paiement' }
  }

  revalidatePath('/facturation/paiements')
  revalidatePath('/facturation/factures')
  revalidatePath('/tresorerie/mouvements')
  revalidatePath('/tresorerie/bilan')
  return { success: true }
}

export async function deletePaiement(id: string) {
  await requireParametrage()
  const supabase = await createClient()

  const { error } = await supabase.from('paiements_eleves').delete().eq('id', id)

  if (error) {
    return { error: 'Erreur lors de la suppression du paiement' }
  }

  revalidatePath('/facturation/paiements')
  revalidatePath('/facturation/factures')
  revalidatePath('/tresorerie/mouvements')
  revalidatePath('/tresorerie/bilan')
  return { success: true }
}
