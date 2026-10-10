'use server'

import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'

export async function addMouvement(formData: FormData) {
  await requireParametrage()
  const supabase = await createClient()
  
  const type = formData.get('type') as string
  const compte_id = formData.get('compte_id') as string
  const categorie_id = formData.get('categorie_id') as string || null
  const date_mouvement = formData.get('date_mouvement') as string
  const libelle = formData.get('libelle') as string
  const reference_piece = formData.get('reference_piece') as string || null
  const montant = parseInt(formData.get('montant') as string, 10)

  if (!type || !compte_id || !date_mouvement || !libelle || isNaN(montant) || montant <= 0) {
    return { error: 'Veuillez remplir correctement les champs obligatoires' }
  }

  const { data: userData } = await supabase.from('utilisateurs').select('etablissement_id, id').single()
  const etablissement_id = userData?.etablissement_id
  const utilisateur_id = userData?.id

  if (!etablissement_id || !utilisateur_id) return { error: 'Etablissement introuvable' }

  const { error } = await supabase.from('mouvements_tresorerie').insert({
    etablissement_id,
    type,
    compte_id,
    categorie_id: categorie_id ? categorie_id : null,
    montant,
    date_mouvement,
    libelle,
    reference_piece,
    enregistre_par: utilisateur_id
  })

  if (error) {
    console.error(error)
    return { error: 'Erreur lors de l\'enregistrement du mouvement' }
  }

  revalidatePath('/tresorerie/mouvements')
  revalidatePath('/tresorerie/bilan')
  revalidatePath('/tresorerie/comptes')
  return { success: true }
}

export async function deleteMouvement(id: string) {
  await requireParametrage()
  const supabase = await createClient()

  const { error } = await supabase.from('mouvements_tresorerie').delete().eq('id', id)

  if (error) {
    return { error: 'Erreur lors de la suppression du mouvement' }
  }

  revalidatePath('/tresorerie/mouvements')
  revalidatePath('/tresorerie/bilan')
  revalidatePath('/tresorerie/comptes')
  return { success: true }
}
