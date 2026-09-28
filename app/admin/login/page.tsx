import AuthShell from '@/components/AuthShell'
import { btnPrimary, inputClass, labelClass } from '@/components/ui/styles'
import { getDictionary, getLocale } from '@/dictionaries'
import { loginAdmin } from './actions'

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.auth.adminLogin

  return (
    <AuthShell dict={dict} locale={locale} title={t.title} desc={t.desc} message={message}>
      <form className="space-y-5" action={loginAdmin}>
        <div>
          <label htmlFor="email" className={labelClass}>{t.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={labelClass}>{t.password}</label>
            <a href="/forgot-password?admin=1" className="text-sm font-semibold text-primary hover:text-primary-hover">
              {t.forgotPassword}
            </a>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </div>
        <button type="submit" className={`${btnPrimary} w-full py-2.5`}>{t.submit}</button>
      </form>
      <p className="mt-8 text-center text-xs text-foreground-muted">
        {t.notSchoolSpace}{' '}
        <a href="/login" className="font-semibold text-primary hover:text-primary-hover">{t.clientLogin}</a>
      </p>
    </AuthShell>
  )
}
