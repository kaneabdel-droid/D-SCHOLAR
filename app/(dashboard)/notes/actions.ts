'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string; id?: string }
type LigneNote = { eleve_id: string; valeur: string; absent: boolean; justifiee: boolean }

const DATE = /^\d{4}-\d{2}-\d{2}$/

// Les droits fins (enseignant limité à ses cours, période verrouillée) sont
// imposés en base : policies enseigne() et trigger verifier_periode_ouverte
// (codes traduits par messageErreur).

export async function creerEvaluation(formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('notes', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()

  const bareme = Number(v('bareme').replace(',', '.'))
  if (!v('enseignement_id') || !v('periode_id') || !v('type_id') || !DATE.test(v('date_evaluation')) || !(bareme > 0 && bareme <= 100)) {
    return { error: dict.errors.invalidValue }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evaluations')
    .insert({
      etablissement_id: garde.context.etablissementId,
      enseignement_id: v('enseignement_id'),
      periode_id: v('periode_id'),
      type_id: v('type_id'),
      libelle: v('libelle').slice(0, 80) || null,
      date_evaluation: v('date_evaluation'),
      bareme,
    })
    .select('id')
    .single()
  if (error) return { error: messageErreur(error, dict, 'creerEvaluation') }

  revalidatePath('/notes')
  return { success: true, id: data?.id }
}

export async function supprimerEvaluation(id: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('notes', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const { error } = await supabase.from('evaluations').delete().eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'supprimerEvaluation') }

  revalidatePath('/notes')
  return { success: true }
}

// Enregistre toute la grille d'une évaluation : note, absence (justifiée ou
// non) ; une ligne vide efface la note de l'élève.
export async function enregistrerNotes(evaluationId: string, lignes: LigneNote[]): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('notes', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const { data: ev } = await supabase.from('evaluations').select('bareme').eq('id', evaluationId).maybeSingle()
  if (!ev) return { error: dict.errors.generic }

  const aEcrire = []
  const aEffacer: string[] = []
  for (const l of lignes) {
    const brut = l.valeur.trim().replace(',', '.')
    if (l.absent) {
      aEcrire.push({ etablissement_id: garde.context.etablissementId, evaluation_id: evaluationId, eleve_id: l.eleve_id, valeur: null, absent: true, absence_justifiee: l.justifiee })
    } else if (brut) {
      const valeur = Number(brut)
      if (!Number.isFinite(valeur) || valeur < 0 || valeur > Number(ev.bareme)) return { error: dict.notes.erreurBareme.replace('{bareme}', String(ev.bareme)) }
      aEcrire.push({ etablissement_id: garde.context.etablissementId, evaluation_id: evaluationId, eleve_id: l.eleve_id, valeur, absent: false, absence_justifiee: false })
    } else {
      aEffacer.push(l.eleve_id)
    }
  }

  if (aEcrire.length) {
    const { error } = await supabase.from('notes').upsert(aEcrire, { onConflict: 'evaluation_id,eleve_id' })
    if (error) return { error: messageErreur(error, dict, 'enregistrerNotes') }
  }
  if (aEffacer.length) {
    const { error } = await supabase.from('notes').delete().eq('evaluation_id', evaluationId).in('eleve_id', aEffacer)
    if (error) return { error: messageErreur(error, dict, 'enregistrerNotes(effacer)') }
  }

  revalidatePath('/notes')
  return { success: true }
}

// Publication : les notes deviennent visibles des familles (notification envoyée
// par le trigger notifier_publication).
export async function publierEvaluation(id: string, publiee: boolean): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('notes', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const { error } = await supabase.from('evaluations').update({ publiee }).eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'publierEvaluation') }

  revalidatePath('/notes')
  return { success: true }
}
