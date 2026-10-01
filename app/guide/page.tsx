import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { getDictionary, getLocale } from '@/dictionaries'

type Item = { t?: string; x: string }
type Bloc =
  | { p: string }
  | { ul: Item[] }
  | { ol: Item[] }
  | { cards: Item[] }
  | { callout: { l: string; x: string } }
  | { dl: Item[] }
  | { table: { head: string[]; rows: string[][] } }
type Section = { id: string; title: string; menu?: string; note?: string; lead?: string; blocks: Bloc[] }
type Partie = { id: string; label: string; title: string; text: string; sections: Section[] }
type Guide = {
  meta: Record<string, string>
  hero: { eyebrow: string; title: string; subtitle: string; intro: string }
  overview: { id: string; title: string; lead: string; cards: Item[] }
  parts: Partie[]
  closing: Section[]
}

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale())
  const g = dict.guide as unknown as Guide
  return { title: `${g.meta.pageTitle} — D-Scholar` }
}

function Texte({ i }: { i: Item }) {
  return (
    <>
      {i.t && <strong className="text-foreground">{i.t} </strong>}
      <span className="text-foreground-muted">{i.x}</span>
    </>
  )
}

function Blocs({ blocs }: { blocs: Bloc[] }) {
  return (
    <>
      {blocs.map((b, n) => {
        if ('p' in b) return <p key={n} className="mt-3 leading-relaxed text-foreground-muted">{b.p}</p>
        if ('ul' in b)
          return (
            <ul key={n} className="mt-4 list-disc space-y-3 ps-6 marker:text-primary">
              {b.ul.map((i, k) => <li key={k}><Texte i={i} /></li>)}
            </ul>
          )
        if ('ol' in b)
          return (
            <ol key={n} className="mt-4 space-y-4">
              {b.ol.map((i, k) => (
                <li key={k} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{k + 1}</span>
                  <p><Texte i={i} /></p>
                </li>
              ))}
            </ol>
          )
        if ('cards' in b)
          return (
            <div key={n} className="mt-5 grid gap-3 sm:grid-cols-2">
              {b.cards.map((i, k) => (
                <div key={k} className="rounded-xl border border-surface-border bg-surface p-4">
                  <h4 className="font-heading font-semibold text-primary">{i.t}</h4>
                  <p className="mt-1 text-sm text-foreground-muted">{i.x}</p>
                </div>
              ))}
            </div>
          )
        if ('callout' in b)
          return (
            <div key={n} className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-warning">{b.callout.l}</p>
              <p className="mt-1 text-sm text-foreground">{b.callout.x}</p>
            </div>
          )
        if ('dl' in b)
          return (
            <dl key={n} className="mt-4 space-y-3">
              {b.dl.map((i, k) => (
                <div key={k}>
                  <dt className="font-semibold text-foreground">{i.t}</dt>
                  <dd className="text-foreground-muted">{i.x}</dd>
                </div>
              ))}
            </dl>
          )
        return (
          <div key={n} className="mt-5 overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="bg-primary-soft">
                  {b.table.head.map((h, k) => <th key={k} className="px-4 py-3 text-start font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {b.table.rows.map((r, k) => (
                  <tr key={k} className="border-t border-surface-border">
                    {r.map((c, j) => <td key={j} className={`px-4 py-3 ${j > 0 ? (c === '✓' ? 'font-bold text-primary' : 'text-foreground-muted') : ''}`}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </>
  )
}

function SectionGuide({ s, g }: { s: Section; g: Guide }) {
  return (
    <section id={s.id} className="mt-12 scroll-mt-24">
      <h2 className="font-heading text-2xl font-bold">{s.title}</h2>
      {(s.menu || s.lead) && (
        <p className="mt-1 text-foreground-muted">
          {s.menu && <>{g.meta.menu} <strong className="text-foreground">{s.menu}</strong>{s.note ? ` — ${s.note}` : ''}</>}
          {s.lead}
        </p>
      )}
      <Blocs blocs={s.blocks} />
    </section>
  )
}

export default async function GuidePage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const g = dict.guide as unknown as Guide

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-surface-border bg-surface/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-foreground-muted hover:text-primary">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {g.meta.back}
          </Link>
          <LanguageSelector currentLang={locale} />
        </div>
      </header>

      <main>
        <section className="border-b border-surface-border bg-primary-soft py-14 lg:py-20">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{g.hero.eyebrow}</p>
            <h1 className="mt-3 font-heading text-4xl font-bold md:text-6xl">{g.hero.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-foreground-muted">{g.hero.subtitle}</p>
            <p className="mt-4 leading-relaxed text-foreground-muted">{g.hero.intro}</p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-6 pb-24">
          <nav aria-label={g.meta.toc} className="mt-10 rounded-2xl border border-surface-border bg-surface p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-foreground-muted">{g.meta.toc}</p>
            <ol className="list-decimal space-y-1 ps-5 marker:text-primary">
              <li><a href={`#${g.overview.id}`} className="font-semibold text-primary hover:underline">{g.overview.title}</a></li>
              {g.parts.map((p) => (
                <li key={p.id}>
                  <a href={`#${p.id}`} className="font-bold text-foreground hover:text-primary">{p.label} — {p.title}</a>
                  <ol className="list-[lower-alpha] ps-5 marker:text-foreground-muted">
                    {p.sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-primary hover:underline">{s.title}</a></li>)}
                  </ol>
                </li>
              ))}
              {g.closing.map((s) => <li key={s.id}><a href={`#${s.id}`} className="font-semibold text-primary hover:underline">{s.title}</a></li>)}
            </ol>
          </nav>

          <section id={g.overview.id} className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold">{g.overview.title}</h2>
            <p className="mt-1 text-foreground-muted">{g.overview.lead}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {g.overview.cards.map((c, k) => (
                <div key={k} className="rounded-xl border border-surface-border bg-surface p-4">
                  <h4 className="font-heading font-semibold text-primary"><span className="me-2 text-secondary">{k + 1}</span>{c.t}</h4>
                  <p className="mt-1 text-sm text-foreground-muted">{c.x}</p>
                </div>
              ))}
            </div>
          </section>

          {g.parts.map((p) => (
            <div key={p.id}>
              <div id={p.id} className="mt-14 scroll-mt-24 rounded-2xl bg-primary px-6 py-5 text-primary-foreground">
                <p className="text-xs font-bold uppercase tracking-widest opacity-85">{p.label}</p>
                <h2 className="mt-1 font-heading text-2xl font-bold md:text-3xl">{p.title}</h2>
                <p className="mt-1 opacity-90">{p.text}</p>
              </div>
              {p.sections.map((s) => <SectionGuide key={s.id} s={s} g={g} />)}
            </div>
          ))}

          {g.closing.map((s) => <SectionGuide key={s.id} s={s} g={g} />)}

          <div className="mt-16 text-center">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {g.meta.back}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
