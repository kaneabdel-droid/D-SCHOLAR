import { BarresHorizontales } from '@/components/groupe/Barres'
import { createClient } from '@/utils/supabase/server'
import { getGroupeContext } from '@/lib/auth/getGroupeContext'
import { consolider, indicateursGroupe, pct, type Indicateurs } from '@/lib/groupe'
import { intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import { SelecteurLibelle } from '../GroupeNav'
import { formats } from '../format'

type Mesure = {
  cle: string
  libelle: string
  valeur: (i: Indicateurs) => number | null
  groupe: number | null
  affichage: (v: number | null) => string
  // Sens de la meilleure valeur (plus haut ou plus bas), null = neutre.
  sens: 'haut' | 'bas' | null
}

// Comparatifs entre établissements : tableau complet (meilleur ▲ / plus faible ▼)
// puis les indicateurs clés en barres.
export default async function GroupeComparatifs({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const groupe = await getGroupeContext()
  const { annee } = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.groupe
  const m = t.mesures
  const f = formats(loc, dict.abonnement.fcfa)
  const un1 = (v: number | null) => (v === null ? '—' : v.toLocaleString(loc, { maximumFractionDigits: 1 }))

  const { indicateurs, libelles, libelle } = await indicateursGroupe(supabase, groupe.sites, annee ?? null)
  const g = consolider(indicateurs)
  const ratio = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10) / 10 : null)

  const mesures: { section: string; lignes: Mesure[] }[] = [
    {
      section: t.sections.effectifs,
      lignes: [
        { cle: 'effectif', libelle: m.effectif, valeur: (i) => i.effectif, groupe: g.effectif, affichage: (v) => (v === null ? '—' : f.nombre(v)), sens: null },
        { cle: 'filles', libelle: m.filles, valeur: (i) => pct(i.filles, i.effectif), groupe: pct(g.filles, g.effectif), affichage: f.taux, sens: null },
        { cle: 'nouveaux', libelle: m.nouveaux, valeur: (i) => i.nouveaux, groupe: g.nouveaux, affichage: (v) => (v === null ? '—' : f.nombre(v)), sens: 'haut' },
        { cle: 'classes', libelle: m.classes, valeur: (i) => i.classes, groupe: g.classes, affichage: (v) => (v === null ? '—' : f.nombre(v)), sens: null },
        { cle: 'parClasse', libelle: m.parClasse, valeur: (i) => ratio(i.effectif, i.classes), groupe: ratio(g.effectif, g.classes), affichage: un1, sens: null },
        { cle: 'enseignants', libelle: m.enseignants, valeur: (i) => i.enseignants, groupe: g.enseignants, affichage: (v) => (v === null ? '—' : f.nombre(v)), sens: null },
        { cle: 'parEnseignant', libelle: m.parEnseignant, valeur: (i) => ratio(i.effectif, i.enseignants), groupe: ratio(g.effectif, g.enseignants), affichage: un1, sens: null },
      ],
    },
    {
      section: t.sections.resultats,
      lignes: [
        { cle: 'admission', libelle: m.admission, valeur: (i) => (i.resultats ? pct(i.resultats.admis, i.resultats.decisions) : null), groupe: pct(g.admis, g.decisions), affichage: f.taux, sens: 'haut' },
        { cle: 'redoublement', libelle: m.redoublement, valeur: (i) => (i.resultats ? pct(i.resultats.redoublent, i.resultats.decisions) : null), groupe: null, affichage: f.taux, sens: 'bas' },
        { cle: 'moyenne', libelle: m.moyenne, valeur: (i) => i.resultats?.moyenne ?? null, groupe: g.moyenne, affichage: f.moyenne, sens: 'haut' },
        ...(['CFEE', 'BFEM', 'BAC'] as const).map((x): Mesure => ({
          cle: x,
          libelle: `${m.reussite} ${x}`,
          valeur: (i) => { const e = i.examens.find((y) => y.examen === x); return e ? pct(e.admis, e.presentes) : null },
          groupe: (() => { const e = indicateurs.flatMap((i) => i.examens.filter((y) => y.examen === x)); const p = e.reduce((s, y) => s + y.presentes, 0); return p ? pct(e.reduce((s, y) => s + y.admis, 0), p) : null })(),
          affichage: f.taux,
          sens: 'haut',
        })),
      ],
    },
    {
      section: t.sections.assiduite,
      lignes: [
        { cle: 'hnj', libelle: m.heuresNJ, valeur: (i) => ratio(i.assiduite.heuresNJ, i.effectif), groupe: ratio(g.heuresNJ, g.effectif), affichage: un1, sens: 'bas' },
        { cle: 'retards', libelle: m.retards, valeur: (i) => ratio(i.assiduite.retards, i.effectif), groupe: null, affichage: un1, sens: 'bas' },
        { cle: 'billets', libelle: m.billets, valeur: (i) => i.billets, groupe: null, affichage: (v) => (v === null ? '—' : f.nombre(v)), sens: null },
      ],
    },
    {
      section: t.sections.finances,
      lignes: [
        { cle: 'du', libelle: m.du, valeur: (i) => i.finances.du, groupe: g.du, affichage: (v) => (v === null ? '—' : f.montant(v)), sens: null },
        { cle: 'paye', libelle: m.paye, valeur: (i) => i.finances.paye, groupe: g.paye, affichage: (v) => (v === null ? '—' : f.montant(v)), sens: 'haut' },
        { cle: 'recouvrement', libelle: m.recouvrement, valeur: (i) => pct(i.finances.paye, i.finances.du), groupe: pct(g.paye, g.du), affichage: f.taux, sens: 'haut' },
        { cle: 'reste', libelle: m.reste, valeur: (i) => i.finances.reste, groupe: g.reste, affichage: (v) => (v === null ? '—' : f.montant(v)), sens: 'bas' },
        { cle: 'retard', libelle: m.elevesEnRetard, valeur: (i) => pct(i.finances.elevesEnRetard, i.effectif), groupe: pct(g.elevesEnRetard, g.effectif), affichage: f.taux, sens: 'bas' },
        { cle: 'recetteEleve', libelle: m.recetteParEleve, valeur: (i) => (i.effectif ? Math.round(i.finances.paye / i.effectif) : null), groupe: g.effectif ? Math.round(g.paye / g.effectif) : null, affichage: (v) => (v === null ? '—' : f.montant(v)), sens: null },
      ],
    },
    {
      section: t.sections.admissions,
      lignes: [
        { cle: 'candidatures', libelle: m.candidatures, valeur: (i) => Object.values(i.admissions).reduce((s, n) => s + n, 0), groupe: null, affichage: (v) => (v === null ? '—' : f.nombre(v)), sens: null },
        { cle: 'inscrites', libelle: m.candidatsInscrits, valeur: (i) => i.admissions.inscrite ?? 0, groupe: null, affichage: (v) => (v === null ? '—' : f.nombre(v)), sens: 'haut' },
      ],
    },
  ]

  const extremes = (ms: Mesure) => {
    const vals = indicateurs.map((i) => ms.valeur(i)).filter((v): v is number => v !== null)
    if (!ms.sens || vals.length < 2 || Math.max(...vals) === Math.min(...vals)) return { meilleur: null, faible: null }
    return ms.sens === 'haut' ? { meilleur: Math.max(...vals), faible: Math.min(...vals) } : { meilleur: Math.min(...vals), faible: Math.max(...vals) }
  }
  const barre = (titre: string, valeur: (i: Indicateurs) => number | null, affichage: (v: number | null) => string, meilleurBas = false) => (
    <BarresHorizontales
      titre={titre}
      vide={t.aucuneDonnee}
      meilleurBas={meilleurBas}
      lignes={indicateurs.map((i) => ({ cle: i.site.id, libelle: i.site.nom, valeur: valeur(i), affichage: affichage(valeur(i)) }))}
    />
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{t.comparatifsTitre}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{t.comparatifsSousTitre}</p>
        </div>
        <SelecteurLibelle libelles={libelles} choisi={libelle} etiquette={dict.scolarite.annee} />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {barre(m.effectif, (i) => i.effectif, (v) => (v === null ? '—' : f.nombre(v)))}
        {barre(m.recouvrement, (i) => pct(i.finances.paye, i.finances.du), f.taux)}
        {barre(m.admission, (i) => (i.resultats ? pct(i.resultats.admis, i.resultats.decisions) : null), f.taux)}
        {barre(m.moyenne, (i) => i.resultats?.moyenne ?? null, f.moyenne)}
        {barre(m.heuresNJ, (i) => ratio(i.assiduite.heuresNJ, i.effectif), un1, true)}
        {barre(m.recetteParEleve, (i) => (i.effectif ? Math.round(i.finances.paye / i.effectif) : null), (v) => (v === null ? '—' : f.compact(v)))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="sticky start-0 bg-surface px-4 py-3 text-start">{t.indicateur}</th>
                {indicateurs.map((i) => <th key={i.site.id} className="whitespace-nowrap px-4 py-3 text-end">{i.site.nom}</th>)}
                <th className="whitespace-nowrap bg-primary-soft/60 px-4 py-3 text-end text-primary">{t.groupe}</th>
              </tr>
            </thead>
            <tbody>
              {mesures.map((s) => [
                <tr key={s.section} className="border-t border-surface-border bg-background/60">
                  <td colSpan={indicateurs.length + 2} className="sticky start-0 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{s.section}</td>
                </tr>,
                ...s.lignes.map((ms) => {
                  const { meilleur, faible } = extremes(ms)
                  return (
                    <tr key={ms.cle} className="border-t border-surface-border">
                      <td className="sticky start-0 whitespace-nowrap bg-surface px-4 py-2.5 text-foreground">{ms.libelle}</td>
                      {indicateurs.map((i) => {
                        const v = ms.valeur(i)
                        const top = v !== null && v === meilleur
                        const bas = v !== null && v === faible
                        return (
                          <td key={i.site.id} className={`whitespace-nowrap px-4 py-2.5 text-end tabular-nums ${top ? 'font-semibold text-success' : bas ? 'text-danger' : 'text-foreground'}`}>
                            {ms.affichage(v)} {top && <span aria-label={t.meilleur} title={t.meilleur}>▲</span>}{bas && <span aria-label={t.plusFaible} title={t.plusFaible}>▼</span>}
                          </td>
                        )
                      })}
                      <td className="whitespace-nowrap bg-primary-soft/30 px-4 py-2.5 text-end font-medium tabular-nums text-foreground">{ms.affichage(ms.groupe)}</td>
                    </tr>
                  )
                }),
              ])}
            </tbody>
          </table>
        </div>
        <p className="border-t border-surface-border px-4 py-3 text-xs text-foreground-muted">{t.legendeComparatifs}</p>
      </section>
    </div>
  )
}
