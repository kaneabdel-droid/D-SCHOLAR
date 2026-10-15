'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireDirection } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string }

export async function modifierEtablissement(formData: FormData): Promise<ActionResult> {
  const context = await requireDirection()
  const dict = await getDictionary()
  // Lecture seule (retard de paiement) : écriture refusée, le RLS la bloquerait aussi.
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }
  if (context.estDemo) return { error: dict.errors.demo }
  const champ = (nom: string) => ((formData.get(nom) as string | null) ?? '').trim()

  if (!champ('nom')) return { error: fmt(dict.errors.required, { champ: dict.etablissement.nom }) }
  const email = champ('email')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: dict.errors.emailInvalid }

  const supabase = await createClient()
  // RPC plutôt qu'un update direct : palier / statut / abonnement restent hors
  // de portée de la direction (cf. 04_rpc_parametrage.sql).
  const { error } = await supabase.rpc('modifier_infos_etablissement', {
    p_nom: champ('nom'),
    p_sigle: champ('sigle'),
    p_adresse: champ('adresse'),
    p_ville: champ('ville'),
    p_telephone: champ('telephone'),
    p_email: email,
    p_niveau_min_compte_eleve: champ('niveau_min_compte_eleve'),
  })
  if (error) return { error: messageErreur(error, dict, 'modifierEtablissement') }

  // Régime : privé, public, professionnel ou supérieur, nombre de mensualités.
  const mois = Math.round(Number(champ('mois_scolarite')))
  const statutRaw = champ('statut_juridique')
  const statutJuridique = ['prive', 'public', 'professionnel', 'superieur'].includes(statutRaw) ? statutRaw : 'prive'
  const { error: e2 } = await supabase.rpc('modifier_regime_etablissement', {
    p_statut_juridique: statutJuridique,
    p_mois_scolarite: mois >= 1 && mois <= 12 ? mois : 9,
  })
  const menuLayout = champ('menu_layout')
  if (menuLayout === 'horizontal' || menuLayout === 'sidebar') {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    cookieStore.set('menu_layout', menuLayout, { path: '/', maxAge: 31536000 })
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
