'use server'

import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'

export async function addPersonnel(formData: FormData) {
  await requireParametrage()
  const supabase = await createClient()

  const { data: userData } = await supabase.from('utilisateurs').select('etablissement_id').single()
  const etablissement_id = userData?.etablissement_id
  if (!etablissement_id) return { error: 'Etablissement introuvable' }

  const prenom = formData.get('prenom') as string
  const nom = formData.get('nom') as string
  const telephone = formData.get('telephone') as string
  const civilite = formData.get('civilite') as string
  const statut = formData.get('statut') as string
  const salaire_de_base = parseInt(formData.get('salaire_de_base') as string, 10) || null
  const taux_horaire = parseInt(formData.get('taux_horaire') as string, 10) || null

  if (!prenom || !nom) {
    return { error: 'Veuillez remplir le nom et le prénom' }
  }

  const { error } = await supabase.from('enseignants').insert({
    etablissement_id,
    prenom,
    nom,
    telephone,
    civilite,
    statut: statut || 'titulaire',
    salaire_de_base,
    taux_horaire
  })

  if (error) return { error: 'Erreur lors de l\'ajout du membre du personnel' }

  revalidatePath('/rh/personnel')
  return { success: true }
}

export async function deletePersonnel(id: string) {
  await requireParametrage()
  const supabase = await createClient()

  const { error } = await supabase.from('enseignants').delete().eq('id', id)
  if (error) return { error: 'Impossible de supprimer ce profil car il est lié à d\'autres données (classes, paiements).' }

  revalidatePath('/rh/personnel')
  return { success: true }
}
