import Link from 'next/link'
import { DoorOpen, UserRound, Users } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { anneesEtSelection, un } from '@/lib/scolarite'
import { fmt } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'

type Classe = {
  id: string
  nom: string
  niveaux: { ordre: number; cycle: string } | null
  salles: { nom: string } | null
  enseignants: { civilite: string | null; prenom: string; nom: string } | null
  inscriptions: { count: number }[]
}

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  await getCurrentUserContext()
  const params = await searchParams
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.classes
  const s = dict.scolarite

  const { annees, selection } = await anneesEtSelection(supabase, params.annee)
  const { data } = selection
    ? await supabase
        .from('classes')
        .select('id, nom, niveaux(ordre, cycle), salles(nom), enseignants(civilite, prenom, nom), inscriptions(count)')
        .eq('annee_id', selection.id)
    : { data: [] }

  const classes = ((data ?? []) as unknown as Classe[])
    .map((c) => ({ ...c, niveaux: un(c.niveaux), salles: un(c.salles), enseignants: un(c.enseignants) }))
    .sort((a, b) => (a.niveaux?.ordre ?? 0) - (b.niveaux?.ordre ?? 0) || a.nom.localeCompare(b.nom))

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={<SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />}
      />
      {classes.length === 0 ? (
        <p className={`${cardClass} px-5 py-10 text-center text-sm text-foreground-muted`}>{t.empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <Link key={c.id} href={`/classes/${c.id}`} className={`${cardClass} group p-5 transition hover:border-primary/40 hover:shadow-md`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-xl font-semibold text-foreground group-hover:text-primary">{c.nom}</p>
                  <p className="mt-0.5 text-xs text-foreground-muted">{c.niveaux ? dict.cycles[c.niveaux.cycle as keyof typeof dict.cycles] : ''}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                  <Users className="h-3.5 w-3.5" /> {fmt(t.effectif, { n: c.inscriptions?.[0]?.count ?? 0 })}
                </span>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-foreground-muted">
                <p className="flex items-center gap-2"><UserRound className="h-4 w-4 shrink-0" /> {t.pp} · {c.enseignants ? `${c.enseignants.civilite ?? ''} ${c.enseignants.prenom} ${c.enseignants.nom}`.trim() : '—'}</p>
                <p className="flex items-center gap-2"><DoorOpen className="h-4 w-4 shrink-0" /> {t.salle} · {c.salles?.nom ?? '—'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
