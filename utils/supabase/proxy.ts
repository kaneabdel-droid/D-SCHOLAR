import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin/auth'
import { createAdminIdentityMiddlewareClient } from '@/utils/supabase/admin-identity'
import { withRetry } from '@/utils/supabase/retry'

// Routes accessibles sans session : connexion / récupération de mot de passe,
// landing, démo publique (/decouvrir-dscholar), inscription (/tarifs), vérification
// des documents (/verifier), activation des comptes familles (/activer) et /api
// (webhooks et cron, authentifiés par leur propre secret).
const ROUTES_PUBLIQUES = ['/login', '/forgot-password', '/update-password', '/auth', '/api', '/decouvrir-dscholar', '/tarifs', '/verifier', '/activer']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT : aucune logique entre createServerClient et auth.getUser() (sinon
  // déconnexions aléatoires difficiles à diagnostiquer).
  const { pathname } = request.nextUrl

  // Point d'entrée de l'espace admin : jamais redirigé (sinon boucle).
  if (pathname === '/admin/login') {
    return supabaseResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Espace admin plateforme : même SSO inter-produits DembaSolution que D-QUINCA
  // (session partagée .dembasolution.com d'abord, session admin locale ensuite).
  if (pathname.startsWith('/admin')) {
    const sharedAdminUser = await withRetry(() =>
      createAdminIdentityMiddlewareClient(request, supabaseResponse)
        .auth.getUser()
        .then(({ data }) => data.user)
    ).catch(() => null)

    if (isAdminEmail(sharedAdminUser?.email) || isAdminEmail(user?.email)) {
      return supabaseResponse
    }

    // Connexion admin centralisée sur SIGGIE (www.dembasolution.com), retour ici
    // après authentification — même parcours que D-QUINCA. /admin/login local
    // reste utilisable en secours (session admin propre à D-Scholar).
    const returnTo = `https://scholar.dembasolution.com${pathname}${request.nextUrl.search}`
    return NextResponse.redirect(`https://www.dembasolution.com/admin/login?next=${encodeURIComponent(returnTo)}`)
  }

  if (!user && pathname !== '/' && !ROUTES_PUBLIQUES.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Renvoyer supabaseResponse tel quel : un nouvel objet réponse perdrait les
  // cookies de session rafraîchis.
  return supabaseResponse
}
