import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreneauAffiche } from '@/components/EmploiGrid'
import { un } from '@/lib/scolarite'

type Ligne = {
  id: string
  jour: number
  heure_debut: string
  heure_fin: string
  salles: { nom: string } | null
  enseignements: {
    matieres: { nom: string; couleur: string } | null
    classes: { nom: string } | null
    enseignants: { civilite: string | null; nom: string } | null
  } | null
}

// Créneaux d'une classe, ou d'un enseignant sur une année, prêts pour EmploiGrid.
export async function chargerCreneaux(
  supabase: SupabaseClient,
  filtre: { classeId: string } | { enseignantId: string; anneeId: string }
): Promise<CreneauAffiche[]> {
  let q = supabase
    .from('creneaux')
    .select('id, jour, heure_debut, heure_fin, salles(nom), enseignements!inner(classe_id, enseignant_id, matieres(nom, couleur), classes!inner(nom, annee_id), enseignants(civilite, nom))')
  q = 'classeId' in filtre
    ? q.eq('enseignements.classe_id', filtre.classeId)
    : q.eq('enseignements.enseignant_id', filtre.enseignantId).eq('enseignements.classes.annee_id', filtre.anneeId)
  const { data } = await q

  const parClasse = 'classeId' in filtre
  return ((data ?? []) as unknown as Ligne[]).map((c) => {
    const en = un(c.enseignements)
    const matiere = un(en?.matieres)
    const prof = un(en?.enseignants)
    const salle = un(c.salles)?.nom
    const qui = parClasse ? (prof ? `${prof.civilite ?? ''} ${prof.nom}`.trim() : '') : (un(en?.classes)?.nom ?? '')
    return {
      id: c.id,
      jour: c.jour,
      debut: c.heure_debut.slice(0, 5),
      fin: c.heure_fin.slice(0, 5),
      titre: matiere?.nom ?? '—',
      detail: [qui, salle].filter(Boolean).join(' · '),
      couleur: matiere?.couleur ?? '#94A3B8',
    }
  })
}
