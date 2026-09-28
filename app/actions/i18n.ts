'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function setLanguage(lang: string) {
  const cookieStore = await cookies()
  cookieStore.set('lang', lang, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 an
  })

  revalidatePath('/', 'layout')
}
