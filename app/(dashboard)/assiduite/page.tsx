import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { anneesEtSelection, un } from '@/lib/scolarite'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'

type Absence = {
  id: string
  date_absence: string
  type: 'absence' | 'retard'
  duree: number
  justifiee: boolean
  motif: string | null
  eleves: { id: string; prenom: string; nom: string } | null
  enseignements: { matieres: { nom: string } | null; classes: { nom: string } | null } | null
}

const LIMITE = 300

export default async function AssiduitePage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  await getCurrentUserContext()
  const sp = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.assiduite
  const s = dict.scolarite

  const { annees, selection } = await anneesEtSelection(supabase, sp.annee)
  const { data } = selection
    ? await supabase
        .from('absences')
        .select('id, date_absence, type, duree, justifiee, motif, eleves(id, prenom, nom), enseignements(matieres(nom), classes(nom))')
        .eq('annee_id', selection.id)
        .order('date_absence', { ascending: false })
        .limit(2000)
    : { data: [] }

  const absences = ((data ?? []) as unknown as Absence[]).map((a) => ({ ...a, eleve: un(a.eleves), en: un(a.enseignements) }))

  // Classement des élèves par heures d'absence (les non justifiées d'abord en cas d'égalité).
  const cumul = new Map<string, { id: string; nom: string; classe: string; heures: number; nj: number }>()
  for (const a of absences) {
    if (a.type !== 'absence' || !a.eleve) continue
    const c = cumul.get(a.eleve.id) ?? { id: a.eleve.id, nom: `${a.eleve.prenom} ${a.eleve.nom}`, classe: un(a.en?.classes)?.nom ?? '', heures: 0, nj: 0 }
    c.heures += Number(a.duree)
    if (!a.justifiee) c.nj += Number(a.duree)
    cumul.set(a.eleve.id, c)
  }
  const classement = [...cumul.values()].sort((a, b) => b.heures - a.heures || b.nj - a.nj).slice(0, 8)
  const date = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={<SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />}
      />
      {absences.length === 0 ? (
        <p className={`${cardClass} px-5 py-10 text-center text-sm text-foreground-muted`}>{t.empty}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <section className={`${cardClass} h-fit`}>
            <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{t.classement}</h2>
            <ol className="divide-y divide-surface-border">
              {classement.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 text-center text-sm font-semibold tabular-nums text-foreground-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/eleves/${c.id}?annee=${selection?.id}`} className="block truncate font-medium text-foreground hover:text-primary">{c.nom}</Link>
                    <p className="text-xs text-foreground-muted">{c.classe} · {fmt(t.totalHeures, { n: c.heures })}</p>
                  </div>
                  {c.nj > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.nj >= 10 ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>{fmt(t.nonJustifiees, { n: c.nj })}</span>}
                </li>
              ))}
            </ol>
          </section>

          <section className={cardClass}>
            <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{fmt(t.derniers, { n: Math.min(LIMITE, absences.length) })}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <tr>
                    <th className="px-4 py-3 text-start">{t.date}</th>
                    <th className="px-4 py-3 text-start">{dict.eleves.eleve}</th>
                    <th className="px-4 py-3 text-start">{t.type}</th>
                    <th className="px-4 py-3 text-start">{t.duree}</th>
                    <th className="px-4 py-3 text-start">{t.justification}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {absences.slice(0, LIMITE).map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-foreground-muted">{date(a.date_absence)}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-foreground">{a.eleve ? `${a.eleve.prenom} ${a.eleve.nom}` : '—'}</span>
                        <span className="block text-xs text-foreground-muted">{[un(a.en?.classes)?.nom, un(a.en?.matieres)?.nom].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="px-4 py-2.5">{t.types[a.type]}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{a.type === 'retard' ? fmt(t.minutes, { n: Number(a.duree) }) : fmt(t.heures, { n: Number(a.duree) })}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.justifiee ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{a.justifiee ? t.justifiee : t.nonJustifiee}</span>
                        {a.motif && <span className="block text-xs text-foreground-muted">{a.motif}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
