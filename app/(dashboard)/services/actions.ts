'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MODES = ['especes', 'mobile_money', 'virement', 'cheque', 'autre']

const montant = (v: string) => {
  const n = Math.round(Number(v.replace(/\s/g, '').replace(',', '.')))
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function ajouterFrais(anneeId: string, formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('finances', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()
  const m = montant(v('montant'))
  if (!v('libelle')) return { error: fmt(dict.errors.required, { champ: dict.fields.libelle }) }
  if (!m) return { error: fmt(dict.errors.invalidNumber, { champ: dict.finances.montant }) }

  const supabase = await createClient()
  const { error } = await supabase.from('frais_scolarite').insert({
    etablissement_id: garde.context.etablissementId,
    annee_id: anneeId,
    niveau_id: v('niveau_id') || null,
    libelle: v('libelle').slice(0, 100),
    montant: m,
    date_echeance: DATE.test(v('date_echeance')) ? v('date_echeance') : null,
  })
  if (error) return { error: messageErreur(error, dict, 'ajouterFrais') }
  revalidatePath('/services')
  return { success: true }
}

export async function supprimerFrais(id: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('finances', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const supabase = await createClient()
  const { error } = await supabase.from('frais_scolarite').delete().eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'supprimerFrais') }
  revalidatePath('/services')
  return { success: true }
}

export async function souscrireService(eleveId: string, serviceId: string, anneeId: string, details: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('services', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const supabase = await createClient()
  const { error } = await supabase.from('souscriptions_services').insert({
    etablissement_id: garde.context.etablissementId,
    eleve_id: eleveId,
    service_id: serviceId,
    annee_id: anneeId,
    details: details.trim().slice(0, 200) || null,
  })
  if (error) return { error: messageErreur(error, dict, 'souscrireService') }
  revalidatePath('/services')
  revalidatePath(`/eleves/${eleveId}`)
  return { success: true }
}

export async function retirerService(id: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('services', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const supabase = await createClient()
  const { error } = await supabase.from('souscriptions_services').delete().eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'retirerService') }
  revalidatePath('/services')
  revalidatePath('/eleves', 'layout')
  return { success: true }
}

// Encaissement : le numéro de reçu est attribué en base (trigger attribuer_numero_recu).
export async function encaisser(formData: FormData): Promise<ActionResult & { recu?: { numero: string; id: string } }> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('finances', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()
  const m = montant(v('montant'))
  if (!v('eleve_id') || !v('annee_id')) return { error: fmt(dict.errors.required, { champ: dict.eleves.eleve }) }
  if (!v('libelle')) return { error: fmt(dict.errors.required, { champ: dict.fields.libelle }) }
  if (!m) return { error: fmt(dict.errors.invalidNumber, { champ: dict.finances.montant }) }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('paiements_eleves')
    .insert({
      etablissement_id: garde.context.etablissementId,
      eleve_id: v('eleve_id'),
      annee_id: v('annee_id'),
      libelle: v('libelle').slice(0, 150),
      montant: m,
      mode: MODES.includes(v('mode')) ? v('mode') : 'especes',
      reference: v('reference') || null,
      date_paiement: DATE.test(v('date_paiement')) ? v('date_paiement') : new Date().toISOString().slice(0, 10),
    })
    .select('id, numero_recu')
    .single()
  if (error || !data) return { error: messageErreur(error ?? { message: '' }, dict, 'encaisser') }

  revalidatePath('/services')
  revalidatePath(`/eleves/${v('eleve_id')}`)
  return { success: true, recu: { id: data.id, numero: data.numero_recu ?? '' } }
}

export async function annulerPaiement(id: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('finances', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const supabase = await createClient()
  const { error } = await supabase.from('paiements_eleves').delete().eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'annulerPaiement') }
  revalidatePath('/services')
  revalidatePath('/eleves', 'layout')
  return { success: true }
}

// Données d'un reçu, pour l'impression.
export async function donneesRecu(paiementId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('paiements_eleves')
    .select('numero_recu, libelle, montant, mode, reference, date_paiement, eleves(prenom, nom, matricule), annees_scolaires(libelle), etablissements(nom, sigle, adresse, ville, telephone, email)')
    .eq('id', paiementId)
    .maybeSingle()
  return data
}
