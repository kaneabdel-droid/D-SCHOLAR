'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

// Passe par /auth/callback pour échanger le code Supabase contre une session
// avant d'atterrir sur /update-password (sinon l'utilisateur arrive déconnecté).
export async function resetPasswordForEmail(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const isAdmin = formData.get('admin') === '1'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const next = encodeURIComponent(`/update-password${isAdmin ? '?admin=1' : ''}`)
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=${next}`,
  })

  // Même réponse que l'email existe ou non : ne révèle pas quels comptes existent.
  if (error) console.error('resetPasswordForEmail:', error.message)

  return redirect(`${isAdmin ? '/admin/login' : '/login'}?message=mail`)
}
