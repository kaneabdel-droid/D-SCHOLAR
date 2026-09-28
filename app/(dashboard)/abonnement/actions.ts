'use server'

import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { createAdminClient } from '@/utils/supabase/admin'
import { PALIERS } from '@/lib/abonnements/paliers'
import { estPalierValide, estPlanValide, PLANS, type Pourcentage } from '@/lib/abonnements/plans'
import { etatAbonnement } from '@/lib/abonnements/etat'
import { adaptateurActif, providerActif } from '@/lib/abonnements/registry'
import { reconcilierParPaiementId } from '@/lib/abonnements/reconcile'
import { PAYS_TELEPHONE_SUPPORTES } from '@/lib/abonnements/telephone'
import { getDictionary, type Dictionary } from '@/dictionaries'

type ResultatDemarrage = { success: true; checkoutUrl: string } | { error: string }

// Au-delà, une page de paiement provider est considérée expirée : on en ouvre une nouvelle.
const DUREE_REUTILISATION_MS = 30 * 60 * 1000

// Toutes les écritures passent par le client service role (aucune policy
// d'écriture sur ces tables) : le rôle est vérifié ici, et l'établissement
// vient toujours du contexte de session, jamais des paramètres.
async function contexteDirection() {
  const context = await getCurrentUserContext()
  const dict = await getDictionary()
  return { context, dict, autorise: context.role === 'direction' }
}

function telephoneValide(pays: string, telephone: string) {
  return (PAYS_TELEPHONE_SUPPORTES as string[]).includes(pays) && telephone.replace(/\D/g, '').length >= 7
}

export async function souscrire(palier: string, plan: string, pays: string, telephone: string): Promise<ResultatDemarrage> {
  const { context, dict, autorise } = await contexteDirection()
  const e = dict.abonnement.erreurs
  if (!autorise) return { error: dict.abonnement.directionOnly }
  if (!estPalierValide(palier)) return { error: e.palier }
  if (!estPlanValide(plan)) return { error: e.plan }
  if (!telephoneValide(pays, telephone)) return { error: e.telephone }

  const etat = await etatAbonnement(context.etablissementId)
  if (!etat.peutSouscrire) return { error: e.dejaCouvert }

  const supabase = createAdminClient()
  let souscriptionId: string | null = null

  // Une souscription en attente de même formule est reprise telle quelle ; une
  // autre formule la remplace (elle n'a encore rien encaissé).
  if (etat.enAttente) {
    if (etat.enAttente.palier === palier && etat.enAttente.plan === plan) {
      souscriptionId = etat.enAttente.id
    } else {
      const echeancesIds = etat.enAttente.echeances.map((x) => x.id)
      await supabase.from('paiements_abonnement').update({ abandonne_le: new Date().toISOString() }).in('echeance_id', echeancesIds).eq('statut', 'en_attente').is('abandonne_le', null)
      await supabase.from('souscriptions').update({ statut: 'annulee' }).eq('id', etat.enAttente.id).eq('statut', 'en_attente')
    }
  }

  if (!souscriptionId) {
    const { data, error } = await supabase.rpc('creer_souscription', {
      p_etablissement_id: context.etablissementId,
      p_palier: palier,
      p_plan: plan,
      p_montant_total: PALIERS[palier].prixAnnuelFcfa,
      p_repartition: PLANS[plan].repartition,
      p_decalages: PLANS[plan].decalagesMois,
    })
    if (error || !data) {
      console.error('souscrire:', error?.message)
      return { error: error?.code === '23505' ? e.enCours : dict.errors.generic }
    }
    souscriptionId = data as string
  }

  const { data: echeance } = await supabase
    .from('echeances_abonnement')
    .select('id, rang, pourcentage, montant')
    .eq('souscription_id', souscriptionId)
    .eq('rang', 1)
    .single()
  if (!echeance) return { error: dict.errors.generic }

  return demarrerPaiement(context, dict, palier, echeance, pays, telephone)
}

export async function payerEcheance(echeanceId: string, pays: string, telephone: string): Promise<ResultatDemarrage> {
  const { context, dict, autorise } = await contexteDirection()
  const e = dict.abonnement.erreurs
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

  return demarrerPaiement(context, dict, souscription.palier, echeance, pays, telephone)
}

async function demarrerPaiement(
  context: Awaited<ReturnType<typeof getCurrentUserContext>>,
  dict: Dictionary,
  palier: string,
  echeance: { id: string; rang: number; pourcentage: number; montant: number },
  pays: string,
  telephone: string
): Promise<ResultatDemarrage> {
  const supabase = createAdminClient()
  const provider = providerActif()

  // Anti double paiement : même tranche, même provider, page encore récente →
  // on renvoie la page déjà ouverte ; sinon l'ancienne tentative est abandonnée
  // (si elle est payée plus tard, elle sera traitée et marquée doublon).
  const { data: enCours } = await supabase
    .from('paiements_abonnement')
    .select('id, echeance_id, provider, checkout_url, created_at')
    .eq('etablissement_id', context.etablissementId)
    .eq('statut', 'en_attente')
    .is('abandonne_le', null)
    .maybeSingle()
  if (enCours) {
    const recent = Date.now() - new Date(enCours.created_at).getTime() < DUREE_REUTILISATION_MS
    if (enCours.echeance_id === echeance.id && enCours.provider === provider && enCours.checkout_url && recent) {
      return { success: true, checkoutUrl: enCours.checkout_url }
    }
    await supabase.from('paiements_abonnement').update({ abandonne_le: new Date().toISOString() }).eq('id', enCours.id)
  }

  const { data: paiement, error: insertError } = await supabase
    .from('paiements_abonnement')
    .insert({ etablissement_id: context.etablissementId, echeance_id: echeance.id, montant: echeance.montant, provider })
    .select('id')
    .single()
  if (insertError || !paiement) {
    if (insertError?.code === '23505') return { error: dict.abonnement.erreurs.enCours }
    console.error('demarrerPaiement(insert):', insertError?.message)
    return { error: dict.errors.generic }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const resultat = await adaptateurActif().initierPaiement({
    paiementId: paiement.id,
    palier: palier as keyof typeof PALIERS,
    pourcentage: echeance.pourcentage as Pourcentage,
    rang: echeance.rang,
    montantFcfa: echeance.montant,
    emailClient: context.email ?? '',
    prenomClient: context.prenom ?? '',
    nomClient: context.nom ?? '',
    telephoneLocal: telephone,
    telephonePays: pays,
    retourUrl: `${siteUrl}/abonnement/retour?id=${paiement.id}`,
    nomEtablissement: context.etablissementNom,
  })

  if (!resultat.ok) {
    // Détail technique (en français, destiné à l'équipe) gardé en base et dans
    // les logs ; l'utilisateur reçoit un message traduit.
    console.error('demarrerPaiement(provider):', resultat.error)
    await supabase.from('paiements_abonnement').update({ statut: 'echoue', metadata: { erreur: resultat.error } }).eq('id', paiement.id)
    return { error: dict.abonnement.erreurs.provider }
  }

  await supabase
    .from('paiements_abonnement')
    .update({
      provider_reference: resultat.referenceProvider,
      checkout_url: resultat.checkoutUrl,
      metadata: resultat.montantFacture ? { montantFacture: resultat.montantFacture, deviseFacturee: resultat.deviseFacturee } : null,
    })
    .eq('id', paiement.id)

  return { success: true, checkoutUrl: resultat.checkoutUrl }
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
