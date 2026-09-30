'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { withRetry, withRetryResult } from '@/utils/supabase/retry'
import { isAdminEmail } from '@/lib/admin/auth'

type ActionResult = { success?: true; error?: string }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function checkAdmin(): Promise<string | null> {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  return isAdminEmail(sharedUser?.email) || isAdminEmail(localUser?.email) ? null : 'Non autorisé'
}

// Groupe + compte du propriétaire / DG (compte dédié, sans ligne utilisateurs :
// il ouvre directement la vue groupe). Compensation si une étape échoue.
export async function creerGroupe(formData: FormData): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()
  const email = v('email').toLowerCase()
  const motDePasse = (formData.get('password') as string | null) ?? ''
  if (!v('nom')) return { error: 'Le nom du groupe est requis' }
  if (!v('dg_nom')) return { error: 'Le nom du DG est requis' }
  if (!EMAIL.test(email)) return { error: 'Email du DG invalide' }
  if (motDePasse.length < 8) return { error: 'Le mot de passe doit contenir au moins 8 caractères' }

  const supabase = createAdminClient()
  const { data: groupe, error } = await withRetryResult(() => supabase.from('groupes').insert({ nom: v('nom') }).select('id').single())
  if (error || !groupe) return { error: error?.message ?? 'Échec de la création du groupe' }
  const annuler = () => withRetry(() => supabase.from('groupes').delete().eq('id', groupe.id)).catch(() => {})

  // Compte dédié (cf. mon_groupe_id(), 10_groupes.sql) : jamais celui d'un
  // membre du personnel, sinon ses écrans de site mélangeraient tous les sites.
  const { data: cree, error: ec } = await withRetryResult(() => supabase.auth.admin.createUser({ email, password: motDePasse, email_confirm: true }))
  if (!cree?.user) {
    await annuler()
    return { error: ec?.message?.includes('already') ? 'Cet email a déjà un compte : utilisez une adresse dédiée au DG.' : `Compte DG : ${ec?.message ?? 'échec de création'}` }
  }
  const { error: em } = await withRetryResult(() =>
    supabase.from('membres_groupe').insert({ user_id: cree.user.id, groupe_id: groupe.id, role: 'proprietaire', prenom: v('dg_prenom') || null, nom: v('dg_nom'), email, telephone: v('dg_telephone') || null })
  )
  if (em) {
    await withRetry(() => supabase.auth.admin.deleteUser(cree.user.id)).catch(() => {})
    await annuler()
    return { error: em.message }
  }
  revalidatePath('/admin/groupes')
  return { success: true }
}

export async function rattacherEtablissement(groupeId: string, etablissementId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!etablissementId) return { error: 'Choisissez un établissement' }
  const supabase = createAdminClient()
  const { error } = await withRetryResult(() => supabase.from('etablissements').update({ groupe_id: groupeId }).eq('id', etablissementId))
  if (error) return { error: error.message }
  revalidatePath('/admin/groupes')
  return { success: true }
}

export async function detacherEtablissement(etablissementId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  const supabase = createAdminClient()
  const { error } = await withRetryResult(() => supabase.from('etablissements').update({ groupe_id: null }).eq('id', etablissementId))
  if (error) return { error: error.message }
  revalidatePath('/admin/groupes')
  return { success: true }
}

export async function basculerMembre(userId: string, actif: boolean): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  const supabase = createAdminClient()
  const { error } = await withRetryResult(() => supabase.from('membres_groupe').update({ actif }).eq('user_id', userId))
  if (error) return { error: error.message }
  revalidatePath('/admin/groupes')
  return { success: true }
}
