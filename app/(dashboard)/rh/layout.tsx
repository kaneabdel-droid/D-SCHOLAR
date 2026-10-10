import PageHeader from '@/components/PageHeader'
import { getDictionary, getLocale } from '@/dictionaries'
import RhTabs from './RhTabs'

export default async function RhLayout({ children }: { children: React.ReactNode }) {
  const dict = await getDictionary(await getLocale())

  return (
    <div>
      <PageHeader title={dict.rh.title} subtitle={dict.rh.subtitle} />
      <RhTabs libelles={dict.rh.tabs} />
      <div className="mt-6">{children}</div>
    </div>
  )
}
