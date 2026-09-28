import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { withRetry } from '@/utils/supabase/retry'

// Client Supabase dédié à l'identité admin partagée entre produits DembaSolution
// (SIGGIE, D-QUINCA, D-Scholar, ...) — projet Supabase de SIGGIE (source d'identité admin
// commune, pas celui de D-Scholar), cookie à domaine .dembasolution.com pour qu'il
// soit lisible par tous les produits hébergés sous ce domaine. Distinct du client
// habituel de utils/supabase/server.ts, qui reste scopé aux données de D-Scholar.
const ADMIN_COOKIE_OPTIONS = {
  name: 'sb-demba-admin',
  domain: '.dembasolution.com',
  sameSite: 'lax' as const,
  secure: true,
}

// Pour Server Components / Server Actions.
export async function createAdminIdentityClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.ADMIN_IDENTITY_SUPABASE_URL!,
    process.env.ADMIN_IDENTITY_SUPABASE_ANON_KEY!,
    {
      cookieOptions: ADMIN_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Appelé depuis un Server Component : sans effet si le middleware
            // rafraîchit déjà la session (même contrat que utils/supabase/server.ts).
          }
        },
      },
    }
  )
}

// Une page + ses Server Actions (checkAdmin de chaque module admin, layout.tsx,
// etc.) appelaient chacune leur propre getUser() réseau vers le projet Supabase
// partagé — jusqu'à 3-4 aller-retours pour une seule écriture (middleware +
// layout + action), ce qui ralentissait chaque action admin et multipliait les
// occasions d'un échec réseau transitoire ("fetch failed"). `cache()` de React
// mémoïse l'appel pour la durée d'une seule requête (une action + son
// re-rendu suite à revalidatePath comptent comme une seule requête serveur),
// donc un seul aller-retour réseau est réellement effectué. Un échec réseau est
// aussi capturé ici plutôt que de remonter en exception non gérée.
export const getSharedAdminUser = cache(async (): Promise<User | null> => {
  try {
    return await withRetry(async () => {
      const supabase = await createAdminIdentityClient()
      const { data: { user } } = await supabase.auth.getUser()
      return user
    })
  } catch {
    return null
  }
})

// Même mémoïsation pour le repli local à D-Scholar (checkAdmin de chaque module
// admin appelle les deux : identité partagée d'abord, repli local ensuite).
export const getLocalUser = cache(async (): Promise<User | null> => {
  try {
    return await withRetry(async () => {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      return user
    })
  } catch {
    return null
  }
})

// Pour le middleware — mêmes options de cookie, branchées sur request/response.
export function createAdminIdentityMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(
    process.env.ADMIN_IDENTITY_SUPABASE_URL!,
    process.env.ADMIN_IDENTITY_SUPABASE_ANON_KEY!,
    {
      cookieOptions: ADMIN_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}
