'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { withRetry, withRetryResult } from '@/utils/supabase/retry'
import { requireDirection } from '@/lib/auth/getCurrentUserContext'
import { ROLES, type Role } from '@/lib/roles'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string }

const POSTE_MAX = 100

// Bannissement long plutôt qu'un vrai statut « désactivé » (absent de Supabase
// Auth) — même mécanisme que D-QUINCA et SIGGIE.
const BAN_DUREE_DESACTIVATION = '87600h'

// La direction crée les comptes de son personnel. utilisateurs n'a aucune
// policy d'écriture (03_rls_policies.sql) : on passe par le client service
// role, APRÈS avoir vérifié le rôle (requireDirection) et en forçant
// l'etablissement_id de l'appelant — jamais une valeur venue du formulaire.
export async function creerUtilisateur(formData: FormData): Promise<ActionResult> {
  const context = await requireDirection()
  const dict = await getDictionary()
  // Lecture seule (retard de paiement) : écriture refusée, le RLS la bloquerait aussi.
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }
  // Démo publique : les comptes (dont ceux utilisés par la connexion directe) ne se modifient pas.
  if (context.estDemo) return { error: dict.errors.demo }
  const t = dict.utilisateurs
  const champ = (nom: string) => ((formData.get(nom) as string | null) ?? '').trim()

  const email = champ('email').toLowerCase()
  const password = (formData.get('password') as string | null) ?? ''
  const role = champ('role') as Role

  if (!champ('nom')) return { error: fmt(dict.errors.required, { champ: t.nom }) }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: dict.errors.emailInvalid }
  if (password.length < 8) return { error: dict.errors.passwordShort }
  if (!ROLES.includes(role)) return { error: fmt(dict.errors.required, { champ: t.role }) }

  const supabase = createAdminClient()
  const { data: created, error: createError } = await withRetryResult(() =>
    supabase.auth.admin.createUser({ email, password, email_confirm: true })
  )
  if (createError || !created?.user) {
    console.error('creerUtilisateur(auth):', createError?.message)
    return { error: createError?.message?.toLowerCase().includes('already') ? dict.errors.duplicate : dict.errors.generic }
  }

  const { error: insertError } = await withRetryResult(() =>
    supabase.from('utilisateurs').insert({
      id: created.user.id,
      etablissement_id: context.etablissementId,
      role,
      nom: champ('nom'),
      prenom: champ('prenom') || null,
      email,
      telephone: champ('telephone') || null,
      // Seulement si renseigné : la création reste possible avant la migration 15.
      ...(champ('poste') ? { poste: champ('poste').slice(0, POSTE_MAX) } : {}),
    })
  )
  if (insertError) {
    await withRetry(() => supabase.auth.admin.deleteUser(created.user.id)).catch(() => {}) // évite un compte auth orphelin
    return { error: messageErreur(insertError, dict, 'creerUtilisateur') }
  }

  revalidatePath('/parametres/utilisateurs')
  return { success: true }
}

// Vérifie que l'utilisateur ciblé appartient bien à l'établissement de la
// direction appelante (le client service role ne filtre rien de lui-même).
async function cibleDeMonEtablissement(utilisateurId: string, etablissementId: string) {
  const supabase = createAdminClient()
  const { data } = await withRetryResult(() =>
    supabase.from('utilisateurs').select('id').eq('id', utilisateurId).eq('etablissement_id', etablissementId).maybeSingle()
  )
  return Boolean(data)
}

export async function changerRole(utilisateurId: string, role: Role): Promise<ActionResult> {
  const context = await requireDirection()
  const dict = await getDictionary()
  // Lecture seule (retard de paiement) : écriture refusée, le RLS la bloquerait aussi.
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }
  // Démo publique : les comptes (dont ceux utilisés par la connexion directe) ne se modifient pas.
  if (context.estDemo) return { error: dict.errors.demo }
  if (utilisateurId === context.userId) return { error: dict.errors.selfAction }
  if (!ROLES.includes(role)) return { error: dict.errors.generic }
  if (!(await cibleDeMonEtablissement(utilisateurId, context.etablissementId))) return { error: dict.errors.forbidden }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() =>
    supabase.from('utilisateurs').update({ role }).eq('id', utilisateurId).eq('etablissement_id', context.etablissementId)
  )
  if (error) return { error: messageErreur(error, dict, 'changerRole') }

  revalidatePath('/parametres/utilisateurs')
  return { success: true }
}

export async function changerStatut(utilisateurId: string, actif: boolean): Promise<ActionResult> {
  const context = await requireDirection()
  const dict = await getDictionary()
  // Lecture seule (retard de paiement) : écriture refusée, le RLS la bloquerait aussi.
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }
  // Démo publique : les comptes (dont ceux utilisés par la connexion directe) ne se modifient pas.
  if (context.estDemo) return { error: dict.errors.demo }
  if (utilisateurId === context.userId) return { error: dict.errors.selfAction }
  if (!(await cibleDeMonEtablissement(utilisateurId, context.etablissementId))) return { error: dict.errors.forbidden }

  const supabase = createAdminClient()
  // Le ban coupe la connexion ; le flag `actif` coupe l'accès aux données
  // (current_etablissement_id() l'exige) même si une session était ouverte.
  const { error: banError } = await withRetryResult(() =>
    supabase.auth.admin.updateUserById(utilisateurId, { ban_duration: actif ? 'none' : BAN_DUREE_DESACTIVATION })
  )
  if (banError) {
    console.error('changerStatut(auth):', banError.message)
    return { error: dict.errors.generic }
  }

  const { error } = await withRetryResult(() =>
    supabase.from('utilisateurs').update({ actif }).eq('id', utilisateurId).eq('etablissement_id', context.etablissementId)
  )
  if (error) return { error: messageErreur(error, dict, 'changerStatut') }

  revalidatePath('/parametres/utilisateurs')
  return { success: true }
}

// Intitulé de poste (libellé libre, 15_poste_utilisateurs.sql) : modifiable par la
// direction, y compris pour elle-même — il ne touche à aucun droit.
export async function changerPoste(utilisateurId: string, poste: string): Promise<ActionResult> {
  const context = await requireDirection()
  const dict = await getDictionary()
  if (context.acces !== 'complet') return { error: dict.errors.lectureSeule }
  if (context.estDemo) return { error: dict.errors.demo }
  if (!(await cibleDeMonEtablissement(utilisateurId, context.etablissementId))) return { error: dict.errors.forbidden }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() =>
    supabase
      .from('utilisateurs')
      .update({ poste: poste.trim().slice(0, POSTE_MAX) || null })
      .eq('id', utilisateurId)
      .eq('etablissement_id', context.etablissementId)
  )
  if (error) return { error: messageErreur(error, dict, 'changerPoste') }

  revalidatePath('/parametres/utilisateurs')
  revalidatePath('/', 'layout')
  return { success: true }
}
