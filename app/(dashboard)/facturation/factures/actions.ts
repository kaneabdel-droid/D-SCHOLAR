'use server'

import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'

export async function addFacture(formData: FormData) {
  const context = await requireParametrage()
  const supabase = await createClient()
  
  const eleve_id = formData.get('eleve_id') as string
  const motif = formData.get('motif') as string
  const date_echeance = formData.get('date_echeance') as string
  const montant = parseInt(formData.get('montant') as string, 10)

  if (!eleve_id || !motif || !date_echeance || isNaN(montant) || montant <= 0) {
    return { error: 'Veuillez remplir correctement tous les champs obligatoires' }
  }

  const { data: userData } = await supabase.from('utilisateurs').select('etablissement_id, id').single()
  const etablissement_id = userData?.etablissement_id
  const utilisateur_id = userData?.id

  if (!etablissement_id || !utilisateur_id) return { error: 'Etablissement introuvable' }

  const { error } = await supabase.from('factures_eleves').insert({
    etablissement_id,
    annee_id: context.anneeActive?.id,
    eleve_id,
    motif,
    montant,
    date_echeance,
    statut: 'en_attente',
    created_by: utilisateur_id
  })

  if (error) {
    console.error(error)
    return { error: 'Erreur lors de la création de la facture' }
  }

  revalidatePath('/facturation/factures')
  return { success: true }
}

export async function deleteFacture(id: string) {
  await requireParametrage()
  const supabase = await createClient()

  // On vérifie d'abord le statut de la facture, on ne peut pas supprimer une facture qui a déjà des paiements.
  const { data: facture } = await supabase.from('factures_eleves').select('statut').eq('id', id).single()
  
  if (facture?.statut !== 'en_attente') {
    return { error: 'Impossible de supprimer une facture ayant des paiements. Veuillez supprimer les paiements d\'abord.' }
  }

  const { error } = await supabase.from('factures_eleves').delete().eq('id', id)

  if (error) {
    return { error: 'Erreur lors de la suppression de la facture' }
  }

  revalidatePath('/facturation/factures')
  return { success: true }
}
