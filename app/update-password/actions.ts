'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('password_confirm') as string
  const isAdmin = formData.get('admin') === '1'
  const adminQuery = isAdmin ? '&admin=1' : ''

  if (!password || password.length < 8) {
    return redirect(`/update-password?message=mdpCourt${adminQuery}`)
  }
  if (password !== passwordConfirm) {
    return redirect(`/update-password?message=mdpDiff${adminQuery}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    console.error('updatePassword:', error.message)
    return redirect(`/update-password?message=lien${adminQuery}`)
  }

  return redirect(`${isAdmin ? '/admin/login' : '/login'}?message=mdpOk`)
}
