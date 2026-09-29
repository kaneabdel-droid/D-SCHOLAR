'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string; id?: string }

const HEURE = /^\d{2}:\d{2}$/

function lireClasse(formData: FormData) {
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()
  const capacite = Number(v('capacite'))
  return {
    niveau_id: v('niveau_id'),
    serie_id: v('serie_id') || null,
    nom: v('nom').slice(0, 30),
    capacite: Number.isInteger(capacite) && capacite > 0 ? capacite : null,
    salle_id: v('salle_id') || null,
    professeur_principal_id: v('professeur_principal_id') || null,
  }
}

// Crée les enseignements d'une classe à partir des coefficients de son niveau
// (et de sa série), sans toucher à ceux qui existent déjà.
async function completerEnseignements(supabase: Awaited<ReturnType<typeof createClient>>, classeId: string, etablissementId: string) {
  const { data: classe } = await supabase.from('classes').select('niveau_id, serie_id').eq('id', classeId).single()
  if (!classe) return
  const [{ data: coefs }, { data: existants }] = await Promise.all([
    supabase.from('coefficients').select('matiere_id, serie_id').eq('niveau_id', classe.niveau_id),
    supabase.from('enseignements').select('matiere_id').eq('classe_id', classeId),
  ])
  // Coefficients propres à la série, sinon ceux valables pour tout le niveau.
  const propres = (coefs ?? []).filter((c) => c.serie_id === classe.serie_id)
  const matieres = new Set((propres.length ? propres : (coefs ?? []).filter((c) => c.serie_id === null)).map((c) => c.matiere_id))
  for (const e of existants ?? []) matieres.delete(e.matiere_id)
  if (matieres.size) {
    await supabase.from('enseignements').insert([...matieres].map((m) => ({ etablissement_id: etablissementId, classe_id: classeId, matiere_id: m })))
  }
}

export async function creerClasse(anneeId: string, formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('organisation', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const valeurs = lireClasse(formData)
  if (!valeurs.nom) return { error: fmt(dict.errors.required, { champ: dict.fields.nom }) }
  if (!valeurs.niveau_id) return { error: fmt(dict.errors.required, { champ: dict.coefficients.niveau }) }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .insert({ ...valeurs, annee_id: anneeId, etablissement_id: garde.context.etablissementId })
    .select('id')
    .single()
  if (error || !data) return { error: messageErreur(error ?? { message: '' }, dict, 'creerClasse') }
  await completerEnseignements(supabase, data.id, garde.context.etablissementId)

  revalidatePath('/classes')
  return { success: true, id: data.id }
}

export async function modifierClasse(classeId: string, formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('organisation', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const valeurs = lireClasse(formData)
  if (!valeurs.nom || !valeurs.niveau_id) return { error: fmt(dict.errors.required, { champ: dict.fields.nom }) }

  const supabase = await createClient()
  const { error } = await supabase.from('classes').update(valeurs).eq('id', classeId)
  if (error) return { error: messageErreur(error, dict, 'modifierClasse') }

  revalidatePath(`/classes/${classeId}`)
  return { success: true }
}

export async function supprimerClasse(classeId: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('organisation', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  // Une classe avec des élèves inscrits ne se supprime pas (historique du cursus).
  const { count } = await supabase.from('inscriptions').select('id', { count: 'exact', head: true }).eq('classe_id', classeId)
  if (count) return { error: dict.errors.inUse }
  const { error } = await supabase.from('classes').delete().eq('id', classeId)
  if (error) return { error: messageErreur(error, dict, 'supprimerClasse') }

  revalidatePath('/classes')
  return { success: true }
}

export async function genererEnseignements(classeId: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('organisation', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const supabase = await createClient()
  await completerEnseignements(supabase, classeId, garde.context.etablissementId)
  revalidatePath(`/classes/${classeId}`)
  return { success: true }
}

export async function affecterEnseignant(enseignementId: string, enseignantId: string | null): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('organisation', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const { data, error } = await supabase.from('enseignements').update({ enseignant_id: enseignantId || null }).eq('id', enseignementId).select('classe_id').single()
  if (error) return { error: messageErreur(error, dict, 'affecterEnseignant') }

  revalidatePath(`/classes/${data?.classe_id}`)
  return { success: true }
}

// Le trigger verifier_conflit_creneau refuse tout double emploi (classe,
// enseignant, salle) : son code 23P01 est traduit par messageErreur.
export async function ajouterCreneau(formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('organisation', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()

  const jour = Number(v('jour'))
  if (!v('enseignement_id') || !(jour >= 1 && jour <= 6) || !HEURE.test(v('heure_debut')) || !HEURE.test(v('heure_fin')) || v('heure_fin') <= v('heure_debut')) {
    return { error: dict.errors.invalidValue }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('creneaux')
    .insert({
      etablissement_id: garde.context.etablissementId,
      enseignement_id: v('enseignement_id'),
      jour,
      heure_debut: v('heure_debut'),
      heure_fin: v('heure_fin'),
      salle_id: v('salle_id') || null,
    })
    .select('enseignements(classe_id)')
    .single()
  if (error) return { error: messageErreur(error, dict, 'ajouterCreneau') }

  const classeId = (Array.isArray(data?.enseignements) ? data?.enseignements[0] : data?.enseignements)?.classe_id
  revalidatePath(`/classes/${classeId}`)
  revalidatePath('/emplois-du-temps')
  return { success: true }
}

export async function supprimerCreneau(creneauId: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('organisation', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const { error } = await supabase.from('creneaux').delete().eq('id', creneauId)
  if (error) return { error: messageErreur(error, dict, 'supprimerCreneau') }

  revalidatePath('/classes', 'layout')
  revalidatePath('/emplois-du-temps')
  return { success: true }
}
