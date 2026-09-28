import type { SupabaseClient } from '@supabase/supabase-js'

export type Annee = { id: string; libelle: string; active: boolean; cloturee: boolean }
export type Appreciation = { libelle: string; moyenne_min: number; categorie: 'distinction' | 'neutre' | 'avertissement' }

// Années de l'établissement (RLS), la plus récente d'abord, et année retenue :
// celle demandée dans l'URL, sinon l'année active.
export async function anneesEtSelection(supabase: SupabaseClient, anneeParam?: string) {
  const { data } = await supabase.from('annees_scolaires').select('id, libelle, active, cloturee').order('date_debut', { ascending: false })
  const annees = (data ?? []) as Annee[]
  const selection = annees.find((a) => a.id === anneeParam) ?? annees.find((a) => a.active) ?? annees[0] ?? null
  return { annees, selection }
}

export async function baremeAppreciations(supabase: SupabaseClient): Promise<Appreciation[]> {
  const { data } = await supabase.from('appreciations').select('libelle, moyenne_min, categorie').eq('actif', true).order('moyenne_min', { ascending: false })
  return (data ?? []).map((a) => ({ ...a, moyenne_min: Number(a.moyenne_min) })) as Appreciation[]
}

// Mention retenue : seuil le plus élevé qui ne dépasse pas la moyenne (barème de l'établissement).
export function appreciationPour(bareme: Appreciation[], moyenne: number | null | undefined): Appreciation | null {
  if (moyenne === null || moyenne === undefined) return null
  return bareme.find((a) => moyenne >= a.moyenne_min) ?? null
}

export const TEINTES_APPRECIATION: Record<Appreciation['categorie'], string> = {
  distinction: 'bg-success/10 text-success',
  neutre: 'bg-foreground-muted/10 text-foreground-muted',
  avertissement: 'bg-danger/10 text-danger',
}

export const TEINTES_DECISION: Record<string, string> = {
  admis: 'bg-success/10 text-success',
  repechage: 'bg-warning/10 text-warning',
  redouble: 'bg-danger/10 text-danger',
  exclu: 'bg-danger/10 text-danger',
}

export function un<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

export function moyenneLisible(n: number | string | null | undefined, locale: string) {
  if (n === null || n === undefined || n === '') return '—'
  return Number(n).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
