'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'
import { getFamilleContext } from '@/lib/auth/getFamilleContext'

// Justification d'une absence par la famille (rpc justifier_absence, limitée à
// ses enfants) : le personnel la valide ensuite depuis l'assiduité.
export async function justifierAbsenceFamille(absenceId: string, eleveId: string, motif: string): Promise<{ success?: true; error?: string }> {
  const dict = await getDictionary()
  if (!motif.trim()) return { error: fmt(dict.errors.required, { champ: dict.portail.motif }) }
  if ((await getFamilleContext()).verrouille) return { error: dict.portail.verrouille.texte }
  const supabase = await createClient()
  const { error } = await supabase.rpc('justifier_absence', { p_absence_id: absenceId, p_motif: motif.trim().slice(0, 500) })
  if (error) return { error: messageErreur(error, dict, 'justifierAbsenceFamille') }
  revalidatePath(`/portail/${eleveId}`)
  return { success: true }
}
