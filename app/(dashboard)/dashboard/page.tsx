import Link from 'next/link'
import { ArrowRight, BookOpen, CheckCircle2, Circle, DoorOpen, Layers, Sparkles, Users } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { peutGererParametres } from '@/lib/roles'
import { fmt } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'

export default async function DashboardPage() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.dashboard

  const compter = (table: string, actifs = true) => {
    const q = supabase.from(table).select('id', { count: 'exact', head: true })
    return actifs ? q.eq('actif', true) : q
  }

  const [niveaux, matieres, salles, personnel, annees, coefficients] = await Promise.all([
    compter('niveaux'),
    compter('matieres'),
    compter('salles'),
    compter('utilisateurs'),
    compter('annees_scolaires', false),
    compter('coefficients', false),
  ])

  const n = (r: { count: number | null }) => r.count ?? 0

  const kpis = [
    { label: t.kpiNiveaux, value: n(niveaux), icon: Layers, teinte: 'text-primary bg-primary-soft' },
    { label: t.kpiMatieres, value: n(matieres), icon: BookOpen, teinte: 'text-secondary bg-secondary/12' },
    { label: t.kpiSalles, value: n(salles), icon: DoorOpen, teinte: 'text-info bg-info/10' },
    { label: t.kpiPersonnel, value: n(personnel), icon: Users, teinte: 'text-success bg-success/10' },
  ]

  const etapes = [
    { label: t.stepAnnee, fait: n(annees) > 0, href: '/parametres/annees' },
    { label: t.stepNiveaux, fait: n(niveaux) > 0, href: '/parametres/niveaux' },
    { label: t.stepMatieres, fait: n(matieres) > 0, href: '/parametres/matieres' },
    { label: t.stepCoefficients, fait: n(coefficients) > 0, href: '/parametres/coefficients' },
    { label: t.stepSalles, fait: n(salles) > 0, href: '/parametres/salles' },
    { label: t.stepPersonnel, fait: n(personnel) > 1, href: '/parametres/utilisateurs' },
  ]
  const faites = etapes.filter((e) => e.fait).length
  const peutConfigurer = peutGererParametres(context.role)

  return (
    <div>
      <PageHeader
        title={context.prenom ? fmt(t.greeting, { prenom: context.prenom }) : t.greetingNoName}
        subtitle={fmt(t.subtitle, { etablissement: context.etablissementNom })}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, teinte }, i) => (
          <div key={label} className={`${cardClass} rise-in p-4 sm:p-5`} style={{ '--rise-delay': `${i * 60}ms` } as React.CSSProperties}>
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${teinte}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <p className="mt-4 font-heading text-3xl font-semibold tabular-nums text-foreground">{value}</p>
            <p className="mt-1 text-sm text-foreground-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className={`${cardClass} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">{t.setupTitle}</h2>
              <p className="mt-1 text-sm text-foreground-muted">{t.setupDesc}</p>
            </div>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              {fmt(t.setupProgress, { n: faites, total: etapes.length })}
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(faites / etapes.length) * 100}%` }} />
          </div>

          {faites === etapes.length ? (
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {t.setupDone}
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-surface-border">
              {etapes.map((e) => (
                <li key={e.label} className="flex items-center gap-3 py-3">
                  {e.fait ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Circle className="h-5 w-5 shrink-0 text-foreground-muted/50" />}
                  <span className={`flex-1 text-sm ${e.fait ? 'text-foreground-muted line-through decoration-foreground-muted/40' : 'font-medium text-foreground'}`}>{e.label}</span>
                  {!e.fait && peutConfigurer && (
                    <Link href={e.href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover">
                      {t.configure} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!peutConfigurer && <p className="mt-4 text-xs text-foreground-muted">{t.readOnly}</p>}
        </section>

        <section className="relative overflow-hidden rounded-2xl bg-[var(--sidebar)] p-6 text-white">
          <div aria-hidden className="pointer-events-none absolute -top-20 -end-20 h-56 w-56 rounded-full opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, #5B7FEA, transparent 70%)' }} />
          <Sparkles className="relative h-6 w-6 text-secondary" />
          <h2 className="relative mt-4 font-heading text-lg font-semibold">{t.roadmapTitle}</h2>
          <p className="relative mt-2 text-sm leading-relaxed text-white/70">{t.roadmapText}</p>
        </section>
      </div>
    </div>
  )
}
