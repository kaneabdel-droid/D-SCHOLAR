'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string }

export async function modifierSeuils(passage: string, repechage: string): Promise<ActionResult> {
  const context = await requireParametrage()
  const dict = await getDictionary()
  // Lecture seule (retard de paiement) : écriture refusée, le RLS la bloquerait aussi.
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }

  const p = Number(passage.replace(',', '.'))
  const r = Number(repechage.replace(',', '.'))
  if (!Number.isFinite(p) || !Number.isFinite(r) || p < 0 || p > 20 || r < 0 || r > p) return { error: dict.errors.invalidValue }

  const supabase = await createClient()
  const { error } = await supabase.rpc('modifier_seuils_passage', { p_passage: p, p_repechage: r })
  if (error) return { error: messageErreur(error, dict, 'modifierSeuils') }

  revalidatePath('/parametres/evaluations')
  return { success: true }
}
