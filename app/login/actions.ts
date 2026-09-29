'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { identifiantVersEmail } from '@/lib/famille'

// Verrouillage 1 minute après 3 échecs (même mécanisme que D-QUINCA). Les
// messages sont des codes traduits par AuthShell (dict.auth.messages).
export async function login(formData: FormData) {
  const cookieStore = await cookies()

  const lockoutUntil = cookieStore.get('lockout_until')?.value
  if (lockoutUntil && parseInt(lockoutUntil) > Date.now()) {
    redirect('/login?message=verrou')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    // Email, ou numéro de téléphone d'un parent inscrit sans email (cf. lib/famille.ts).
    email: identifiantVersEmail((formData.get('email') as string) ?? ''),
    password: formData.get('password') as string,
  })

  if (error) {
    const attemptsCookie = cookieStore.get('login_attempts')?.value
    const attempts = attemptsCookie ? parseInt(attemptsCookie) + 1 : 1

    if (attempts >= 3) {
      cookieStore.set('lockout_until', (Date.now() + 60_000).toString(), { maxAge: 60 })
      cookieStore.delete('login_attempts')
      redirect('/login?message=verrou')
    }
    cookieStore.set('login_attempts', attempts.toString(), { maxAge: 300 })
    redirect('/login?message=identifiants')
  }

  cookieStore.delete('login_attempts')
  cookieStore.delete('lockout_until')

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
