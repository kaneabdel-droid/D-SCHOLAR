import PageHeader from '@/components/PageHeader'
import { getDictionary, getLocale } from '@/dictionaries'
import TresorerieTabs from './TresorerieTabs'

export default async function TresorerieLayout({ children }: { children: React.ReactNode }) {
  const dict = await getDictionary(await getLocale())

  return (
    <div>
      <PageHeader title={dict.tresorerie.title} subtitle={dict.tresorerie.subtitle} />
      <TresorerieTabs libelles={dict.tresorerie.tabs} />
      <div className="mt-6">{children}</div>
    </div>
  )
}
