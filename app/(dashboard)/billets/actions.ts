'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { un } from '@/lib/scolarite'
import { TYPES_BILLET } from '@/lib/billets'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string }

// Billet délivré par la surveillance. Un billet de retard peut aussi inscrire
// le retard dans l'assiduité (la famille en est alors notifiée).
export async function emettreBillet(formData: FormData): Promise<ActionResult & { id?: string }> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('billets', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()
  const type = v('type')
  if (!(TYPES_BILLET as readonly string[]).includes(type)) return { error: dict.errors.generic }
  if (!v('eleve_id') || !v('annee_id')) return { error: fmt(dict.errors.required, { champ: dict.eleves.eleve }) }
  const minutes = Math.round(Number(v('minutes_retard')))
  if (type === 'retard' && !(minutes > 0 && minutes < 600)) return { error: fmt(dict.errors.invalidNumber, { champ: dict.billets.minutes }) }
  if ((type === 'sortie' || type === 'visite_medicale') && !v('motif')) return { error: fmt(dict.errors.required, { champ: dict.billets.motif }) }

  const supabase = await createClient()
  let absenceId: string | null = null
  if (type === 'retard' && v('enregistrer_retard') === 'on') {
    const { data, error } = await supabase
      .from('absences')
      .insert({
        etablissement_id: garde.context.etablissementId,
        eleve_id: v('eleve_id'),
        annee_id: v('annee_id'),
        date_absence: new Date().toISOString().slice(0, 10),
        type: 'retard',
        duree: minutes,
        motif: v('motif') || null,
      })
      .select('id')
      .single()
    if (error) return { error: messageErreur(error, dict, 'emettreBillet.retard') }
    absenceId = data.id
  }

  const { data, error } = await supabase
    .from('billets')
    .insert({
      etablissement_id: garde.context.etablissementId,
      eleve_id: v('eleve_id'),
      annee_id: v('annee_id'),
      type,
      motif: v('motif').slice(0, 500) || null,
      details: v('details').slice(0, 200) || null,
      minutes_retard: type === 'retard' ? minutes : null,
      heure_retour: (type === 'sortie' || type === 'visite_medicale') && /^\d{2}:\d{2}$/.test(v('heure_retour')) ? v('heure_retour') : null,
      absence_id: absenceId,
    })
    .select('id')
    .single()
  if (error || !data) return { error: messageErreur(error ?? { message: '' }, dict, 'emettreBillet') }

  revalidatePath('/billets')
  revalidatePath('/assiduite')
  return { success: true, id: data.id }
}

export async function supprimerBillet(id: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('billets', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const supabase = await createClient()
  const { error } = await supabase.from('billets').delete().eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'supprimerBillet') }
  revalidatePath('/billets')
  return { success: true }
}

// Données d'impression d'un billet (élève, classe de l'année, établissement).
export async function donneesBillet(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('billets')
    .select('type, numero, emis_le, motif, details, minutes_retard, heure_retour, eleve_id, annee_id, eleves(prenom, nom, matricule), annees_scolaires(libelle), etablissements(nom, sigle, adresse, ville, telephone, email)')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const { data: insc } = await supabase.from('inscriptions').select('classes(nom)').eq('eleve_id', data.eleve_id).eq('annee_id', data.annee_id).maybeSingle()
  return {
    type: data.type as string,
    numero: data.numero as string,
    emis_le: data.emis_le as string,
    motif: data.motif as string | null,
    details: data.details as string | null,
    minutes_retard: data.minutes_retard as number | null,
    heure_retour: data.heure_retour as string | null,
    eleve: un(data.eleves as unknown as { prenom: string; nom: string; matricule: string } | null),
    annee: un(data.annees_scolaires as unknown as { libelle: string } | null)?.libelle ?? '',
    classe: un(insc?.classes as unknown as { nom: string } | null)?.nom ?? '',
    etablissement: un(data.etablissements as unknown as { nom: string; sigle: string | null; adresse: string | null; ville: string | null; telephone: string | null; email: string | null } | null),
  }
}
