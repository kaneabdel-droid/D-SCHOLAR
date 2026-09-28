import PageHeader from '@/components/PageHeader'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import ParametresTabs from './ParametresTabs'

// Garde-fou commun à tous les onglets : direction et censeur uniquement.
export default async function ParametresLayout({ children }: { children: React.ReactNode }) {
  await requireParametrage()
  const dict = await getDictionary(await getLocale())

  return (
    <div>
      <PageHeader title={dict.parametres.title} subtitle={dict.parametres.subtitle} />
      <ParametresTabs libelles={dict.parametres.tabs} />
      <div className="mt-6">{children}</div>
    </div>
  )
}
