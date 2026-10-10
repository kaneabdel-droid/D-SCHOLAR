'use server'

import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'

export async function addCompte(formData: FormData) {
  await requireParametrage()
  const supabase = await createClient()
  
  const nom = formData.get('nom') as string
  const type = formData.get('type') as string
  const soldeInitial = parseInt(formData.get('solde_initial') as string, 10) || 0

  if (!nom || !type) {
    return { error: 'Veuillez remplir les champs obligatoires' }
  }

  // L'etablissement_id est géré via les policies/defaults si possible,
  // Mais ici on l'injecte explicitement pour éviter les problèmes si ce n'est pas le cas
  const { data: userData } = await supabase.from('utilisateurs').select('etablissement_id').single()
  const etablissement_id = userData?.etablissement_id

  if (!etablissement_id) {
    return { error: 'Etablissement introuvable' }
  }

  const { error } = await supabase.from('comptes_tresorerie').insert({
    etablissement_id,
    nom,
    type,
    solde_initial: soldeInitial,
  })

  if (error) {
    console.error(error)
    return { error: error.code === '23505' ? 'Un compte avec ce nom existe déjà' : 'Erreur lors de la création du compte' }
  }

  revalidatePath('/tresorerie/comptes')
  revalidatePath('/tresorerie/mouvements')
  return { success: true }
}

export async function updateCompte(id: string, formData: FormData) {
  await requireParametrage()
  const supabase = await createClient()
  
  const nom = formData.get('nom') as string
  const type = formData.get('type') as string
  
  if (!nom || !type) {
    return { error: 'Veuillez remplir les champs obligatoires' }
  }

  const { error } = await supabase
    .from('comptes_tresorerie')
    .update({ nom, type })
    .eq('id', id)

  if (error) {
    return { error: error.code === '23505' ? 'Un compte avec ce nom existe déjà' : 'Erreur lors de la modification' }
  }

  revalidatePath('/tresorerie/comptes')
  return { success: true }
}

export async function deleteCompte(id: string) {
  await requireParametrage()
  const supabase = await createClient()

  const { error } = await supabase.from('comptes_tresorerie').delete().eq('id', id)

  if (error) {
    return { error: 'Impossible de supprimer un compte ayant déjà des mouvements' }
  }

  revalidatePath('/tresorerie/comptes')
  return { success: true }
}
