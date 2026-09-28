import Link from 'next/link'
import { Search } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass, inputClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { anneesEtSelection, TEINTES_DECISION, un } from '@/lib/scolarite'
import { fmt } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'

type Ligne = {
  id: string
  statut: string
  eleves: { id: string; matricule: string; prenom: string; nom: string; sexe: 'M' | 'F'; statut: string } | null
  classes: { id: string; nom: string } | null
  decisions: { decision_finale: string | null } | null
}

export default async function ElevesPage({ searchParams }: { searchParams: Promise<{ annee?: string; q?: string; classe?: string }> }) {
  await getCurrentUserContext()
  const params = await searchParams
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.eleves
  const s = dict.scolarite

  const { annees, selection } = await anneesEtSelection(supabase, params.annee)
  const [{ data: classes }, { data: brut }] = selection
    ? await Promise.all([
        supabase.from('classes').select('id, nom').eq('annee_id', selection.id).order('nom'),
        supabase
          .from('inscriptions')
          .select('id, statut, eleves(id, matricule, prenom, nom, sexe, statut), classes(id, nom), decisions(decision_finale)')
          .eq('annee_id', selection.id),
      ])
    : [{ data: [] }, { data: [] }]

  const q = (params.q ?? '').trim().toLowerCase()
  const lignes = ((brut ?? []) as unknown as Ligne[])
    .map((l) => ({ ...l, eleves: un(l.eleves), classes: un(l.classes), decisions: un(l.decisions) }))
    .filter((l) => l.eleves && (!params.classe || l.classes?.id === params.classe))
    .filter((l) => !q || `${l.eleves!.prenom} ${l.eleves!.nom} ${l.eleves!.matricule}`.toLowerCase().includes(q))
    .sort((a, b) => (a.classes?.nom ?? '').localeCompare(b.classes?.nom ?? '') || a.eleves!.nom.localeCompare(b.eleves!.nom))

  const lien = (id: string) => `/eleves/${id}${selection ? `?annee=${selection.id}` : ''}`

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={<SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />}
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row">
        {selection && <input type="hidden" name="annee" value={selection.id} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.recherche} className={`${inputClass} mt-0 ps-9`} />
        </div>
        <select name="classe" defaultValue={params.classe ?? ''} className={`${inputClass} mt-0 sm:w-56`}>
          <option value="">{t.toutesClasses}</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
        <button type="submit" aria-label={t.recherche} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Search className="h-4 w-4" />
        </button>
      </form>

      <section className={cardClass}>
        <p className="border-b border-surface-border px-5 py-3 text-sm text-foreground-muted">{fmt(t.effectif, { n: lignes.length })}</p>
        {lignes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-foreground-muted">{t.empty}</p>
        ) : (
          <>
            <ul className="divide-y divide-surface-border sm:hidden">
              {lignes.map((l) => (
                <li key={l.id}>
                  <Link href={lien(l.eleves!.id)} className="flex items-center gap-3 px-5 py-3 hover:bg-background/60">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                      {l.eleves!.prenom[0]}{l.eleves!.nom[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{l.eleves!.prenom} {l.eleves!.nom}</p>
                      <p className="text-xs text-foreground-muted">{l.classes?.nom} · {s.statutsInscription[l.statut as keyof typeof s.statutsInscription]}</p>
                    </div>
                    {l.decisions?.decision_finale && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_DECISION[l.decisions.decision_finale]}`}>
                        {s.decisions[l.decisions.decision_finale as keyof typeof s.decisions]}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full text-sm">
                <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <tr>
                    <th className="px-5 py-3 text-start">{t.matricule}</th>
                    <th className="px-5 py-3 text-start">{t.eleve}</th>
                    <th className="px-5 py-3 text-start">{t.classe}</th>
                    <th className="px-5 py-3 text-start">{t.inscription}</th>
                    <th className="px-5 py-3 text-start">{t.decision}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {lignes.map((l) => (
                    <tr key={l.id} className="hover:bg-background/60">
                      <td className="px-5 py-3 font-mono text-xs text-foreground-muted">{l.eleves!.matricule}</td>
                      <td className="px-5 py-3">
                        <Link href={lien(l.eleves!.id)} className="font-medium text-foreground hover:text-primary">{l.eleves!.prenom} {l.eleves!.nom}</Link>
                        <span className="ms-2 text-xs text-foreground-muted">{s.sexe[l.eleves!.sexe]}</span>
                        {l.eleves!.statut === 'sorti' && <span className="ms-2 rounded-full bg-foreground-muted/10 px-2 py-0.5 text-xs text-foreground-muted">{s.sorti}</span>}
                      </td>
                      <td className="px-5 py-3 text-foreground-muted">{l.classes?.nom}</td>
                      <td className="px-5 py-3 text-foreground-muted">{s.statutsInscription[l.statut as keyof typeof s.statutsInscription]}</td>
                      <td className="px-5 py-3">
                        {l.decisions?.decision_finale ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_DECISION[l.decisions.decision_finale]}`}>
                            {s.decisions[l.decisions.decision_finale as keyof typeof s.decisions]}
                          </span>
                        ) : (
                          <span className="text-foreground-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
