'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { withRetryResult } from '@/utils/supabase/retry'
import { isAdminEmail } from '@/lib/admin/auth'
import { PALIER_CODES, type PalierCode } from '@/lib/abonnements/paliers'
import { creerEtablissementAvecDirection, type NouvelEtablissement } from '@/lib/etablissements/creation'

type ActionResult = { success?: true; error?: string }

async function checkAdmin(): Promise<string | null> {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  return isAdminEmail(sharedUser?.email) || isAdminEmail(localUser?.email) ? null : 'Non autorisé'
}

export type { NouvelEtablissement }

const MESSAGES: Record<string, string> = {
  nom: 'Le nom est requis',
  palier: 'Palier invalide',
  directionNom: 'Le nom du directeur est requis',
  directionEmail: 'Email du directeur invalide',
  motDePasse: 'Le mot de passe doit contenir au moins 8 caractères',
}

// Création par la console : cf. lib/etablissements/creation.ts (compensation complète).
export async function creerEtablissement(e: NouvelEtablissement): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  const r = await creerEtablissementAvecDirection(createAdminClient(), e)
  if (r.error) return { error: MESSAGES[r.error] ?? r.error }
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

// Suppression définitive d'un établissement : toutes ses données partent en
// cascade (élèves, notes, paiements…), puis les comptes de connexion de son
// personnel et de ses familles. Le nom saisi doit correspondre exactement (garde
// contre un clic malheureux) ; les établissements de démonstration sont refusés
// (ils se gèrent depuis /admin/demo).
export async function supprimerEtablissement(etablissementId: string, nomSaisi: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()
  const { data: etab, error: etabError } = await withRetryResult(() =>
    supabase.from('etablissements').select('id, nom, est_demo').eq('id', etablissementId).single()
  )
  if (etabError || !etab) return { error: etabError?.message ?? 'Établissement introuvable' }
  if (etab.est_demo) return { error: 'Établissement de démonstration : à gérer depuis la page Démo' }
  if (nomSaisi.trim() !== etab.nom.trim()) return { error: 'Le nom saisi ne correspond pas' }

  // Comptes à supprimer après coup : utilisateurs.id référence auth.users sans
  // cascade, il faut donc d'abord retirer l'établissement (et ses lignes).
  const [{ data: personnel }, { data: familles }] = await Promise.all([
    supabase.from('utilisateurs').select('id').eq('etablissement_id', etablissementId),
    supabase.from('comptes_famille').select('id').eq('etablissement_id', etablissementId),
  ])
  const comptes = [...(personnel ?? []), ...(familles ?? [])].map((c) => c.id)

  const { error } = await withRetryResult(() => supabase.from('etablissements').delete().eq('id', etablissementId))
  if (error) return { error: error.message }

  let echecs = 0
  for (const id of comptes) {
    const { error: e } = await supabase.auth.admin.deleteUser(id)
    if (e) {
      echecs++
      console.error('Suppression du compte', id, e.message)
    }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/paiements')
  if (echecs) return { error: `Établissement supprimé, mais ${echecs} compte(s) de connexion n'ont pas pu être supprimés (voir les logs)` }
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

// Supprime une tentative de paiement échouée (aucun argent encaissé, n'a jamais
// crédité d'échéance). Le filtre statut = 'echoue' dans la requête elle-même fait
// foi : un paiement payé ou en attente n'est jamais supprimé, même appelé hors UI.
export async function supprimerPaiementEchoue(paiementId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()
  const { data, error } = await withRetryResult(() =>
    supabase.from('paiements_abonnement').delete().eq('id', paiementId).eq('statut', 'echoue').select('id')
  )
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Seuls les paiements échoués peuvent être supprimés' }

  revalidatePath('/admin/paiements')
  return { success: true }
}

// Suppression groupée de toutes les tentatives échouées (nettoyage de l'historique).
export async function supprimerTousPaiementsEchoues(): Promise<ActionResult & { nombre?: number }> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()
  const { data, error } = await withRetryResult(() =>
    supabase.from('paiements_abonnement').delete().eq('statut', 'echoue').select('id')
  )
  if (error) return { error: error.message }

  revalidatePath('/admin/paiements')
  return { success: true, nombre: data?.length ?? 0 }
}

export async function enregistrerProduitChariow(palier: PalierCode, pourcentage: number, productId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!PALIER_CODES.includes(palier) || ![100, 50].includes(pourcentage)) return { error: 'Palier ou part invalide' }

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
