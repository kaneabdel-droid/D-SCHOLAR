'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resoudreAuthEmail } from '@/lib/auth-identifier'

export type LoginActionResult = {
  success?: boolean
  error?: string
  redirectUrl?: string
  userContext?: {
    userId: string
    nomComplet?: string | null
    identifiant: string
    telephone?: string | null
    email?: string | null
    role: string
    etablissementId: string
    etablissementNom: string
    gieId?: string
    gieNom?: string
    devise?: string
    permissions?: any
  }
}

export async function login(formData: FormData): Promise<LoginActionResult> {
  const cookieStore = await cookies()

  const lockoutUntil = cookieStore.get('lockout_until')?.value
  if (lockoutUntil && parseInt(lockoutUntil) > Date.now()) {
    return {
      error: 'Trop de tentatives échouées. Veuillez patienter 1 minute avant de réessayer.',
    }
  }

  const rawIdentifier = ((formData.get('email') as string) || (formData.get('identifier') as string) || '').trim()
  const password = (formData.get('password') as string) || ''

  if (!rawIdentifier) {
    return { error: 'Veuillez renseigner votre identifiant, téléphone ou e-mail.' }
  }
  if (!password) {
    return { error: 'Veuillez saisir votre mot de passe.' }
  }

  let resolvedEmail = rawIdentifier
  try {
    const adminSupabase = createAdminClient()
    const resolved = await resoudreAuthEmail(rawIdentifier, adminSupabase)
    resolvedEmail = resolved.email
  } catch {
    resolvedEmail = rawIdentifier
  }

  const supabase = await createClient()
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  })

  if (error || !signInData?.user) {
    const attemptsCookie = cookieStore.get('login_attempts')?.value
    const attempts = attemptsCookie ? parseInt(attemptsCookie) + 1 : 1

    if (attempts >= 3) {
      cookieStore.set('lockout_until', (Date.now() + 60_000).toString(), { maxAge: 60 })
      cookieStore.delete('login_attempts')
      return {
        error: 'Trop de tentatives échouées. Veuillez patienter 1 minute avant de réessayer.',
      }
    } else {
      cookieStore.set('login_attempts', attempts.toString(), { maxAge: 300 })
      return {
        error: 'Identifiant ou mot de passe non conforme. Veuillez réessayer.',
      }
    }
  }

  cookieStore.delete('login_attempts')
  cookieStore.delete('lockout_until')

  let userContext: LoginActionResult['userContext']
  try {
    const { data: userProfile } = await supabase
      .from('utilisateurs')
      .select('id, identifiant, telephone, nom, prenom, role, etablissement_id, etablissements(nom)')
      .eq('id', signInData.user.id)
      .maybeSingle()

    if (userProfile) {
      const etab = Array.isArray(userProfile.etablissements) ? userProfile.etablissements[0] : userProfile.etablissements
      const nomComplet = [userProfile.prenom, userProfile.nom].filter(Boolean).join(' ')
      userContext = {
        userId: userProfile.id,
        nomComplet: nomComplet || null,
        identifiant: userProfile.identifiant || rawIdentifier,
        telephone: userProfile.telephone || null,
        email: signInData.user.email || null,
        role: userProfile.role || 'enseignant',
        etablissementId: userProfile.etablissement_id,
        etablissementNom: etab?.nom || 'Mon Établissement',
        gieId: userProfile.etablissement_id,
        gieNom: etab?.nom || 'Mon Établissement',
        devise: 'XOF',
      }
    } else {
      // Cas compte famille parent
      const { data: famProfile } = await supabase
        .from('comptes_famille')
        .select('id, telephone, nom_complet, etablissement_id, etablissements(nom)')
        .eq('id', signInData.user.id)
        .maybeSingle()

      if (famProfile) {
        const etab = Array.isArray(famProfile.etablissements) ? famProfile.etablissements[0] : famProfile.etablissements
        userContext = {
          userId: famProfile.id,
          nomComplet: famProfile.nom_complet || null,
          identifiant: famProfile.telephone || rawIdentifier,
          telephone: famProfile.telephone || null,
          email: signInData.user.email || null,
          role: 'famille',
          etablissementId: famProfile.etablissement_id,
          etablissementNom: etab?.nom || 'Mon Établissement',
          gieId: famProfile.etablissement_id,
          gieNom: etab?.nom || 'Mon Établissement',
          devise: 'XOF',
        }
      }
    }
  } catch (err) {
    console.warn('Erreur récupération profil utilisateur pour cache hors-ligne D-SCHOLAR:', err)
  }

  revalidatePath('/', 'layout')

  return {
    success: true,
    redirectUrl: userContext?.role === 'famille' ? '/portail' : '/dashboard',
    userContext,
  }
}
