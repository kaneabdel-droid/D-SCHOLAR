import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { un } from '@/lib/scolarite'

export type SiteGroupe = {
  id: string
  nom: string
  sigle: string | null
  ville: string | null
  palier: string
  statut: string
  prive: boolean
  mois: number
}

export type GroupeContext = {
  userId: string
  role: 'proprietaire' | 'dg'
  prenom: string | null
  nom: string | null
  groupeId: string
  groupeNom: string
  estDemo: boolean
  sites: SiteGroupe[]
}

// Contexte de la vue groupe (propriétaire / directeur général). Lecture seule :
// le RLS (10_groupes.sql) n'ouvre que la lecture des établissements du groupe.
export const getGroupeContext = cache(async (): Promise<GroupeContext> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membre } = await supabase
    .from('membres_groupe')
    .select('role, prenom, nom, actif, groupe_id, groupes(nom, est_demo)')
    .eq('user_id', user.id)
    .maybeSingle()
  // Compte du personnel inscrit par erreur comme DG : le RLS ne lui ouvre pas le groupe.
  const { data: personnel } = await supabase.from('utilisateurs').select('id').eq('id', user.id).maybeSingle()
  if (!membre || !membre.actif || personnel) redirect('/dashboard')

  const { data: sites } = await supabase.from('etablissements').select('id, nom, sigle, ville, palier, statut, statut_juridique, mois_scolarite').eq('groupe_id', membre.groupe_id).order('nom')
  const groupe = un(membre.groupes as unknown as { nom: string; est_demo: boolean } | null)

  return {
    userId: user.id,
    role: membre.role as 'proprietaire' | 'dg',
    prenom: membre.prenom,
    nom: membre.nom,
    groupeId: membre.groupe_id,
    groupeNom: groupe?.nom ?? '',
    estDemo: groupe?.est_demo ?? false,
    sites: (sites ?? []).map((s) => ({
      id: s.id,
      nom: s.nom,
      sigle: s.sigle,
      ville: s.ville,
      palier: s.palier,
      statut: s.statut,
      prive: s.statut_juridique !== 'public',
      mois: Number(s.mois_scolarite ?? 9),
    })),
  }
})
