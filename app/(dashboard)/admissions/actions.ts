'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string; eleveId?: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const STATUTS_CANDIDATURE = ['soumise', 'en_etude', 'test_planifie', 'admise', 'liste_attente', 'refusee', 'inscrite'] as const

const note = (v: string) => {
  const n = Number(v.replace(',', '.'))
  return v.trim() && Number.isFinite(n) && n >= 0 && n <= 20 ? n : null
}

export async function creerCandidature(formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('admissions', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()

  if (!v('prenom') || !v('nom')) return { error: fmt(dict.errors.required, { champ: dict.eleves.form.nom }) }
  if (!v('annee_id') || !v('niveau_id')) return { error: fmt(dict.errors.required, { champ: dict.admissions.niveau }) }

  const supabase = await createClient()
  const { error } = await supabase.from('candidatures').insert({
    etablissement_id: garde.context.etablissementId,
    annee_id: v('annee_id'),
    niveau_id: v('niveau_id'),
    serie_id: v('serie_id') || null,
    prenom: v('prenom').slice(0, 100),
    nom: v('nom').slice(0, 100),
    sexe: v('sexe') === 'F' ? 'F' : 'M',
    date_naissance: DATE.test(v('date_naissance')) ? v('date_naissance') : null,
    lieu_naissance: v('lieu_naissance') || null,
    etablissement_origine: v('etablissement_origine') || null,
    moyenne_origine: note(v('moyenne_origine')),
    tuteur_nom: v('tuteur_nom') || null,
    tuteur_telephone: v('tuteur_telephone') || null,
    tuteur_email: v('tuteur_email') || null,
  })
  if (error) return { error: messageErreur(error, dict, 'creerCandidature') }

  revalidatePath('/admissions')
  return { success: true }
}

export async function suivreCandidature(id: string, formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('admissions', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()

  const statut = v('statut')
  if (!(STATUTS_CANDIDATURE as readonly string[]).includes(statut) || statut === 'inscrite') return { error: dict.errors.invalidValue }

  const supabase = await createClient()
  const { error } = await supabase
    .from('candidatures')
    .update({
      statut,
      date_test: DATE.test(v('date_test')) ? v('date_test') : null,
      note_test: note(v('note_test')),
      commentaire: v('commentaire') || null,
    })
    .eq('id', id)
    .neq('statut', 'inscrite')
  if (error) return { error: messageErreur(error, dict, 'suivreCandidature') }

  revalidatePath('/admissions')
  return { success: true }
}

// Candidat admis → élève inscrit : fiche, inscription « nouveau » dans la
// classe choisie, mouvement d'entrée, candidature marquée « inscrite ».
export async function inscrireCandidat(id: string, classeId: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('admissions', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const { context } = garde

  const supabase = await createClient()
  const [{ data: cand }, { data: classe }] = await Promise.all([
    supabase.from('candidatures').select('*').eq('id', id).maybeSingle(),
    supabase.from('classes').select('id, annee_id, annees_scolaires(date_debut)').eq('id', classeId).maybeSingle(),
  ])
  if (!cand || cand.statut !== 'admise') return { error: dict.admissions.erreurNonAdmise }
  if (!classe || classe.annee_id !== cand.annee_id) return { error: dict.errors.invalidValue }

  const aujourdhui = new Date().toISOString().slice(0, 10)
  const { data: eleve, error } = await supabase
    .from('eleves')
    .insert({
      etablissement_id: context.etablissementId,
      matricule: '',
      prenom: cand.prenom,
      nom: cand.nom,
      sexe: cand.sexe,
      date_naissance: cand.date_naissance,
      lieu_naissance: cand.lieu_naissance,
      tuteur_nom: cand.tuteur_nom,
      tuteur_telephone: cand.tuteur_telephone,
      date_entree: aujourdhui,
    })
    .select('id')
    .single()
  if (error || !eleve) return { error: messageErreur(error ?? { message: '' }, dict, 'inscrireCandidat') }

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('inscriptions').insert({
      etablissement_id: context.etablissementId,
      eleve_id: eleve.id,
      annee_id: cand.annee_id,
      classe_id: classeId,
      statut: 'nouveau',
      date_inscription: aujourdhui,
    }),
    supabase.from('mouvements').insert({
      etablissement_id: context.etablissementId,
      eleve_id: eleve.id,
      date_mouvement: aujourdhui,
      type: 'entree',
      motif: cand.etablissement_origine,
    }),
  ])
  if (e1 || e2) {
    await supabase.from('eleves').delete().eq('id', eleve.id)
    return { error: messageErreur((e1 ?? e2)!, dict, 'inscrireCandidat(inscription)') }
  }
  await supabase.from('candidatures').update({ statut: 'inscrite', eleve_id: eleve.id }).eq('id', id)

  revalidatePath('/admissions')
  revalidatePath('/eleves')
  return { success: true, eleveId: eleve.id }
}
