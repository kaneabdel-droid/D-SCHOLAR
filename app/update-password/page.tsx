import AuthShell from '@/components/AuthShell'
import { btnPrimary, inputClass, labelClass } from '@/components/ui/styles'
import { getDictionary, getLocale } from '@/dictionaries'
import { updatePassword } from './actions'

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; admin?: string }>
}) {
  const { message, admin } = await searchParams
  const isAdmin = admin === '1'
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.auth.updatePassword

  return (
    <AuthShell dict={dict} locale={locale} title={t.title} desc={t.desc} message={message}>
      <form className="space-y-5" action={updatePassword}>
        {isAdmin && <input type="hidden" name="admin" value="1" />}
        <div>
          <label htmlFor="password" className={labelClass}>{t.password}</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
        </div>
        <div>
          <label htmlFor="password_confirm" className={labelClass}>{t.confirmPassword}</label>
          <input id="password_confirm" name="password_confirm" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
        </div>
        <button type="submit" className={`${btnPrimary} w-full py-2.5`}>{t.submit}</button>
      </form>
    </AuthShell>
  )
}
