'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { withRetry, withRetryResult } from '@/utils/supabase/retry'
import { isAdminEmail } from '@/lib/admin/auth'

type ActionResult = { success?: true; error?: string }

async function checkAdmin(): Promise<string | null> {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  return isAdminEmail(sharedUser?.email) || isAdminEmail(localUser?.email) ? null : 'Non autorisé'
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Crée l'établissement de démonstration « Groupe scolaire Les Palmiers » avec
// ses comptes (direction, M. Ibrahima Ndiaye enseignant Maths + PC, parent),
// remplit les données via creer_demo() (07_demo.sql), puis le groupe à trois
// sites (Dakar, Thiès, Saint-Louis) et le compte du directeur général. Compensation
// complète en cas d'échec : aucun établissement ni compte orphelin.
export async function creerDemo(emailDirection: string, emailEnseignant: string, emailParent: string, emailDirecteurGeneral: string, motDePasse: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  const direction = emailDirection.trim().toLowerCase()
  const enseignant = emailEnseignant.trim().toLowerCase()
  const parent = emailParent.trim().toLowerCase()
  const emailDg = emailDirecteurGeneral.trim().toLowerCase()
  if (![direction, enseignant, parent, emailDg].every((m) => EMAIL.test(m))) return { error: 'Emails invalides' }
  if (new Set([direction, enseignant, parent, emailDg]).size < 4) return { error: 'Les quatre emails doivent être différents' }
  if (motDePasse.length < 8) return { error: 'Le mot de passe doit contenir au moins 8 caractères' }

  const supabase = createAdminClient()
  const dansUnAn = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

  const { data: etab, error: etabError } = await withRetryResult(() =>
    supabase
      .from('etablissements')
      .insert({
        nom: 'Groupe scolaire Les Palmiers (démo)',
        sigle: 'GSLP',
        adresse: 'Rue 10 x Avenue Bourguiba, Sicap Liberté',
        ville: 'Dakar',
        telephone: '33 824 56 78',
        email: 'contact@lespalmiers.sn',
        palier: 'complet',
        acces_manuel_jusqu_au: dansUnAn,
      })
      .select('id')
      .single()
  )
  if (etabError || !etab) return { error: etabError?.message ?? "Échec de la création de l'établissement" }

  const comptes: string[] = []
  const annuler = async () => {
    await withRetry(() => supabase.from('etablissements').delete().eq('id', etab.id)).catch(() => {})
    for (const id of comptes) await withRetry(() => supabase.auth.admin.deleteUser(id)).catch(() => {})
  }

  const creerCompte = async (email: string, role: 'direction' | 'enseignant', prenom: string, nom: string) => {
    const { data, error } = await withRetryResult(() => supabase.auth.admin.createUser({ email, password: motDePasse, email_confirm: true }))
    if (error || !data?.user) throw new Error(`Compte ${email} : ${error?.message ?? 'échec de création'}`)
    comptes.push(data.user.id)
    const { error: insertError } = await withRetryResult(() =>
      supabase.from('utilisateurs').insert({ id: data.user.id, etablissement_id: etab.id, role, prenom, nom, email })
    )
    if (insertError) throw new Error(insertError.message)
    return data.user.id
  }

  try {
    await creerCompte(direction, 'direction', 'Awa', 'Ndoye')
    const idEnseignant = await creerCompte(enseignant, 'enseignant', 'Ibrahima', 'Ndiaye')
    // Parent : compte auth seul, le profil famille (et ses deux enfants) est créé par creer_demo().
    const { data: p, error: ep } = await withRetryResult(() => supabase.auth.admin.createUser({ email: parent, password: motDePasse, email_confirm: true }))
    if (ep || !p?.user) throw new Error(`Compte ${parent} : ${ep?.message ?? 'échec de création'}`)
    comptes.push(p.user.id)

    const { error } = await supabase.rpc('creer_demo', { p_etablissement_id: etab.id, p_utilisateur_enseignant: idEnseignant, p_utilisateur_parent: p.user.id })
    if (error) throw new Error(`Génération des données : ${error.message}`)

    // Groupe de démonstration : deux autres sites + le compte du directeur général.
    const sites: string[] = []
    for (const s of [
      { nom: 'Les Palmiers · Thiès (démo)', sigle: 'GSLT', ville: 'Thiès', adresse: 'Quartier Randoulène, route de Dakar', telephone: '33 951 40 12' },
      { nom: 'Les Palmiers · Saint-Louis (démo)', sigle: 'GSLS', ville: 'Saint-Louis', adresse: 'Sor, avenue Général de Gaulle', telephone: '33 961 22 45' },
    ]) {
      const { data, error: es } = await withRetryResult(() => supabase.from('etablissements').insert({ ...s, palier: 'complet', acces_manuel_jusqu_au: dansUnAn }).select('id').single())
      if (es || !data) throw new Error(`Site ${s.ville} : ${es?.message ?? 'échec'}`)
      sites.push(data.id)
    }
    const { data: dg, error: ed } = await withRetryResult(() => supabase.auth.admin.createUser({ email: emailDg, password: motDePasse, email_confirm: true }))
    if (ed || !dg?.user) throw new Error(`Compte ${emailDg} : ${ed?.message ?? 'échec de création'}`)
    comptes.push(dg.user.id)
    const { error: eg } = await supabase.rpc('creer_demo_groupe', { p_principal: etab.id, p_site2: sites[0], p_site3: sites[1], p_dg: dg.user.id })
    if (eg) {
      for (const id of sites) await withRetry(() => supabase.from('etablissements').delete().eq('id', id)).catch(() => {})
      throw new Error(`Groupe de démonstration : ${eg.message}`)
    }
  } catch (err) {
    await annuler()
    return { error: (err as Error).message }
  }

  revalidatePath('/admin')
  return { success: true }
}
