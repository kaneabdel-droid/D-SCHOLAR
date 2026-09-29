'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string; n?: number }
export type Presence = { eleve_id: string; etat: 'present' | 'absent' | 'retard'; minutes: number }

const DATE = /^\d{4}-\d{2}-\d{2}$/

// Appel d'une séance : seules les absences et les retards sont enregistrés
// (chaque ligne notifie la famille, cf. trigger notifier_absence).
export async function enregistrerAppel(classeId: string, date: string, enseignementId: string | null, heures: number, presences: Presence[]): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('assiduite', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  if (!DATE.test(date) || !(heures > 0 && heures <= 12)) return { error: dict.errors.invalidValue }

  const supabase = await createClient()
  const { data: classe } = await supabase.from('classes').select('annee_id').eq('id', classeId).maybeSingle()
  if (!classe) return { error: dict.errors.generic }

  const lignes = presences
    .filter((p) => p.etat !== 'present')
    .map((p) => ({
      etablissement_id: garde.context.etablissementId,
      eleve_id: p.eleve_id,
      annee_id: classe.annee_id,
      enseignement_id: enseignementId || null,
      date_absence: date,
      type: p.etat === 'retard' ? 'retard' : 'absence',
      duree: p.etat === 'retard' ? Math.max(1, Math.min(240, Math.round(p.minutes || 5))) : heures,
      justifiee: false,
    }))
  if (lignes.length) {
    const { error } = await supabase.from('absences').insert(lignes)
    if (error) return { error: messageErreur(error, dict, 'enregistrerAppel') }
  }

  revalidatePath('/assiduite')
  return { success: true, n: lignes.length }
}

// Justification par le personnel (éventuellement sur la demande de la famille).
export async function justifierAbsence(id: string, justifiee: boolean, motif: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('assiduite', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const { error } = await supabase.from('absences').update({ justifiee, motif: motif.trim().slice(0, 300) || null }).eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'justifierAbsence') }

  revalidatePath('/assiduite')
  return { success: true }
}

export async function supprimerAbsence(id: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('assiduite', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const { error } = await supabase.from('absences').delete().eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'supprimerAbsence') }

  revalidatePath('/assiduite')
  return { success: true }
}

// Liste d'appel d'une classe (élèves encore présents dans l'établissement).
export async function listeAppel(classeId: string) {
  const supabase = await createClient()
  const [{ data: inscrits }, { data: ens }] = await Promise.all([
    supabase.from('inscriptions').select('eleves(id, prenom, nom, statut)').eq('classe_id', classeId),
    supabase.from('enseignements').select('id, matieres(nom)').eq('classe_id', classeId),
  ])
  const un = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))
  return {
    eleves: ((inscrits ?? []) as unknown as { eleves: { id: string; prenom: string; nom: string; statut: string } | null }[])
      .map((i) => un(i.eleves))
      .filter((e): e is { id: string; prenom: string; nom: string; statut: string } => Boolean(e) && e!.statut === 'actif')
      .sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom)),
    enseignements: ((ens ?? []) as unknown as { id: string; matieres: { nom: string } | null }[])
      .map((e) => ({ id: e.id, nom: un(e.matieres)?.nom ?? '—' }))
      .sort((a, b) => a.nom.localeCompare(b.nom)),
  }
}
