import Link from 'next/link'
import { Layers, Mail, Phone, UserCheck } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { anneesEtSelection, un } from '@/lib/scolarite'
import { fmt } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'

type Enseignement = {
  classe_id: string
  matiere_id: string
  matieres: { nom: string; couleur: string } | null
  classes: { nom: string; annee_id: string; niveau_id: string; serie_id: string | null } | null
}

export default async function EnseignantsPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  await getCurrentUserContext()
  const params = await searchParams
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.enseignants
  const s = dict.scolarite

  const { annees, selection } = await anneesEtSelection(supabase, params.annee)
  const [{ data: enseignants }, { data: coefs }] = await Promise.all([
    supabase
      .from('enseignants')
      .select('id, civilite, prenom, nom, telephone, email, statut, utilisateur_id, enseignements(classe_id, matiere_id, matieres(nom, couleur), classes(nom, annee_id, niveau_id, serie_id))')
      .eq('actif', true)
      .order('nom'),
    supabase.from('coefficients').select('niveau_id, serie_id, matiere_id, volume_horaire'),
  ])

  const volume = (e: Enseignement) => {
    const c = un(e.classes)
    const ligne =
      (coefs ?? []).find((x) => x.niveau_id === c?.niveau_id && x.matiere_id === e.matiere_id && x.serie_id === c?.serie_id) ??
      (coefs ?? []).find((x) => x.niveau_id === c?.niveau_id && x.matiere_id === e.matiere_id && x.serie_id === null)
    return Number(ligne?.volume_horaire ?? 0)
  }

  const cartes = (enseignants ?? []).map((ens) => {
    const cours = ((ens.enseignements ?? []) as unknown as Enseignement[]).filter((e) => un(e.classes)?.annee_id === selection?.id)
    const matieres = new Map<string, { nom: string; couleur: string }>()
    for (const c of cours) {
      const m = un(c.matieres)
      if (m) matieres.set(c.matiere_id, m)
    }
    return {
      ...ens,
      matieres: [...matieres.values()],
      classes: [...new Set(cours.map((c) => un(c.classes)?.nom).filter(Boolean))] as string[],
      heures: cours.reduce((total, c) => total + volume(c), 0),
    }
  })

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={<SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />}
      />
      {cartes.length === 0 ? (
        <p className={`${cardClass} px-5 py-10 text-center text-sm text-foreground-muted`}>{t.empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cartes.map((e) => (
            <Link key={e.id} href={`/enseignants/${e.id}${selection ? `?annee=${selection.id}` : ''}`} className={`${cardClass} group flex flex-col p-5 transition hover:border-primary/40 hover:shadow-md`}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{e.prenom[0]}{e.nom[0]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading font-semibold text-foreground group-hover:text-primary">{`${e.civilite ?? ''} ${e.prenom} ${e.nom}`.trim()}</p>
                  <p className="text-xs text-foreground-muted">
                    {t.statuts[e.statut as 'titulaire' | 'vacataire']}
                    {e.utilisateur_id && <span className="ms-2 inline-flex items-center gap-1 text-success"><UserCheck className="h-3 w-3" /> {t.compte}</span>}
                  </p>
                </div>
                {e.matieres.length > 1 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[0.68rem] font-semibold text-secondary">
                    <Layers className="h-3 w-3" /> {t.multi}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {e.matieres.map((m) => (
                  <span key={m.nom} className="inline-flex items-center gap-1.5 rounded-full border border-surface-border px-2.5 py-0.5 text-xs text-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: m.couleur }} /> {m.nom}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-foreground-muted">{t.classes} · {e.classes.join(', ') || '—'}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-foreground-muted">
                <span className="font-semibold text-foreground">{fmt(t.heures, { h: e.heures })}</span>
                {e.telephone && <span className="flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3" /> {e.telephone}</span>}
                {e.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" /> {e.email}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
