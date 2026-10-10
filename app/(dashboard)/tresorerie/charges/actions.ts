'use server'

import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'

export async function addCharge(formData: FormData) {
  await requireParametrage()
  const supabase = await createClient()
  
  const nom = formData.get('nom') as string

  if (!nom) {
    return { error: 'Veuillez remplir le nom de la catégorie' }
  }

  const { data: userData } = await supabase.from('utilisateurs').select('etablissement_id').single()
  const etablissement_id = userData?.etablissement_id

  if (!etablissement_id) return { error: 'Etablissement introuvable' }

  const { error } = await supabase.from('categories_charges').insert({
    etablissement_id,
    nom,
  })

  if (error) {
    return { error: error.code === '23505' ? 'Une catégorie avec ce nom existe déjà' : 'Erreur lors de la création de la catégorie' }
  }

  revalidatePath('/tresorerie/charges')
  revalidatePath('/tresorerie/mouvements')
  return { success: true }
}

export async function updateCharge(id: string, formData: FormData) {
  await requireParametrage()
  const supabase = await createClient()
  
  const nom = formData.get('nom') as string
  
  if (!nom) {
    return { error: 'Veuillez remplir le nom de la catégorie' }
  }

  const { error } = await supabase
    .from('categories_charges')
    .update({ nom })
    .eq('id', id)

  if (error) {
    return { error: error.code === '23505' ? 'Une catégorie avec ce nom existe déjà' : 'Erreur lors de la modification' }
  }

  revalidatePath('/tresorerie/charges')
  return { success: true }
}

export async function deleteCharge(id: string) {
  await requireParametrage()
  const supabase = await createClient()

  const { error } = await supabase.from('categories_charges').delete().eq('id', id)

  if (error) {
    return { error: 'Impossible de supprimer cette catégorie car elle est utilisée dans des mouvements' }
  }

  revalidatePath('/tresorerie/charges')
  return { success: true }
}
