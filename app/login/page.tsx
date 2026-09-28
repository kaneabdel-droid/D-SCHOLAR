import AuthShell from '@/components/AuthShell'
import { btnPrimary, inputClass, labelClass } from '@/components/ui/styles'
import { getDictionary, getLocale } from '@/dictionaries'
import { login } from './actions'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.auth.login

  return (
    <AuthShell dict={dict} locale={locale} title={t.title} desc={t.desc} message={message}>
      <form className="space-y-5" action={login}>
        <div>
          <label htmlFor="email" className={labelClass}>{t.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={labelClass}>{t.password}</label>
            <a href="/forgot-password" className="text-sm font-semibold text-primary hover:text-primary-hover">
              {t.forgotPassword}
            </a>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </div>
        <button type="submit" className={`${btnPrimary} w-full py-2.5`}>{t.submit}</button>
      </form>
      <p className="mt-10 text-center text-xs text-foreground-muted">{t.noAccount}</p>
    </AuthShell>
  )
}
