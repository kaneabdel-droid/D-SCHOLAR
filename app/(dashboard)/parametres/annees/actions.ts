'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'
import { PALIERS } from '@/lib/abonnements/paliers'

type ActionResult = { success?: true; error?: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function creerAnnee(formData: FormData): Promise<ActionResult> {
  const context = await requireParametrage()
  const dict = await getDictionary()
  // Lecture seule (retard de paiement) : écriture refusée, le RLS la bloquerait aussi.
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }
  const t = dict.annees

  const libelle = ((formData.get('libelle') as string) ?? '').trim().slice(0, 20)
  const debut = (formData.get('date_debut') as string) ?? ''
  const fin = (formData.get('date_fin') as string) ?? ''
  // Découpage choisi pour chaque cycle ouvert : le plus fréquent devient le
  // découpage par défaut de l'année, les autres sont précisés par cycle.
  const parCycle: Record<string, 'trimestre' | 'semestre'> = {}
  for (const cycle of PALIERS[context.palier].cyclesAutorises) {
    parCycle[cycle] = formData.get('decoupage_' + cycle) === 'semestre' ? 'semestre' : 'trimestre'
  }
  const valeurs = Object.values(parCycle)
  const decoupage = valeurs.filter((v) => v === 'semestre').length > valeurs.length / 2 ? 'semestre' : 'trimestre'
  const decoupageCycles = Object.fromEntries(Object.entries(parCycle).filter(([, v]) => v !== decoupage))

  if (!libelle) return { error: fmt(dict.errors.required, { champ: t.libelle }) }
  if (!DATE.test(debut)) return { error: fmt(dict.errors.required, { champ: t.dateDebut }) }
  if (!DATE.test(fin)) return { error: fmt(dict.errors.required, { champ: t.dateFin }) }
  if (fin <= debut) return { error: dict.errors.dates }

  const supabase = await createClient()
  const { error } = await supabase.rpc('creer_annee_scolaire', {
    p_libelle: libelle,
    p_date_debut: debut,
    p_date_fin: fin,
    p_decoupage: decoupage,
    p_decoupage_cycles: decoupageCycles,
  })
  if (error) return { error: messageErreur(error, dict, 'creerAnnee') }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function activerAnnee(id: string): Promise<ActionResult> {
  const context = await requireParametrage()
  const dict = await getDictionary()
  // Lecture seule (retard de paiement) : écriture refusée, le RLS la bloquerait aussi.
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }
  const supabase = await createClient()

  const { error } = await supabase.rpc('activer_annee_scolaire', { p_annee_id: id })
  if (error) return { error: messageErreur(error, dict, 'activerAnnee') }

  // L'année active apparaît dans la sidebar : on rafraîchit tout le layout.
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function supprimerAnnee(id: string): Promise<ActionResult> {
  const context = await requireParametrage()
  const dict = await getDictionary()
  // Lecture seule (retard de paiement) : écriture refusée, le RLS la bloquerait aussi.
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }
  const supabase = await createClient()

  const { data: annee } = await supabase.from('annees_scolaires').select('active').eq('id', id).maybeSingle()
  if (annee?.active) return { error: dict.errors.deleteActiveYear }

  const { error } = await supabase.from('annees_scolaires').delete().eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'supprimerAnnee') }

  revalidatePath('/parametres', 'layout')
  return { success: true }
}

export async function modifierPeriode(id: string, debut: string, fin: string): Promise<ActionResult> {
  const context = await requireParametrage()
  const dict = await getDictionary()
  // Lecture seule (retard de paiement) : écriture refusée, le RLS la bloquerait aussi.
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }
  if (!DATE.test(debut) || !DATE.test(fin)) return { error: fmt(dict.errors.required, { champ: dict.annees.periode }) }
  if (fin < debut) return { error: dict.errors.dates }

  const supabase = await createClient()
  const { error } = await supabase.from('periodes').update({ date_debut: debut, date_fin: fin }).eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'modifierPeriode') }

  revalidatePath('/parametres/annees')
  return { success: true }
}

export async function verrouillerPeriode(id: string, verrouillee: boolean): Promise<ActionResult> {
  const context = await requireParametrage()
  const dict = await getDictionary()
  // Lecture seule (retard de paiement) : écriture refusée, le RLS la bloquerait aussi.
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }

  const supabase = await createClient()
  const { error } = await supabase.from('periodes').update({ verrouillee }).eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'verrouillerPeriode') }

  revalidatePath('/parametres/annees')
  return { success: true }
}
