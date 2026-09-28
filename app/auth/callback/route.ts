import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Point de passage obligé pour les liens envoyés par Supabase Auth (récupération
// de mot de passe) : Supabase redirige ici avec un `code` à échanger contre une
// session AVANT d'atterrir sur la page finale (`next`). Sans cette route, le
// code n'est jamais échangé et l'utilisateur atterrit déconnecté.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/update-password'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?message=lien`)
}
