'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { withRetry, withRetryResult } from '@/utils/supabase/retry'
import { isAdminEmail } from '@/lib/admin/auth'
import { PALIER_CODES, type PalierCode } from '@/lib/abonnements/paliers'

type ActionResult = { success?: true; error?: string }

async function checkAdmin(): Promise<string | null> {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  return isAdminEmail(sharedUser?.email) || isAdminEmail(localUser?.email) ? null : 'Non autorisé'
}

export type NouvelEtablissement = {
  nom: string
  ville: string
  telephone: string
  palier: PalierCode
  directionNom: string
  directionPrenom: string
  directionEmail: string
  directionPassword: string
  /** Accès offert jusqu'à cette date (AAAA-MM-JJ), vide = aucun. */
  accesOffertJusquAu: string
}

// Crée l'établissement, son référentiel par défaut (niveaux / séries / matières
// du palier) et le compte de la direction, avec compensation à chaque étape
// pour ne laisser ni établissement vide ni compte auth orphelin.
export async function creerEtablissement(e: NouvelEtablissement): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!e.nom.trim()) return { error: 'Le nom est requis' }
  if (!PALIER_CODES.includes(e.palier)) return { error: 'Palier invalide' }
  if (!e.directionNom.trim()) return { error: 'Le nom du directeur est requis' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.directionEmail.trim())) return { error: 'Email du directeur invalide' }
  if (e.directionPassword.length < 8) return { error: 'Le mot de passe doit contenir au moins 8 caractères' }

  const supabase = createAdminClient()

  const { data: etab, error: etabError } = await withRetryResult(() =>
    supabase
      .from('etablissements')
      .insert({
        nom: e.nom.trim(),
        ville: e.ville.trim() || null,
        telephone: e.telephone.trim() || null,
        palier: e.palier,
        acces_manuel_jusqu_au: /^\d{4}-\d{2}-\d{2}$/.test(e.accesOffertJusquAu) ? `${e.accesOffertJusquAu}T23:59:59Z` : null,
      })
      .select('id')
      .single()
  )
  if (etabError || !etab) return { error: etabError?.message ?? "Échec de la création de l'établissement" }

  const annuler = () => withRetry(() => supabase.from('etablissements').delete().eq('id', etab.id)).catch(() => {})

  const { error: refError } = await withRetryResult(() => supabase.rpc('initialiser_referentiel', { p_etablissement_id: etab.id }))
  if (refError) {
    await annuler()
    return { error: `Référentiel : ${refError.message}` }
  }

  const email = e.directionEmail.trim().toLowerCase()
  const { data: created, error: createError } = await withRetryResult(() =>
    supabase.auth.admin.createUser({ email, password: e.directionPassword, email_confirm: true })
  )
  if (createError || !created?.user) {
    await annuler()
    return { error: `Compte direction : ${createError?.message ?? 'échec de création'}` }
  }

  const { error: userError } = await withRetryResult(() =>
    supabase.from('utilisateurs').insert({
      id: created.user.id,
      etablissement_id: etab.id,
      role: 'direction',
      nom: e.directionNom.trim(),
      prenom: e.directionPrenom.trim() || null,
      email,
    })
  )
  if (userError) {
    await withRetry(() => supabase.auth.admin.deleteUser(created.user.id)).catch(() => {})
    await annuler()
    return { error: userError.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

// Changer de palier rejoue initialiser_referentiel() (idempotente) pour ouvrir
// les niveaux et matières des cycles nouvellement inclus.
export async function changerPalier(etablissementId: string, palier: PalierCode): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!PALIER_CODES.includes(palier)) return { error: 'Palier invalide' }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() => supabase.from('etablissements').update({ palier }).eq('id', etablissementId))
  if (error) return { error: error.message }

  const { error: refError } = await withRetryResult(() => supabase.rpc('initialiser_referentiel', { p_etablissement_id: etablissementId }))
  if (refError) return { error: `Palier changé, mais référentiel non complété : ${refError.message}` }

  revalidatePath('/admin')
  return { success: true }
}

export async function changerStatutEtablissement(etablissementId: string, statut: 'actif' | 'suspendu'): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() => supabase.from('etablissements').update({ statut }).eq('id', etablissementId))
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

// Accès complet offert jusqu'à une date (essai, démonstration), quel que soit
// l'état des paiements — cf. acces_etablissement() (05_abonnements.sql).
export async function definirAccesManuel(etablissementId: string, jusquAu: string | null): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (jusquAu && !/^\d{4}-\d{2}-\d{2}$/.test(jusquAu)) return { error: 'Date invalide' }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() =>
    supabase
      .from('etablissements')
      // Fin de journée : l'accès offert couvre toute la date choisie.
      .update({ acces_manuel_jusqu_au: jusquAu ? `${jusquAu}T23:59:59Z` : null })
      .eq('id', etablissementId)
  )
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

export async function modifierDateEcheance(echeanceId: string, date: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Date invalide' }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() =>
    supabase.from('echeances_abonnement').update({ date_echeance: date }).eq('id', echeanceId).eq('statut', 'a_payer')
  )
  if (error) return { error: error.message }

  revalidatePath('/admin/paiements')
  return { success: true }
}

export async function enregistrerProduitChariow(palier: PalierCode, pourcentage: number, productId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!PALIER_CODES.includes(palier) || ![100, 50, 25].includes(pourcentage)) return { error: 'Palier ou part invalide' }

  const supabase = createAdminClient()
  const { error } = productId.trim()
    ? await withRetryResult(() =>
        supabase.from('chariow_produits').upsert({ palier, pourcentage, product_id: productId.trim(), updated_at: new Date().toISOString() })
      )
    : await withRetryResult(() => supabase.from('chariow_produits').delete().eq('palier', palier).eq('pourcentage', pourcentage))
  if (error) return { error: error.message }

  revalidatePath('/admin/config')
  return { success: true }
}
