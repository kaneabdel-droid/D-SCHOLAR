import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { getDictionary, getLocale } from '@/dictionaries'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import FacturationTabs from './FacturationTabs'

export default async function FacturationLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentUserContext()
  if (context.statutJuridique === 'public') redirect('/dashboard')

  const dict = await getDictionary(await getLocale())

  return (
    <div>
      <PageHeader title={dict.facturation.title} subtitle={dict.facturation.subtitle} />
      <FacturationTabs libelles={dict.facturation.tabs} />
      <div className="mt-6">{children}</div>
    </div>
  )
}
