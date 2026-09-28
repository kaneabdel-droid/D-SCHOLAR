import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminIdentityClient } from '@/utils/supabase/admin-identity'

// Déconnexion de l'identité admin partagée (SSO inter-produits) — distincte de
// /logout qui déconnecte la session client (établissement). Efface le cookie
// à domaine .dembasolution.com (déconnecte aussi des autres produits DembaSolution)
// et, par précaution, une éventuelle session admin locale à D-Scholar (secours).
export async function GET() {
  const adminIdentitySupabase = await createAdminIdentityClient()
  await adminIdentitySupabase.auth.signOut()

  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.redirect('https://www.dembasolution.com/admin/login')
}
