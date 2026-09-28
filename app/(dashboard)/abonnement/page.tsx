import PageHeader from '@/components/PageHeader'
import { requireDirection } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import AbonnementPanel from './AbonnementPanel'

export default async function AbonnementPage() {
  const context = await requireDirection()
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return (
    <div>
      <PageHeader title={dict.abonnement.title} subtitle={dict.abonnement.subtitle} />
      <AbonnementPanel context={context} dict={dict} locale={locale} />
    </div>
  )
}
