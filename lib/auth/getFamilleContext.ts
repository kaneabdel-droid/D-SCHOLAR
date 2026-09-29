import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export type EnfantPortail = { id: string; prenom: string; nom: string; matricule: string; classe: string | null; classeId: string | null; anneeId: string | null }

export type FamilleContext = {
  userId: string
  type: 'parent' | 'eleve'
  prenom: string | null
  nom: string | null
  etablissementId: string
  etablissementNom: string
  enfants: EnfantPortail[]
}

// Contexte du portail (parent ou élève). Le personnel qui ouvre /portail est
// renvoyé vers son tableau de bord ; un visiteur sans compte, vers la connexion.
export const getFamilleContext = cache(async (): Promise<FamilleContext> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: compte } = await supabase
    .from('comptes_famille')
    .select('type, prenom, nom, actif, etablissement_id, etablissements(nom)')
    .eq('id', user.id)
    .maybeSingle()
  if (!compte || !compte.actif) redirect('/dashboard')

  // RLS : mes_eleves() limite déjà aux enfants liés (ou à l'élève lui-même).
  const { data: eleves } = await supabase
    .from('eleves')
    .select('id, prenom, nom, matricule, inscriptions(annee_id, classe_id, classes(nom), annees_scolaires(date_debut))')
    .order('prenom')

  type Insc = { annee_id: string; classe_id: string; classes: { nom: string } | { nom: string }[] | null; annees_scolaires: { date_debut: string } | { date_debut: string }[] | null }
  const un = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))
  const enfants = (eleves ?? []).map((e) => {
    // Inscription la plus récente (année en cours ou dernière année suivie).
    const derniere = [...((e.inscriptions ?? []) as Insc[])].sort((a, b) =>
      (un(b.annees_scolaires)?.date_debut ?? '').localeCompare(un(a.annees_scolaires)?.date_debut ?? '')
    )[0]
    return {
      id: e.id,
      prenom: e.prenom,
      nom: e.nom,
      matricule: e.matricule,
      classe: derniere ? (un(derniere.classes)?.nom ?? null) : null,
      classeId: derniere?.classe_id ?? null,
      anneeId: derniere?.annee_id ?? null,
    }
  })

  const etab = un(compte.etablissements as { nom: string } | { nom: string }[] | null)
  return {
    userId: user.id,
    type: compte.type as 'parent' | 'eleve',
    prenom: compte.prenom,
    nom: compte.nom,
    etablissementId: compte.etablissement_id,
    etablissementNom: etab?.nom ?? '',
    enfants,
  }
})
