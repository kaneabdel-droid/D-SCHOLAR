import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { btnPrimary, inputClass } from '@/components/ui/styles'
import { getDictionary, getLocale } from '@/dictionaries'

// Vérification publique d'un document : saisie du code imprimé sous le QR code.
export default async function VerifierPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  const propre = (code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (propre) redirect(`/verifier/${propre}`)
  const locale = await getLocale()
  const t = (await getDictionary(locale)).verification

  return (
    <div className="relative min-h-dvh bg-background px-4 py-12">
      <div className="absolute top-4 end-4"><LanguageSelector currentLang={locale} /></div>
      <div className="mx-auto w-full max-w-md rounded-2xl border border-surface-border bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><ShieldCheck className="h-7 w-7" /></span>
        <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">{t.title}</h1>
        <p className="mt-2 text-sm text-foreground-muted">{t.desc}</p>
        <form action="/verifier" className="mt-6 flex gap-2">
          <label htmlFor="code" className="sr-only">{t.code}</label>
          <input id="code" name="code" required placeholder={t.placeholder} dir="ltr" className={`${inputClass} font-mono uppercase`} />
          <button type="submit" className={btnPrimary}>{t.verifier}</button>
        </form>
      </div>
    </div>
  )
}
