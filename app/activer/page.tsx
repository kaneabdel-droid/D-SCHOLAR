import Link from 'next/link'
import { KeyRound } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { getDictionary, getLocale } from '@/dictionaries'
import ActiverForm from './ActiverForm'

// Activation de l'accès parent / élève (page publique, lien ou QR code remis
// par le secrétariat avec le code : /activer?code=XXXXXXXX).
export default async function ActiverPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.activation
  return (
    <div className="relative min-h-dvh bg-background px-4 py-12">
      <div className="absolute top-4 end-4"><LanguageSelector currentLang={locale} /></div>
      <div className="mx-auto w-full max-w-md rounded-2xl border border-surface-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><KeyRound className="h-7 w-7" /></span>
          <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="mt-2 text-sm text-foreground-muted">{t.desc}</p>
        </div>
        <div className="mt-6"><ActiverForm codeInitial={(code ?? '').toUpperCase().slice(0, 12)} dict={dict} /></div>
        <p className="mt-6 text-center text-sm text-foreground-muted">
          {t.dejaCompte} <Link href="/login" className="font-medium text-primary hover:underline">{dict.common.loginLink}</Link>
        </p>
      </div>
    </div>
  )
}
