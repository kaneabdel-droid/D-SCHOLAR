import Link from 'next/link'
import AuthShell from '@/components/AuthShell'
import ClientLoginForm from './ClientLoginForm'
import { getDictionary, getLocale } from '@/dictionaries'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.auth.login

  return (
    <AuthShell dict={dict} locale={locale} title={t.title} desc={t.desc} message={message}>
      <ClientLoginForm dict={dict} />
      <Link href="/decouvrir-dscholar" className="mt-6 flex w-full items-center justify-center rounded-lg border border-surface-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-foreground hover:bg-primary-soft">
        {dict.demo.lien}
      </Link>
      <p className="mt-8 text-center text-xs text-foreground-muted">{t.noAccount}</p>
    </AuthShell>
  )
}
