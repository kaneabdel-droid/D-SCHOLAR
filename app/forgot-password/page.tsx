import AuthShell from '@/components/AuthShell'
import { btnPrimary, inputClass, labelClass } from '@/components/ui/styles'
import { getDictionary, getLocale } from '@/dictionaries'
import { resetPasswordForEmail } from './actions'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; admin?: string }>
}) {
  const { message, admin } = await searchParams
  const isAdmin = admin === '1'
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.auth.forgotPassword

  return (
    <AuthShell dict={dict} locale={locale} title={t.title} desc={t.desc} message={message}>
      <form className="space-y-5" action={resetPasswordForEmail}>
        {isAdmin && <input type="hidden" name="admin" value="1" />}
        <div>
          <label htmlFor="email" className={labelClass}>{t.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>
        <button type="submit" className={`${btnPrimary} w-full py-2.5`}>{t.submit}</button>
      </form>
      <p className="mt-8 text-center text-sm">
        <a href={isAdmin ? '/admin/login' : '/login'} className="font-semibold text-primary hover:text-primary-hover">
          {t.backToLogin}
        </a>
      </p>
    </AuthShell>
  )
}
