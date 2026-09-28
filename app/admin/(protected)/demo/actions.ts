'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { withRetry, withRetryResult } from '@/utils/supabase/retry'
import { isAdminEmail } from '@/lib/admin/auth'

type ActionResult = { success?: true; error?: string }

async function checkAdmin(): Promise<string | null> {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  return isAdminEmail(sharedUser?.email) || isAdminEmail(localUser?.email) ? null : 'Non autorisé'
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Crée l'établissement de démonstration « Groupe scolaire Les Palmiers » avec
// deux comptes (direction et M. Ibrahima Ndiaye, enseignant Maths + PC), puis
// remplit toutes les données via creer_demo() (07_demo.sql). Compensation
// complète en cas d'échec : aucun établissement ni compte orphelin.
export async function creerDemo(emailDirection: string, emailEnseignant: string, motDePasse: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  const direction = emailDirection.trim().toLowerCase()
  const enseignant = emailEnseignant.trim().toLowerCase()
  if (!EMAIL.test(direction) || !EMAIL.test(enseignant)) return { error: 'Emails invalides' }
  if (direction === enseignant) return { error: 'Les deux emails doivent être différents' }
  if (motDePasse.length < 8) return { error: 'Le mot de passe doit contenir au moins 8 caractères' }

  const supabase = createAdminClient()
  const dansUnAn = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

  const { data: etab, error: etabError } = await withRetryResult(() =>
    supabase
      .from('etablissements')
      .insert({
        nom: 'Groupe scolaire Les Palmiers (démo)',
        sigle: 'GSLP',
        adresse: 'Rue 10 x Avenue Bourguiba, Sicap Liberté',
        ville: 'Dakar',
        telephone: '33 824 56 78',
        email: 'contact@lespalmiers.sn',
        palier: 'complet',
        acces_manuel_jusqu_au: dansUnAn,
      })
      .select('id')
      .single()
  )
  if (etabError || !etab) return { error: etabError?.message ?? "Échec de la création de l'établissement" }

  const comptes: string[] = []
  const annuler = async () => {
    await withRetry(() => supabase.from('etablissements').delete().eq('id', etab.id)).catch(() => {})
    for (const id of comptes) await withRetry(() => supabase.auth.admin.deleteUser(id)).catch(() => {})
  }

  const creerCompte = async (email: string, role: 'direction' | 'enseignant', prenom: string, nom: string) => {
    const { data, error } = await withRetryResult(() => supabase.auth.admin.createUser({ email, password: motDePasse, email_confirm: true }))
    if (error || !data?.user) throw new Error(`Compte ${email} : ${error?.message ?? 'échec de création'}`)
    comptes.push(data.user.id)
    const { error: insertError } = await withRetryResult(() =>
      supabase.from('utilisateurs').insert({ id: data.user.id, etablissement_id: etab.id, role, prenom, nom, email })
    )
    if (insertError) throw new Error(insertError.message)
    return data.user.id
  }

  try {
    await creerCompte(direction, 'direction', 'Awa', 'Ndoye')
    const idEnseignant = await creerCompte(enseignant, 'enseignant', 'Ibrahima', 'Ndiaye')

    const { error } = await supabase.rpc('creer_demo', { p_etablissement_id: etab.id, p_utilisateur_enseignant: idEnseignant })
    if (error) throw new Error(`Génération des données : ${error.message}`)
  } catch (err) {
    await annuler()
    return { error: (err as Error).message }
  }

  revalidatePath('/admin')
  return { success: true }
}
