import { createAdminClient } from '@/utils/supabase/admin'
import { PALIERS, type PalierCode } from './paliers'
import { PLANS, type PlanCode, type Pourcentage } from './plans'
import { adaptateurActif, providerActif } from './registry'
import { PAYS_TELEPHONE_SUPPORTES } from './telephone'

// Logique de paiement partagée par la page /abonnement (direction connectée) et
// l'inscription publique /tarifs. Écritures via le service role : l'appelant a
// déjà vérifié à qui appartient `etablissementId`.

export type ErreurPaiement = 'enCours' | 'generic' | 'provider'
export type Echeance = { id: string; rang: number; pourcentage: number; montant: number }
export type Tranche = { echeance: Echeance } | { erreur: ErreurPaiement }

// Au-delà, une page de paiement provider est considérée expirée : on en ouvre une nouvelle.
const DUREE_REUTILISATION_MS = 30 * 60 * 1000

export function telephoneValide(pays: string, telephone: string) {
  return (PAYS_TELEPHONE_SUPPORTES as string[]).includes(pays) && telephone.replace(/\D/g, '').length >= 7
}

// Crée la souscription (et ses échéances) puis renvoie sa tranche 1.
export async function creerSouscriptionEtTranche1(etablissementId: string, palier: PalierCode, plan: PlanCode): Promise<Tranche> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('creer_souscription', {
    p_etablissement_id: etablissementId,
    p_palier: palier,
    p_plan: plan,
    p_montant_total: PALIERS[palier].prixAnnuelFcfa,
    p_repartition: PLANS[plan].repartition,
    p_decalages: PLANS[plan].decalagesMois,
  })
  if (error || !data) {
    console.error('creerSouscriptionEtTranche1:', error?.message)
    return { erreur: error?.code === '23505' ? 'enCours' : 'generic' }
  }
  return trancheUne(data as string)
}

export async function trancheUne(souscriptionId: string): Promise<Tranche> {
  const supabase = createAdminClient()
  const { data: echeance } = await supabase
    .from('echeances_abonnement')
    .select('id, rang, pourcentage, montant')
    .eq('souscription_id', souscriptionId)
    .eq('rang', 1)
    .single()
  return echeance ? { echeance } : { erreur: 'generic' }
}

export async function lancerPaiement(p: {
  etablissementId: string
  etablissementNom: string
  email: string
  prenom: string
  nom: string
  palier: PalierCode
  echeance: Echeance
  pays: string
  telephone: string
}): Promise<{ checkoutUrl: string } | { erreur: ErreurPaiement }> {
  const supabase = createAdminClient()
  const provider = providerActif()

  // Anti double paiement : même tranche, même provider, page encore récente →
  // on renvoie la page déjà ouverte ; sinon l'ancienne tentative est abandonnée
  // (si elle est payée plus tard, elle sera traitée et marquée doublon).
  const { data: enCours } = await supabase
    .from('paiements_abonnement')
    .select('id, echeance_id, provider, checkout_url, created_at')
    .eq('etablissement_id', p.etablissementId)
    .eq('statut', 'en_attente')
    .is('abandonne_le', null)
    .maybeSingle()
  if (enCours) {
    const recent = Date.now() - new Date(enCours.created_at).getTime() < DUREE_REUTILISATION_MS
    if (enCours.echeance_id === p.echeance.id && enCours.provider === provider && enCours.checkout_url && recent) {
      return { checkoutUrl: enCours.checkout_url }
    }
    await supabase.from('paiements_abonnement').update({ abandonne_le: new Date().toISOString() }).eq('id', enCours.id)
  }

  const { data: paiement, error: insertError } = await supabase
    .from('paiements_abonnement')
    .insert({ etablissement_id: p.etablissementId, echeance_id: p.echeance.id, montant: p.echeance.montant, provider })
    .select('id')
    .single()
  if (insertError || !paiement) {
    if (insertError?.code === '23505') return { erreur: 'enCours' }
    console.error('lancerPaiement(insert):', insertError?.message)
    return { erreur: 'generic' }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const resultat = await adaptateurActif().initierPaiement({
    paiementId: paiement.id,
    palier: p.palier,
    pourcentage: p.echeance.pourcentage as Pourcentage,
    rang: p.echeance.rang,
    montantFcfa: p.echeance.montant,
    emailClient: p.email,
    prenomClient: p.prenom,
    nomClient: p.nom,
    telephoneLocal: p.telephone,
    telephonePays: p.pays,
    retourUrl: `${siteUrl}/abonnement/retour?id=${paiement.id}`,
    nomEtablissement: p.etablissementNom,
  })

  if (!resultat.ok) {
    // Détail technique (destiné à l'équipe) gardé en base et dans les logs ;
    // l'utilisateur reçoit un message traduit.
    console.error('lancerPaiement(provider):', resultat.error)
    await supabase.from('paiements_abonnement').update({ statut: 'echoue', metadata: { erreur: resultat.error } }).eq('id', paiement.id)
    return { erreur: 'provider' }
  }

  await supabase
    .from('paiements_abonnement')
    .update({
      provider_reference: resultat.referenceProvider,
      checkout_url: resultat.checkoutUrl,
      metadata: resultat.montantFacture ? { montantFacture: resultat.montantFacture, deviseFacturee: resultat.deviseFacturee } : null,
    })
    .eq('id', paiement.id)

  return { checkoutUrl: resultat.checkoutUrl }
}
