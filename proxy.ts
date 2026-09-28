import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/proxy'

// Next 16 : la convention `middleware` est dépréciée au profit de `proxy`
// (cf. node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques et les images.
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
