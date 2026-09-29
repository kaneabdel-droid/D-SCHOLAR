import type { SupabaseClient } from '@supabase/supabase-js'

// Listes de choix des formulaires d'organisation (classes, créneaux).
export async function referentielClasse(supabase: SupabaseClient) {
  const [{ data: niveaux }, { data: series }, { data: salles }, { data: enseignants }] = await Promise.all([
    supabase.from('niveaux').select('id, nom, a_series').eq('actif', true).order('ordre'),
    supabase.from('series').select('id, code').eq('actif', true).order('code'),
    supabase.from('salles').select('id, nom').eq('actif', true).order('nom'),
    supabase.from('enseignants').select('id, civilite, prenom, nom').eq('actif', true).order('nom'),
  ])
  return {
    niveaux: niveaux ?? [],
    series: series ?? [],
    salles: salles ?? [],
    enseignants: (enseignants ?? []).map((e) => ({ id: e.id, nom: `${e.civilite ?? ''} ${e.prenom} ${e.nom}`.trim() })),
  }
}
