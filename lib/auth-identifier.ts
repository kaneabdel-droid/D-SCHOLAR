import type { SupabaseClient } from '@supabase/supabase-js'

export const DOMAINE_AUTH_INTERNE = 'auth.dembasolution.internal'

/**
 * Nettoie et normalise un identifiant ou un numéro de téléphone.
 */
export function normaliserIdentifiant(input: string): string {
  return input.trim().toLowerCase()
}

/**
 * Génère un e-mail synthétique sécurisé pour Supabase Auth à partir d'un identifiant ou téléphone.
 */
export function genererEmailSynthetique(identifiantOuTelephone: string): string {
  const clean = normaliserIdentifiant(identifiantOuTelephone).replace(/[^a-z0-9_.-]/g, '_')
  return `${clean}@${DOMAINE_AUTH_INTERNE}`
}

/**
 * Détermine si une adresse e-mail est un alias synthétique interne.
 */
export function estEmailSynthetique(email?: string | null): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${DOMAINE_AUTH_INTERNE}`) || email.toLowerCase().endsWith('@famille.scholar.dembasolution.com')
}

/**
 * Résout une chaîne de connexion saisie (e-mail réel, pseudo/identifiant ou téléphone)
 * vers l'adresse e-mail auth correspondante dans Supabase.
 */
export async function resoudreAuthEmail(
  identifiantOuEmail: string,
  supabaseAdmin: SupabaseClient
): Promise<{ email: string; isSynthetic: boolean; userId?: string }> {
  const rawInput = identifiantOuEmail.trim()

  if (rawInput.includes('@') && !estEmailSynthetique(rawInput)) {
    return {
      email: rawInput.toLowerCase(),
      isSynthetic: false,
    }
  }

  const cleanIdentifiant = normaliserIdentifiant(rawInput)

  try {
    const { data: userRow } = await supabaseAdmin
      .from('utilisateurs')
      .select('id, identifiant, telephone')
      .or(`identifiant.ilike.${cleanIdentifiant},telephone.eq.${cleanIdentifiant}`)
      .maybeSingle()

    if (userRow?.id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userRow.id)
      if (authUser?.user?.email) {
        return {
          email: authUser.user.email,
          isSynthetic: estEmailSynthetique(authUser.user.email),
          userId: userRow.id,
        }
      }
    }
  } catch (err) {
    // Si les colonnes identifiant/telephone ne sont pas encore sur utilisateurs, fallback email synthétique
  }

  // Vérifier également si un compte parent famille existe
  try {
    const chiffresTel = cleanIdentifiant.replace(/\D/g, '')
    const { data: parentRow } = await supabaseAdmin
      .from('comptes_famille')
      .select('id, telephone')
      .eq('telephone', cleanIdentifiant)
      .maybeSingle()

    if (parentRow?.id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(parentRow.id)
      if (authUser?.user?.email) {
        return {
          email: authUser.user.email,
          isSynthetic: true,
          userId: parentRow.id,
        }
      }
    }
    if (chiffresTel.length >= 7) {
      return {
        email: `${chiffresTel}@famille.scholar.dembasolution.com`,
        isSynthetic: true,
      }
    }
  } catch {}

  return {
    email: genererEmailSynthetique(cleanIdentifiant),
    isSynthetic: true,
  }
}
