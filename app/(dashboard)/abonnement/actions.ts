'use server'

import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { createAdminClient } from '@/utils/supabase/admin'
import type { PalierCode } from '@/lib/abonnements/paliers'
import { estPalierValide, estPlanValide } from '@/lib/abonnements/plans'
import { etatAbonnement } from '@/lib/abonnements/etat'
import { creerSouscriptionEtTranche1, lancerPaiement, telephoneValide, trancheUne, type ErreurPaiement, type Tranche } from '@/lib/abonnements/paiement'
import { reconcilierParPaiementId } from '@/lib/abonnements/reconcile'
import { getDictionary, type Dictionary } from '@/dictionaries'

type ResultatDemarrage = { success: true; checkoutUrl: string } | { error: string }

// Toutes les écritures passent par le client service role (aucune policy
// d'écriture sur ces tables) : le rôle est vérifié ici, et l'établissement
// vient toujours du contexte de session, jamais des paramètres.
async function contexteDirection() {
  const context = await getCurrentUserContext()
  const dict = await getDictionary()
  // Démo publique : aucun paiement réel ne doit pouvoir être lancé.
  return { context, dict, autorise: context.role === 'direction' && !context.estDemo }
}

function messagePaiement(dict: Dictionary, erreur: ErreurPaiement) {
  return erreur === 'enCours' ? dict.abonnement.erreurs.enCours : erreur === 'provider' ? dict.abonnement.erreurs.provider : dict.errors.generic
}

async function payer(context: Awaited<ReturnType<typeof getCurrentUserContext>>, dict: Dictionary, palier: PalierCode, echeance: { id: string; rang: number; pourcentage: number; montant: number }, pays: string, telephone: string): Promise<ResultatDemarrage> {
  const res = await lancerPaiement({
    etablissementId: context.etablissementId,
    etablissementNom: context.etablissementNom,
    email: context.email ?? '',
    prenom: context.prenom ?? '',
    nom: context.nom ?? '',
    palier,
    echeance,
    pays,
    telephone,
  })
  return 'checkoutUrl' in res ? { success: true, checkoutUrl: res.checkoutUrl } : { error: messagePaiement(dict, res.erreur) }
}

export async function souscrire(palier: string, plan: string, pays: string, telephone: string): Promise<ResultatDemarrage> {
  const { context, dict, autorise } = await contexteDirection()
  const e = dict.abonnement.erreurs
  if (context.estDemo) return { error: dict.errors.demo }
  if (!autorise) return { error: dict.abonnement.directionOnly }
  if (!estPalierValide(palier)) return { error: e.palier }
  if (!estPlanValide(plan)) return { error: e.plan }
  if (!telephoneValide(pays, telephone)) return { error: e.telephone }

  const etat = await etatAbonnement(context.etablissementId)
  if (!etat.peutSouscrire) return { error: e.dejaCouvert }

  // Une souscription en attente de même formule est reprise telle quelle ; une
  // autre formule la remplace (elle n'a encore rien encaissé).
  let tranche: Tranche | null = null
  if (etat.enAttente) {
    if (etat.enAttente.palier === palier && etat.enAttente.plan === plan) {
      tranche = await trancheUne(etat.enAttente.id)
    } else {
      const supabase = createAdminClient()
      const echeancesIds = etat.enAttente.echeances.map((x) => x.id)
      await supabase.from('paiements_abonnement').update({ abandonne_le: new Date().toISOString() }).in('echeance_id', echeancesIds).eq('statut', 'en_attente').is('abandonne_le', null)
      await supabase.from('souscriptions').update({ statut: 'annulee' }).eq('id', etat.enAttente.id).eq('statut', 'en_attente')
    }
  }
  tranche ??= await creerSouscriptionEtTranche1(context.etablissementId, palier, plan)
  if ('erreur' in tranche) return { error: messagePaiement(dict, tranche.erreur) }

  return payer(context, dict, palier, tranche.echeance, pays, telephone)
}

export async function payerEcheance(echeanceId: string, pays: string, telephone: string): Promise<ResultatDemarrage> {
  const { context, dict, autorise } = await contexteDirection()
  const e = dict.abonnement.erreurs
  if (context.estDemo) return { error: dict.errors.demo }
  if (!autorise) return { error: dict.abonnement.directionOnly }
  if (!telephoneValide(pays, telephone)) return { error: e.telephone }

  const supabase = createAdminClient()
  const { data: echeance } = await supabase
    .from('echeances_abonnement')
    .select('id, rang, pourcentage, montant, statut, souscription_id, souscriptions(palier, statut)')
    .eq('id', echeanceId)
    .eq('etablissement_id', context.etablissementId)
    .maybeSingle()
  const souscription = Array.isArray(echeance?.souscriptions) ? echeance?.souscriptions[0] : echeance?.souscriptions
  if (!echeance || !souscription || echeance.statut !== 'a_payer' || souscription.statut === 'annulee') return { error: e.rienAPayer }

  // Les tranches se règlent dans l'ordre (la 1 fixe le début de la période).
  const { count: precedentes } = await supabase
    .from('echeances_abonnement')
    .select('id', { count: 'exact', head: true })
    .eq('souscription_id', echeance.souscription_id)
    .eq('statut', 'a_payer')
    .lt('rang', echeance.rang)
  if (precedentes) return { error: e.ordre }

  return payer(context, dict, souscription.palier as PalierCode, echeance, pays, telephone)
}

export type StatutVerification = { statut: 'paye' | 'en_attente' | 'echoue' }

// Poll depuis /abonnement/retour : ne conclut jamais depuis les paramètres
// d'URL (Chariow.md §8), redemande l'état réel au provider.
export async function verifierPaiement(paiementId: string): Promise<StatutVerification> {
  const context = await getCurrentUserContext()
  const supabase = createAdminClient()

  const { data: ligne } = await supabase.from('paiements_abonnement').select('etablissement_id, statut').eq('id', paiementId).maybeSingle()
  if (!ligne || ligne.etablissement_id !== context.etablissementId) return { statut: 'echoue' }
  if (ligne.statut !== 'en_attente') return { statut: ligne.statut }

  await reconcilierParPaiementId(paiementId)

  const { data: relu } = await supabase.from('paiements_abonnement').select('statut').eq('id', paiementId).single()
  return { statut: relu?.statut ?? 'en_attente' }
}
