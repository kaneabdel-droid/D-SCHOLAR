'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string; id?: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const SORTIES = ['transfert_sortant', 'abandon', 'exclusion', 'fin_de_cycle'] as const

function lireIdentite(formData: FormData) {
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()
  return {
    prenom: v('prenom').slice(0, 100),
    nom: v('nom').slice(0, 100),
    sexe: v('sexe') === 'F' ? 'F' : 'M',
    date_naissance: DATE.test(v('date_naissance')) ? v('date_naissance') : null,
    lieu_naissance: v('lieu_naissance') || null,
    adresse: v('adresse') || null,
    tuteur_nom: v('tuteur_nom') || null,
    tuteur_telephone: v('tuteur_telephone') || null,
  }
}

// Nouvel élève : fiche (matricule attribué en base), inscription dans une
// classe de l'année choisie, et mouvement d'entrée pour le cursus.
export async function creerEleve(formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('eleves', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const { context } = garde
  const t = dict.eleves

  const identite = lireIdentite(formData)
  const classeId = (formData.get('classe_id') as string | null) ?? ''
  const transfere = formData.get('statut') === 'transfere'
  const dateEntree = DATE.test((formData.get('date_entree') as string) ?? '') ? (formData.get('date_entree') as string) : new Date().toISOString().slice(0, 10)
  if (!identite.prenom) return { error: fmt(dict.errors.required, { champ: t.form.prenom }) }
  if (!identite.nom) return { error: fmt(dict.errors.required, { champ: t.form.nom }) }
  if (!classeId) return { error: fmt(dict.errors.required, { champ: t.classe }) }

  const supabase = await createClient()
  const { data: classe } = await supabase.from('classes').select('id, annee_id').eq('id', classeId).maybeSingle()
  if (!classe) return { error: dict.errors.generic }

  const { data: eleve, error } = await supabase
    .from('eleves')
    .insert({ ...identite, etablissement_id: context.etablissementId, matricule: '', date_entree: dateEntree })
    .select('id')
    .single()
  if (error || !eleve) return { error: messageErreur(error ?? { message: '' }, dict, 'creerEleve') }

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('inscriptions').insert({
      etablissement_id: context.etablissementId,
      eleve_id: eleve.id,
      annee_id: classe.annee_id,
      classe_id: classe.id,
      statut: transfere ? 'transfere' : 'nouveau',
      date_inscription: dateEntree,
    }),
    supabase.from('mouvements').insert({
      etablissement_id: context.etablissementId,
      eleve_id: eleve.id,
      date_mouvement: dateEntree,
      type: transfere ? 'transfert_entrant' : 'entree',
      motif: ((formData.get('origine') as string | null) ?? '').trim() || null,
    }),
  ])
  if (e1 || e2) {
    await supabase.from('eleves').delete().eq('id', eleve.id)
    return { error: messageErreur((e1 ?? e2)!, dict, 'creerEleve(inscription)') }
  }

  revalidatePath('/eleves')
  return { success: true, id: eleve.id }
}

export async function modifierEleve(eleveId: string, formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('eleves', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const identite = lireIdentite(formData)
  if (!identite.prenom || !identite.nom) return { error: fmt(dict.errors.required, { champ: dict.eleves.form.nom }) }

  const supabase = await createClient()
  const { error } = await supabase.from('eleves').update(identite).eq('id', eleveId)
  if (error) return { error: messageErreur(error, dict, 'modifierEleve') }

  revalidatePath(`/eleves/${eleveId}`)
  return { success: true }
}

// Changement de classe au sein de la même année (erreur d'affectation, dédoublement…).
export async function changerClasse(inscriptionId: string, classeId: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('eleves', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const [{ data: inscription }, { data: classe }] = await Promise.all([
    supabase.from('inscriptions').select('eleve_id, annee_id').eq('id', inscriptionId).maybeSingle(),
    supabase.from('classes').select('annee_id').eq('id', classeId).maybeSingle(),
  ])
  if (!inscription || !classe || inscription.annee_id !== classe.annee_id) return { error: dict.errors.generic }

  const { error } = await supabase.from('inscriptions').update({ classe_id: classeId }).eq('id', inscriptionId)
  if (error) return { error: messageErreur(error, dict, 'changerClasse') }

  revalidatePath(`/eleves/${inscription.eleve_id}`)
  return { success: true }
}

export async function declarerSortie(eleveId: string, formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('eleves', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const type = (formData.get('type') as string) ?? ''
  const date = (formData.get('date') as string) ?? ''
  if (!(SORTIES as readonly string[]).includes(type) || !DATE.test(date)) return { error: dict.errors.invalidValue }

  const supabase = await createClient()
  const { error } = await supabase.from('mouvements').insert({
    etablissement_id: garde.context.etablissementId,
    eleve_id: eleveId,
    date_mouvement: date,
    type,
    motif: ((formData.get('motif') as string | null) ?? '').trim() || null,
  })
  if (error) return { error: messageErreur(error, dict, 'declarerSortie') }
  const { error: e2 } = await supabase.from('eleves').update({ statut: 'sorti' }).eq('id', eleveId)
  if (e2) return { error: messageErreur(e2, dict, 'declarerSortie(statut)') }

  revalidatePath(`/eleves/${eleveId}`)
  return { success: true }
}

// Code d'accès au portail (parent ou élève), à remettre à la famille.
export async function genererCodeAcces(eleveId: string, type: 'parent' | 'eleve', lien: 'pere' | 'mere' | 'tuteur'): Promise<ActionResult & { code?: string }> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('eleves', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generer_code_activation', { p_eleve_id: eleveId, p_type: type, p_lien: lien })
  if (error || !data) return { error: messageErreur(error ?? { message: '' }, dict, 'genererCodeAcces') }

  revalidatePath(`/eleves/${eleveId}`)
  return { success: true, code: data as string }
}
