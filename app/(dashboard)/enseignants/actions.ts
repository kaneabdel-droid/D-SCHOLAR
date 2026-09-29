'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string; id?: string }

function lire(formData: FormData) {
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()
  return {
    civilite: v('civilite') || null,
    prenom: v('prenom').slice(0, 100),
    nom: v('nom').slice(0, 100),
    telephone: v('telephone') || null,
    email: v('email') || null,
    adresse: v('adresse') || null,
    statut: v('statut') === 'vacataire' ? 'vacataire' : 'titulaire',
    // Compte utilisateur (rôle enseignant) : lui permet de saisir les notes de ses cours.
    utilisateur_id: v('utilisateur_id') || null,
  }
}

export async function enregistrerEnseignant(id: string | null, formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('organisation', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const valeurs = lire(formData)
  if (!valeurs.prenom || !valeurs.nom) return { error: fmt(dict.errors.required, { champ: dict.eleves.form.nom }) }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from('enseignants').update(valeurs).eq('id', id).select('id').single()
    : await supabase.from('enseignants').insert({ ...valeurs, etablissement_id: garde.context.etablissementId }).select('id').single()
  if (error) return { error: messageErreur(error, dict, 'enregistrerEnseignant') }

  revalidatePath('/enseignants', 'layout')
  return { success: true, id: data?.id }
}

// Désactivation plutôt que suppression : ses cours passés restent dans l'historique.
export async function changerActivite(id: string, actif: boolean): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('organisation', dict)
  if ('erreur' in garde) return { error: garde.erreur }

  const supabase = await createClient()
  const { error } = await supabase.from('enseignants').update({ actif }).eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'changerActivite') }

  revalidatePath('/enseignants', 'layout')
  return { success: true }
}
