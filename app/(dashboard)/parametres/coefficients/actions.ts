'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string }
type LigneCoefficient = { matiere_id: string; coefficient: string; volume_horaire: string }

export async function enregistrerCoefficients(niveauId: string, serieId: string | null, lignes: LigneCoefficient[]): Promise<ActionResult> {
  await requireParametrage()
  const dict = await getDictionary()

  const payload = []
  for (const l of lignes) {
    const coef = l.coefficient.trim().replace(',', '.')
    if (!coef) continue // matière non enseignée à ce niveau
    const valeur = Number(coef)
    const volume = l.volume_horaire.trim().replace(',', '.')
    if (!Number.isFinite(valeur) || valeur <= 0 || valeur > 99) return { error: dict.errors.coefficient }
    if (volume && (!Number.isFinite(Number(volume)) || Number(volume) < 0 || Number(volume) > 99)) return { error: dict.errors.coefficient }
    payload.push({ matiere_id: l.matiere_id, coefficient: valeur, volume_horaire: volume ? Number(volume) : null })
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('enregistrer_coefficients', {
    p_niveau_id: niveauId,
    p_serie_id: serieId,
    p_lignes: payload,
  })
  if (error) return { error: messageErreur(error, dict, 'enregistrerCoefficients') }

  revalidatePath('/parametres/coefficients')
  return { success: true }
}
