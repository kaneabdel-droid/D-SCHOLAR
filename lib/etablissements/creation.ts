import type { SupabaseClient } from '@supabase/supabase-js'
import { withRetry, withRetryResult } from '@/utils/supabase/retry'
import { PALIER_CODES, type PalierCode } from '@/lib/abonnements/paliers'

export type NouvelEtablissement = {
  nom: string
  sigle?: string
  ville: string
  telephone: string
  palier: PalierCode
  prive?: boolean
  directionNom: string
  directionPrenom: string
  directionEmail: string
  directionPassword: string
  /** Accès offert jusqu'à cette date (AAAA-MM-JJ), vide = aucun. */
  accesOffertJusquAu?: string
  groupeId?: string | null
}

// Crée l'établissement, son référentiel par défaut (niveaux / séries / matières
// du palier) et le compte de la direction, avec compensation à chaque étape
// pour ne laisser ni établissement vide ni compte auth orphelin. `supabase` est
// le client service role ; l'appelant vérifie les droits (admin ou DG du groupe).
export async function creerEtablissementAvecDirection(supabase: SupabaseClient, e: NouvelEtablissement): Promise<{ id?: string; error?: string }> {
  if (!e.nom.trim()) return { error: 'nom' }
  if (!PALIER_CODES.includes(e.palier)) return { error: 'palier' }
  if (!e.directionNom.trim()) return { error: 'directionNom' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.directionEmail.trim())) return { error: 'directionEmail' }
  if (e.directionPassword.length < 8) return { error: 'motDePasse' }

  const { data: etab, error: etabError } = await withRetryResult(() =>
    supabase
      .from('etablissements')
      .insert({
        nom: e.nom.trim(),
        sigle: e.sigle?.trim() || null,
        ville: e.ville.trim() || null,
        telephone: e.telephone.trim() || null,
        palier: e.palier,
        statut_juridique: e.prive === false ? 'public' : 'prive',
        groupe_id: e.groupeId ?? null,
        acces_manuel_jusqu_au: e.accesOffertJusquAu && /^\d{4}-\d{2}-\d{2}$/.test(e.accesOffertJusquAu) ? `${e.accesOffertJusquAu}T23:59:59Z` : null,
      })
      .select('id')
      .single()
  )
  if (etabError || !etab) return { error: etabError?.message ?? "Échec de la création de l'établissement" }

  const annuler = () => withRetry(() => supabase.from('etablissements').delete().eq('id', etab.id)).catch(() => {})

  const { error: refError } = await withRetryResult(() => supabase.rpc('initialiser_referentiel', { p_etablissement_id: etab.id }))
  if (refError) {
    await annuler()
    return { error: `Référentiel : ${refError.message}` }
  }

  const email = e.directionEmail.trim().toLowerCase()
  const { data: created, error: createError } = await withRetryResult(() =>
    supabase.auth.admin.createUser({ email, password: e.directionPassword, email_confirm: true })
  )
  if (createError || !created?.user) {
    await annuler()
    return { error: `Compte direction : ${createError?.message ?? 'échec de création'}` }
  }

  const { error: userError } = await withRetryResult(() =>
    supabase.from('utilisateurs').insert({
      id: created.user.id,
      etablissement_id: etab.id,
      role: 'direction',
      nom: e.directionNom.trim(),
      prenom: e.directionPrenom.trim() || null,
      email,
    })
  )
  if (userError) {
    await withRetry(() => supabase.auth.admin.deleteUser(created.user.id)).catch(() => {})
    await annuler()
    return { error: userError.message }
  }
  return { id: etab.id }
}
