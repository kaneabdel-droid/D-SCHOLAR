'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string }
const CIBLES = ['tous', 'personnel', 'familles', 'classe']

// Publication d'une annonce : le trigger notifier_annonce crée les
// notifications des destinataires (personnel, familles, ou familles d'une classe).
export async function publierAnnonce(formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('annonces', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()
  const cible = CIBLES.includes(v('cible')) ? v('cible') : 'tous'
  if (!v('titre')) return { error: fmt(dict.errors.required, { champ: dict.communication.titre }) }
  if (!v('contenu')) return { error: fmt(dict.errors.required, { champ: dict.communication.contenu }) }
  if (cible === 'classe' && !v('classe_id')) return { error: fmt(dict.errors.required, { champ: dict.eleves.classe }) }

  const supabase = await createClient()
  const { error } = await supabase.from('annonces').insert({
    etablissement_id: garde.context.etablissementId,
    titre: v('titre').slice(0, 200),
    contenu: v('contenu').slice(0, 5000),
    cible,
    classe_id: cible === 'classe' ? v('classe_id') : null,
  })
  if (error) return { error: messageErreur(error, dict, 'publierAnnonce') }
  revalidatePath('/communication')
  return { success: true }
}

export async function supprimerAnnonce(id: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('annonces', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const supabase = await createClient()
  const { error } = await supabase.from('annonces').delete().eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'supprimerAnnonce') }
  revalidatePath('/communication')
  return { success: true }
}
