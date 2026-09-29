import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import EmploiGrid from '@/components/EmploiGrid'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { chargerCreneaux } from '@/lib/emploi'
import { appreciationPour, baremeAppreciations, libellePeriode, moyenneLisible, TEINTES_APPRECIATION, TEINTES_DECISION, un } from '@/lib/scolarite'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import { peutEcrire } from '@/lib/roles'
import { referentielClasse } from '@/lib/referentiel'
import { enseignementsDeLaClasse } from '@/lib/emploi'
import { ClasseFormButton, EmploiEditor, EnseignementsEditor, SupprimerClasseButton } from '../ClasseOutils'
import ImprimerBulletins from '../ImprimerBulletins'

const VUES = ['eleves', 'bulletin', 'enseignements', 'emploi'] as const
type Vue = (typeof VUES)[number]

export default async function ClassePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vue?: string; periode?: string }> }) {
  const context = await getCurrentUserContext()
  const { id } = await params
  const sp = await searchParams
  const vue: Vue = (VUES as readonly string[]).includes(sp.vue ?? '') ? (sp.vue as Vue) : 'bulletin'
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.classes
  const s = dict.scolarite

  const { data: classe } = await supabase
    .from('classes')
    .select('id, nom, annee_id, niveau_id, serie_id, capacite, salle_id, professeur_principal_id, annees_scolaires(libelle), salles(nom), enseignants(civilite, prenom, nom)')
    .eq('id', id)
    .maybeSingle()
  if (!classe) notFound()
  const pp = un(classe.enseignants)
  const gestion = peutEcrire(context.role, 'organisation')
  const referentiel = gestion ? await referentielClasse(supabase) : null

  const [{ data: inscriptions }, { data: periodesBrutes }] = await Promise.all([
    supabase.from('inscriptions').select('id, statut, eleves(id, prenom, nom, matricule, sexe, statut), decisions(decision_finale)').eq('classe_id', id),
    // Périodes du découpage du cycle de la classe (trimestres ou semestres).
    supabase.rpc('periodes_classe', { p_classe_id: id }),
  ])
  const periodes = (periodesBrutes ?? []) as { id: string; rang: number; decoupage: 'trimestre' | 'semestre'; verrouillee: boolean }[]
  const eleves = (inscriptions ?? [])
    .map((i) => ({ ...i, eleve: un(i.eleves as unknown as { id: string; prenom: string; nom: string; matricule: string; sexe: 'M' | 'F'; statut: string }), decision: un(i.decisions as unknown as { decision_finale: string | null }) }))
    .filter((i) => i.eleve)
    .sort((a, b) => a.eleve!.nom.localeCompare(b.eleve!.nom) || a.eleve!.prenom.localeCompare(b.eleve!.prenom))
  const nomEleve = new Map(eleves.map((e) => [e.eleve!.id, `${e.eleve!.prenom} ${e.eleve!.nom}`]))

  const onglet = (v: Vue) => (
    <Link
      key={v}
      href={`/classes/${id}?vue=${v}`}
      className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${vue === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground-muted hover:bg-primary-soft hover:text-foreground'}`}
    >
      {t.tabs[v]}
    </Link>
  )

  let contenu: React.ReactNode = null

  if (vue === 'eleves') {
    contenu = (
      <ul className="divide-y divide-surface-border">
        {eleves.map((e) => (
          <li key={e.id}>
            <Link href={`/eleves/${e.eleve!.id}?annee=${classe.annee_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-background/60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{e.eleve!.prenom[0]}{e.eleve!.nom[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{e.eleve!.prenom} {e.eleve!.nom}</p>
                <p className="text-xs text-foreground-muted">{e.eleve!.matricule} · {s.sexe[e.eleve!.sexe]} · {s.statutsInscription[e.statut as keyof typeof s.statutsInscription]}</p>
              </div>
              {e.eleve!.statut === 'sorti' && <span className="rounded-full bg-foreground-muted/10 px-2 py-0.5 text-xs text-foreground-muted">{s.sorti}</span>}
              {e.decision?.decision_finale && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_DECISION[e.decision.decision_finale]}`}>{s.decisions[e.decision.decision_finale as keyof typeof s.decisions]}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  if (vue === 'bulletin') {
    // Période choisie (trimestre) ou bilan annuel ; calculs SQL (moyennes pondérées
    // par type d'évaluation puis par coefficient, cf. 06_pedagogie.sql).
    const periode = (periodes ?? []).find((p) => p.id === sp.periode) ?? null
    const annuel = !periode
    const [bareme, { data: etab }, { data: matieres }, generales, detail] = await Promise.all([
      baremeAppreciations(supabase),
      supabase.from('etablissements').select('moyenne_passage').eq('id', context.etablissementId).single(),
      supabase.from('matieres').select('id, code, couleur'),
      annuel
        ? supabase.rpc('moyennes_annuelles', { p_classe_id: id })
        : supabase.rpc('moyennes_periode', { p_classe_id: id, p_periode_id: periode.id }),
      annuel ? Promise.resolve({ data: [] }) : supabase.rpc('moyennes_matieres', { p_classe_id: id, p_periode_id: periode.id }),
    ])
    const lignes = ((generales.data ?? []) as { eleve_id: string; moyenne: number; rang: number }[]).sort((a, b) => a.rang - b.rang)
    const parMatiere = new Map<string, Map<string, number>>()
    for (const m of (detail.data ?? []) as { eleve_id: string; matiere_id: string; moyenne: number }[]) {
      if (!parMatiere.has(m.matiere_id)) parMatiere.set(m.matiere_id, new Map())
      parMatiere.get(m.matiere_id)!.set(m.eleve_id, Number(m.moyenne))
    }
    const colonnes = (matieres ?? []).filter((m) => parMatiere.has(m.id))
    const moyennes = lignes.map((l) => Number(l.moyenne))
    const seuil = Number(etab?.moyenne_passage ?? 10)
    const stats = moyennes.length
      ? [
          { label: t.moyenneClasse, valeur: moyenneLisible(moyennes.reduce((a, b) => a + b, 0) / moyennes.length, loc) },
          { label: t.plusHaute, valeur: moyenneLisible(Math.max(...moyennes), loc) },
          { label: t.plusBasse, valeur: moyenneLisible(Math.min(...moyennes), loc) },
          { label: fmt(t.reussite, { seuil: moyenneLisible(seuil, loc) }), valeur: `${Math.round((moyennes.filter((m) => m >= seuil).length / moyennes.length) * 100)} %` },
        ]
      : []

    contenu = (
      <div>
        <div className="flex gap-1 overflow-x-auto border-b border-surface-border px-5 py-3">
          {(periodes ?? []).map((p) => (
            <Link key={p.id} href={`/classes/${id}?vue=bulletin&periode=${p.id}`} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${periode?.id === p.id ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground-muted hover:text-foreground'}`}>
              {libellePeriode(dict.annees, p)}
            </Link>
          ))}
          <Link href={`/classes/${id}?vue=bulletin`} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${annuel ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground-muted hover:text-foreground'}`}>
            {s.annuel}
          </Link>
          <div className="ms-auto">
            <ImprimerBulletins classeId={id} periodeId={periode?.id ?? null} locale={loc} lang={locale} dict={dict} />
          </div>
        </div>
        {lignes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-foreground-muted">{t.aucuneNote}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 border-b border-surface-border p-5 lg:grid-cols-4">
              {stats.map((st) => (
                <div key={st.label} className="rounded-xl bg-background px-4 py-3">
                  <p className="text-xs text-foreground-muted">{st.label}</p>
                  <p className="mt-1 font-heading text-xl font-semibold tabular-nums text-foreground">{st.valeur}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <tr>
                    <th className="px-4 py-3 text-center">{t.rangCol}</th>
                    <th className="px-4 py-3 text-start">{dict.eleves.eleve}</th>
                    {colonnes.map((m) => (
                      <th key={m.id} className="px-2 py-3 text-center" title={m.code}>
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: m.couleur }} />{m.code}</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center">{t.moyenne}</th>
                    <th className="px-4 py-3 text-start">{dict.eleves.appreciation}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {lignes.map((l) => {
                    const a = appreciationPour(bareme, Number(l.moyenne))
                    return (
                      <tr key={l.eleve_id} className="hover:bg-background/60">
                        <td className="px-4 py-2.5 text-center font-semibold tabular-nums">{l.rang}</td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <Link href={`/eleves/${l.eleve_id}?annee=${classe.annee_id}`} className="font-medium text-foreground hover:text-primary">{nomEleve.get(l.eleve_id) ?? '—'}</Link>
                        </td>
                        {colonnes.map((m) => {
                          const v = parMatiere.get(m.id)?.get(l.eleve_id)
                          return <td key={m.id} className={`px-2 py-2.5 text-center tabular-nums ${v !== undefined && v < 10 ? 'text-danger' : 'text-foreground-muted'}`}>{v === undefined ? '—' : moyenneLisible(v, loc)}</td>
                        })}
                        <td className={`px-4 py-2.5 text-center font-semibold tabular-nums ${Number(l.moyenne) < seuil ? 'text-danger' : 'text-foreground'}`}>{moyenneLisible(l.moyenne, loc)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {a && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_APPRECIATION[a.categorie]}`}>{a.libelle}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    )
  }

  if (vue === 'enseignements') {
    const [{ data: ens }, { data: coefs }] = await Promise.all([
      supabase.from('enseignements').select('id, matiere_id, matieres(nom, couleur), enseignants(id, civilite, prenom, nom)').eq('classe_id', id),
      supabase.from('coefficients').select('matiere_id, serie_id, coefficient, volume_horaire').eq('niveau_id', classe.niveau_id),
    ])
    const coefDe = (mid: string) =>
      (coefs ?? []).find((c) => c.matiere_id === mid && c.serie_id === classe.serie_id) ?? (coefs ?? []).find((c) => c.matiere_id === mid && c.serie_id === null)
    const lignes = (ens ?? [])
      .map((e) => ({ ...e, matiere: un(e.matieres as unknown as { nom: string; couleur: string }), prof: un(e.enseignants as unknown as { id: string; civilite: string | null; prenom: string; nom: string }), coef: coefDe(e.matiere_id) }))
      .sort((a, b) => Number(b.coef?.coefficient ?? 0) - Number(a.coef?.coefficient ?? 0))
    contenu = gestion ? (
      <EnseignementsEditor
        classeId={id}
        lignes={lignes.map((l) => ({
          id: l.id,
          matiere: l.matiere?.nom ?? '—',
          couleur: l.matiere?.couleur ?? '#94A3B8',
          coef: String(l.coef?.coefficient ?? '—'),
          volume: String(l.coef?.volume_horaire ?? '—'),
          enseignantId: l.prof?.id ?? null,
        }))}
        enseignants={referentiel!.enseignants}
        dict={dict}
      />
    ) : (
      <ul className="divide-y divide-surface-border">
        {lignes.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: l.matiere?.couleur }} />
            <span className="min-w-40 flex-1 font-medium text-foreground">{l.matiere?.nom}</span>
            <span className="text-sm text-foreground-muted">{dict.eleves.coef} {l.coef?.coefficient ?? '—'} · {fmt(t.heuresSemaine, { h: l.coef?.volume_horaire ?? '—' })}</span>
            {l.prof ? (
              <Link href={`/enseignants/${l.prof.id}`} className="text-sm font-medium text-primary hover:text-primary-hover">{`${l.prof.civilite ?? ''} ${l.prof.prenom} ${l.prof.nom}`.trim()}</Link>
            ) : (
              <span className="text-sm text-foreground-muted">{t.nonAffecte}</span>
            )}
          </li>
        ))}
      </ul>
    )
  }

  if (vue === 'emploi') {
    const creneaux = await chargerCreneaux(supabase, { classeId: id })
    contenu = (
      <>
        <EmploiGrid creneaux={creneaux} jours={s.jours} vide={dict.emplois.vide} />
        {gestion && (
          <EmploiEditor
            enseignements={await enseignementsDeLaClasse(supabase, id)}
            salles={referentiel!.salles}
            creneaux={creneaux}
            dict={dict}
          />
        )}
      </>
    )
  }

  return (
    <div className="space-y-5">
      <Link href={`/classes?annee=${classe.annee_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-foreground-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t.retour}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">{classe.nom}</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {un(classe.annees_scolaires as unknown as { libelle: string })?.libelle} · {fmt(t.effectif, { n: eleves.length })} · {t.pp} {pp ? `${pp.civilite ?? ''} ${pp.prenom} ${pp.nom}`.trim() : '—'} · {t.salle} {un(classe.salles as unknown as { nom: string })?.nom ?? '—'}
        </p>
        </div>
        {gestion && (
          <div className="flex gap-2">
            <ClasseFormButton
              classeId={id}
              valeurs={{ nom: classe.nom, niveau_id: classe.niveau_id, serie_id: classe.serie_id, capacite: classe.capacite, salle_id: classe.salle_id, professeur_principal_id: classe.professeur_principal_id }}
              referentiel={referentiel!}
              dict={dict}
            />
            {eleves.length === 0 && <SupprimerClasseButton classeId={id} nom={classe.nom} dict={dict} />}
          </div>
        )}
      </div>
      <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-xl border border-surface-border bg-surface p-1 shadow-xs">{VUES.map(onglet)}</div>
      </nav>
      <section className={cardClass}>{contenu}</section>
    </div>
  )
}
