'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string; n?: number }

const FINALES = ['admis', 'redouble', 'exclu'] as const

// Propose les décisions d'une classe selon les seuils de l'établissement
// (RPC calculer_decisions_classe) ; repêchage et décision finale déjà saisis sont conservés.
export async function calculerDecisions(classeId: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('decisions', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const { error } = await supabase.rpc('calculer_decisions_classe', { p_classe_id: classeId })
  if (error) return { error: messageErreur(error, dict, 'calculerDecisions') }

  revalidatePath('/passages')
  return { success: true }
}

export async function enregistrerDecision(id: string, formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('decisions', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()

  const finale = v('decision_finale')
  const note = v('note_repechage').replace(',', '.')
  const noteNum = Number(note)
  if (finale && !(FINALES as readonly string[]).includes(finale)) return { error: dict.errors.invalidValue }
  if (note && !(Number.isFinite(noteNum) && noteNum >= 0 && noteNum <= 20)) return { error: dict.errors.invalidValue }

  const supabase = await createClient()
  const { error } = await supabase
    .from('decisions')
    .update({
      decision_finale: finale || null,
      note_repechage: note ? noteNum : null,
      orientation: v('orientation').slice(0, 100) || null,
      commentaire: v('commentaire') || null,
    })
    .eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'enregistrerDecision') }

  revalidatePath('/passages')
  return { success: true }
}

// Rentrée : inscriptions de l'année cible (passants, redoublants) et sorties de
// fin de cycle, en une fois.
export async function preparerRentree(
  anneeCibleId: string,
  lignes: { eleve_id: string; classe_id: string | null; statut: 'passant' | 'redoublant'; finCycle: boolean }[]
): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('eleves', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const e = garde.context.etablissementId

  const supabase = await createClient()
  const aInscrire = lignes.filter((l) => l.classe_id && !l.finCycle)
  if (aInscrire.length) {
    const { error } = await supabase.from('inscriptions').insert(
      aInscrire.map((l) => ({ etablissement_id: e, eleve_id: l.eleve_id, annee_id: anneeCibleId, classe_id: l.classe_id, statut: l.statut, date_inscription: new Date().toISOString().slice(0, 10) }))
    )
    if (error) return { error: messageErreur(error, dict, 'preparerRentree') }
  }
  const sortants = lignes.filter((l) => l.finCycle).map((l) => l.eleve_id)
  if (sortants.length) {
    const aujourdhui = new Date().toISOString().slice(0, 10)
    await supabase.from('mouvements').insert(sortants.map((id) => ({ etablissement_id: e, eleve_id: id, date_mouvement: aujourdhui, type: 'fin_de_cycle' })))
    await supabase.from('eleves').update({ statut: 'sorti' }).in('id', sortants)
  }

  revalidatePath('/passages', 'layout')
  revalidatePath('/eleves')
  return { success: true, n: aInscrire.length + sortants.length }
}
