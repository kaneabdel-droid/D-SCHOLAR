import { redirect } from 'next/navigation'
import { GraduationCap, LogOut } from 'lucide-react'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { isAdminEmail } from '@/lib/admin/auth'

// Console interne de l'équipe plateforme (français uniquement, comme celle de
// D-QUINCA). Défense en profondeur : le proxy bloque déjà /admin aux non-admins.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])

  if (!isAdminEmail(sharedUser?.email) && !isAdminEmail(localUser?.email)) {
    redirect('/admin/login')
  }
  const user = isAdminEmail(sharedUser?.email) ? sharedUser : localUser

  return (
    <div className="min-h-dvh bg-background">
      <header className="bg-[var(--sidebar)] text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-semibold">D-Scholar · Administration</p>
            <p className="truncate text-xs text-white/60">{user?.email}</p>
          </div>
          <a href="/admin/logout" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Déconnexion</span>
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
