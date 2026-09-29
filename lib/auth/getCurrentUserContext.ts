import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import type { PalierCode } from '@/lib/abonnements/paliers'
import type { Acces } from '@/lib/abonnements/plans'
import { peutEcrire, peutGererParametres, type Module, type Role } from '@/lib/roles'

export type UserContext = {
  userId: string
  email: string | null
  nom: string | null
  prenom: string | null
  role: Role
  etablissementId: string
  etablissementNom: string
  etablissementStatut: 'actif' | 'suspendu'
  palier: PalierCode
  anneeActive: { id: string; libelle: string } | null
  // Calculé en base depuis les échéances (public.mon_acces(), 05_abonnements.sql).
  acces: Acces
  // Établissement de démonstration public : actions sensibles désactivées.
  estDemo: boolean
}

// Chokepoint unique, mémoïsé par requête serveur (layout + page + actions).
export const getCurrentUserContext = cache(async (): Promise<UserContext> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data }, { data: annee }, { data: acces }] = await Promise.all([
    supabase
      .from('utilisateurs')
      .select('etablissement_id, role, nom, prenom, actif, etablissements(nom, statut, palier, est_demo)')
      .eq('id', user.id)
      .maybeSingle(),
    // RLS : ne renvoie que les années de l'établissement de l'utilisateur.
    supabase.from('annees_scolaires').select('id, libelle').eq('active', true).maybeSingle(),
    supabase.rpc('mon_acces'),
  ])

  if (!data || !data.actif) {
    // Parent ou élève : leur espace est le portail, pas le tableau de bord du personnel.
    const { data: famille } = await supabase.from('comptes_famille').select('actif').eq('id', user.id).maybeSingle()
    redirect(famille?.actif ? '/portail' : '/login?message=compte')
  }

  const etablissement = Array.isArray(data.etablissements) ? data.etablissements[0] : data.etablissements

  return {
    userId: user.id,
    email: user.email ?? null,
    nom: data.nom,
    prenom: data.prenom,
    role: data.role as Role,
    etablissementId: data.etablissement_id,
    etablissementNom: etablissement?.nom ?? '',
    etablissementStatut: etablissement?.statut ?? 'actif',
    palier: (etablissement?.palier ?? 'elementaire') as PalierCode,
    anneeActive: annee ?? null,
    acces: ((acces as Acces | null) ?? 'lecture_seule'),
    estDemo: etablissement?.est_demo ?? false,
  }
})

// Garde-fou serveur des pages et actions de paramétrage (direction / censeur).
// La nav filtrée n'est qu'un confort : c'est ce contrôle (et le RLS) qui protège.
export async function requireParametrage(): Promise<UserContext> {
  const context = await getCurrentUserContext()
  if (!peutGererParametres(context.role)) redirect('/dashboard')
  return context
}

export async function requireDirection(): Promise<UserContext> {
  const context = await getCurrentUserContext()
  if (context.role !== 'direction') redirect('/dashboard')
  return context
}

// Garde-fou des actions d'écriture d'un module : rôle autorisé et accès complet
// (pas de lecture seule pour retard de paiement). Renvoie le contexte, ou le
// message d'erreur traduit à renvoyer tel quel.
export async function contexteEcriture(module: Module, dict: { errors: { forbidden: string; lectureSeule: string } }) {
  const context = await getCurrentUserContext()
  if (!peutEcrire(context.role, module)) return { erreur: dict.errors.forbidden } as const
  if (context.acces !== 'complet') return { erreur: dict.errors.lectureSeule } as const
  return { context } as const
}
