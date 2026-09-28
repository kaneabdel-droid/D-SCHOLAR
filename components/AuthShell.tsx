import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import type { Dictionary } from '@/dictionaries'

type CleMessage = keyof Dictionary['auth']['messages']

// Messages passés dans l'URL sous forme de code (?message=identifiants) pour être
// affichés dans la langue de l'utilisateur ; les messages de succès sont en vert.
const SUCCES: CleMessage[] = ['mail', 'mdpOk']

export default function AuthShell({
  dict,
  locale,
  title,
  desc,
  message,
  children,
}: {
  dict: Dictionary
  locale: string
  title: string
  desc: string
  message?: string
  children: React.ReactNode
}) {
  const messages = dict.auth.messages
  const cle = message && message in messages ? (message as CleMessage) : null

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[var(--sidebar)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -end-32 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #5B7FEA, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -start-24 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #C9972B, transparent 70%)' }}
        />
        <Link href="/" className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-heading text-xl font-semibold tracking-wide">D-Scholar</span>
        </Link>
        <div className="relative max-w-md">
          <h2 className="font-heading text-4xl font-semibold leading-tight">{dict.auth.login.panelTitle}</h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">{dict.auth.login.panelText}</p>
        </div>
        <p className="relative text-sm text-white/50">{dict.landing.footer}</p>
      </aside>

      <main className="relative flex flex-col justify-center bg-background px-4 py-12 sm:px-8">
        <div className="absolute top-4 end-4">
          <LanguageSelector currentLang={locale} />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-heading text-lg font-semibold text-foreground">D-Scholar</span>
          </Link>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-foreground-muted">{desc}</p>

          {cle && (
            <div
              className={`mt-6 rounded-lg border px-4 py-3 text-sm font-medium ${
                SUCCES.includes(cle) ? 'border-success/25 bg-success/10 text-success' : 'border-danger/25 bg-danger/10 text-danger'
              }`}
            >
              {messages[cle]}
            </div>
          )}

          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
