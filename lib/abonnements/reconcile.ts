// Cœur du crédit d'une tranche : trois chemins (retour utilisateur, webhook,
// cron) convergent ici, tous idempotents. Invariants repris de Chariow.md §5 et
// de D-QUINCA : jamais de crédit sans re-pull provider, jamais de date de succès
// inventée quand le provider en fournit une, écart de montant > 5 % jamais crédité.

import { addMonths } from 'date-fns'
import { createAdminClient } from '@/utils/supabase/admin'
import { adaptateurPour } from './registry'
import { PLANS, type PlanCode } from './plans'
import { prochainePeriode, type AnneeCalendrier, type PeriodePayee } from './cycle'
import type { ProviderId, StatutProvider } from './types'

type LignePaiement = {
  id: string
  etablissement_id: string
  echeance_id: string
  montant: number
  provider: ProviderId
  provider_reference: string | null
  statut: 'en_attente' | 'paye' | 'echoue'
}

type ResultatReconciliation = { ok: true; credite: boolean } | { ok: false; raison: string }

const jour = (d: Date) => d.toISOString().slice(0, 10)

async function crediterEcheance(paiement: LignePaiement, dateSucces: Date): Promise<void> {
  const supabase = createAdminClient()

  // Garde-fou de course : seule l'exécution qui fait passer l'échéance de
  // a_payer à payee poursuit. Une échéance déjà réglée par une autre tentative
  // (deux pages de paiement réglées en parallèle) → doublon à rembourser.
  const { data: echeance } = await supabase
    .from('echeances_abonnement')
    .update({ statut: 'payee', payee_le: dateSucces.toISOString() })
    .eq('id', paiement.echeance_id)
    .eq('statut', 'a_payer')
    .select('id, rang, souscription_id')
    .maybeSingle()

  if (!echeance) {
    await supabase.from('paiements_abonnement').update({ doublon: true }).eq('id', paiement.id)
    console.error('[Abonnements] tranche déjà réglée — doublon à rembourser', { paiementId: paiement.id })
    return
  }

  const { data: souscription } = await supabase
    .from('souscriptions')
    .select('id, etablissement_id, palier, plan, statut')
    .eq('id', echeance.souscription_id)
    .single()
  if (!souscription) return

  if (echeance.rang === 1 && souscription.statut === 'en_attente') {
    // Périodes déjà payées (les 24 dernières suffisent pour une année de 10 mois).
    const { data: precedentes } = await supabase
      .from('souscriptions')
      .select('plan, debut, fin, mois_offerts')
      .eq('etablissement_id', souscription.etablissement_id)
      .in('statut', ['active', 'soldee'])
      .not('fin', 'is', null)
      .order('fin', { ascending: false })
      .limit(24)
    let debut: Date
    let fin: Date
    let moisOfferts = 0
    if (souscription.plan === 'mensuel') {
      // Un mois, enchaîné sur la période précédente ; vacances offertes selon
      // le calendrier de l'établissement après 10 mois payés (cf. cycle.ts).
      const { data: calendrier } = await supabase.from('annees_scolaires').select('date_debut, date_fin').eq('etablissement_id', souscription.etablissement_id)
      const p = prochainePeriode((precedentes ?? []) as PeriodePayee[], dateSucces, (calendrier ?? []) as AnneeCalendrier[])
      debut = p.debut
      fin = p.fin
      moisOfferts = p.moisOfferts
    } else {
      // Ancien plan annuel.
      const finPrecedente = precedentes?.[0]?.fin ? new Date(precedentes[0].fin) : null
      debut = finPrecedente && finPrecedente > dateSucces ? finPrecedente : dateSucces
      fin = addMonths(debut, PLANS[souscription.plan as PlanCode]?.dureeMois ?? 12)
    }

    await supabase.from('souscriptions').update({ statut: 'active', debut: debut.toISOString(), fin: fin.toISOString(), mois_offerts: moisOfferts }).eq('id', souscription.id)

    // Les tranches suivantes sont recalées sur le début réel de la période.
    const decalages = PLANS[souscription.plan as PlanCode]?.decalagesMois ?? []
    for (let rang = 2; rang <= decalages.length; rang++) {
      await supabase
        .from('echeances_abonnement')
        .update({ date_echeance: jour(addMonths(debut, decalages[rang - 1])) })
        .eq('souscription_id', souscription.id)
        .eq('rang', rang)
        .eq('statut', 'a_payer')
    }

    await supabase.from('etablissements').update({ palier: souscription.palier, abonnement_expire_le: fin.toISOString() }).eq('id', souscription.etablissement_id)
  }

  const { count: restantes } = await supabase
    .from('echeances_abonnement')
    .select('id', { count: 'exact', head: true })
    .eq('souscription_id', souscription.id)
    .eq('statut', 'a_payer')
  if (restantes === 0) {
    await supabase.from('souscriptions').update({ statut: 'soldee' }).eq('id', souscription.id).in('statut', ['active', 'en_attente'])
  }
}

async function appliquerStatut(paiement: LignePaiement, statutDistant: StatutProvider, montantDistant?: number, payeLe?: Date): Promise<ResultatReconciliation> {
  if (paiement.statut !== 'en_attente') return { ok: true, credite: paiement.statut === 'paye' }

  const supabase = createAdminClient()

  if (statutDistant === 'succeeded') {
    if (montantDistant !== undefined) {
      const ecart = Math.abs(montantDistant - paiement.montant) / paiement.montant
      if (ecart > 0.05) {
        console.error('[Abonnements] anomalie montant — NON crédité', { paiementId: paiement.id, attendu: paiement.montant, recu: montantDistant })
        return { ok: false, raison: 'montant_suspect' }
      }
    }

    const dateSucces = payeLe ?? new Date()
    const { data: misAJour } = await supabase
      .from('paiements_abonnement')
      .update({ statut: 'paye', paye_at: dateSucces.toISOString() })
      .eq('id', paiement.id)
      .eq('statut', 'en_attente')
      .select('id')
      .maybeSingle()
    if (!misAJour) return { ok: true, credite: true } // déjà traité par une exécution concurrente

    await crediterEcheance(paiement, dateSucces)
    return { ok: true, credite: true }
  }

  if (statutDistant === 'failed' || statutDistant === 'abandoned') {
    await supabase.from('paiements_abonnement').update({ statut: 'echoue' }).eq('id', paiement.id).eq('statut', 'en_attente')
    return { ok: true, credite: false }
  }

  return { ok: true, credite: false } // toujours en attente côté provider
}

async function reconcilier(paiement: LignePaiement | null): Promise<ResultatReconciliation> {
  if (!paiement) return { ok: false, raison: 'paiement_introuvable' }
  if (paiement.statut !== 'en_attente') return { ok: true, credite: paiement.statut === 'paye' }
  if (!paiement.provider_reference) return { ok: false, raison: 'pas_encore_de_reference_provider' }

  const distant = await adaptateurPour(paiement.provider).recupererStatut(paiement.provider_reference)
  if (!distant) return { ok: false, raison: 're_pull_impossible' }

  return appliquerStatut(paiement, distant.statut, distant.montant, distant.payeLe)
}

// Webhooks : le corps sert seulement à identifier le paiement à re-vérifier.
export async function reconcilierParReferenceProvider(provider: ProviderId, providerReference: string): Promise<ResultatReconciliation> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('paiements_abonnement')
    .select('*')
    .eq('provider', provider)
    .eq('provider_reference', providerReference)
    .maybeSingle<LignePaiement>()
  return reconcilier(data)
}

export async function reconcilierParPaiementId(paiementId: string): Promise<ResultatReconciliation> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('paiements_abonnement').select('*').eq('id', paiementId).maybeSingle<LignePaiement>()
  return reconcilier(data)
}

// Tâche planifiée (app/api/cron/abonnements) : rattrape les webhooks manqués et
// referme les paiements restés sans nouvelle plus de 48 h.
export async function reconcilierPaiementsEnAttente(): Promise<{ traites: number; credites: number }> {
  const supabase = createAdminClient()
  const { data: lignes } = await supabase
    .from('paiements_abonnement')
    .select('*')
    .eq('statut', 'en_attente')
    .not('provider_reference', 'is', null)
    .returns<LignePaiement[]>()

  let credites = 0
  for (const ligne of lignes ?? []) {
    const resultat = await reconcilier(ligne)
    if (resultat.ok && resultat.credite) credites++
  }

  const seuil = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  await supabase.from('paiements_abonnement').update({ statut: 'echoue' }).eq('statut', 'en_attente').lt('created_at', seuil)

  return { traites: lignes?.length ?? 0, credites }
}
