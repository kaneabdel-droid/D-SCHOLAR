'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { isAdminEmail } from '@/lib/admin/auth'

// Verrouillage après échecs répétés, séparé de celui de /login (cookies dédiés)
// pour ne pas mélanger les tentatives d'un client avec celles de l'admin.
const ATTEMPTS_COOKIE = 'admin_login_attempts'
const LOCKOUT_COOKIE = 'admin_lockout_until'
const MAX_ATTEMPTS = 3
const LOCKOUT_MS = 60_000

export async function loginAdmin(formData: FormData) {
  const cookieStore = await cookies()

  const lockoutUntil = cookieStore.get(LOCKOUT_COOKIE)?.value
  if (lockoutUntil && parseInt(lockoutUntil) > Date.now()) {
    redirect('/admin/login?message=verrou')
  }

  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  const registerFailedAttempt = async () => {
    const attemptsCookie = cookieStore.get(ATTEMPTS_COOKIE)?.value
    const attempts = attemptsCookie ? parseInt(attemptsCookie) + 1 : 1

    if (attempts >= MAX_ATTEMPTS) {
      cookieStore.set(LOCKOUT_COOKIE, (Date.now() + LOCKOUT_MS).toString(), { maxAge: 60 })
      cookieStore.delete(ATTEMPTS_COOKIE)
    } else {
      cookieStore.set(ATTEMPTS_COOKIE, attempts.toString(), { maxAge: 300 })
    }
  }

  if (error) {
    await registerFailedAttempt()
    redirect('/admin/login?message=identifiants')
  }

  // L'email/mot de passe est valide mais ce n'est pas un compte administrateur :
  // on referme immédiatement la session pour ne jamais laisser une session
  // authentifiée traîner suite à une tentative d'accès à /admin non autorisée.
  if (!isAdminEmail(data.user?.email)) {
    await registerFailedAttempt()
    await supabase.auth.signOut()
    redirect('/admin/login?message=pasAdmin')
  }

  cookieStore.delete(ATTEMPTS_COOKIE)
  cookieStore.delete(LOCKOUT_COOKIE)

  redirect('/admin')
}
