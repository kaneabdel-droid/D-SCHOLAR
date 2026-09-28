import { redirect } from 'next/navigation'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { getLocale, getDictionary } from '@/dictionaries'
import ClientLayout from './ClientLayout'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // getCurrentUserContext() redirige déjà vers /login sans session.
  const context = await getCurrentUserContext()

  // /compte-suspendu vit hors de ce layout pour rester atteignable.
  if (context.etablissementStatut === 'suspendu') redirect('/compte-suspendu')

  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return (
    <ClientLayout
      role={context.role}
      etablissementNom={context.etablissementNom}
      anneeLibelle={context.anneeActive?.libelle ?? null}
      utilisateurNom={[context.prenom, context.nom].filter(Boolean).join(' ') || context.email || ''}
      locale={locale}
      dict={dict}
    >
      {children}
    </ClientLayout>
  )
}
