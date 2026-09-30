import { BarresHorizontales, ColonnesMois, Tuile } from '@/components/groupe/Barres'
import { createClient } from '@/utils/supabase/server'
import { getGroupeContext } from '@/lib/auth/getGroupeContext'
import { MODES_PAIEMENT } from '@/lib/finances'
import { consolider, indicateursGroupe, pct } from '@/lib/groupe'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import { SelecteurLibelle } from '../GroupeNav'
import { formats } from '../format'
import RapportActions, { type Tableau } from './RapportActions'

// Rapport financier du groupe : attendu, encaissé, reste par site, encaissements
// mensuels (site × mois), répartition par mode de paiement. Imprimable et exportable.
export default async function GroupeFinances({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const groupe = await getGroupeContext()
  const { annee } = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.groupe
  const f = formats(loc, dict.abonnement.fcfa)
  const n = (v: number) => Math.round(v).toLocaleString(loc)

  const { indicateurs, libelles, libelle } = await indicateursGroupe(supabase, groupe.sites, annee ?? null)
  const g = consolider(indicateurs)
  const mois = g.parMois.map((m) => m.mois)

  const tableaux: Tableau[] = [
    {
      titre: t.rapport.parSite,
      colonnes: [t.site, t.mesures.effectif, t.mesures.du, t.mesures.paye, t.mesures.reste, t.mesures.recouvrement, t.mesures.elevesEnRetard, t.kpi.moisCourant],
      lignes: indicateurs.map((i) => [i.site.nom, i.effectif, n(i.finances.du), n(i.finances.paye), n(i.finances.reste), f.taux(pct(i.finances.paye, i.finances.du)), i.finances.elevesEnRetard, n(i.finances.moisCourant)]),
      total: [t.groupe, g.effectif, n(g.du), n(g.paye), n(g.reste), f.taux(pct(g.paye, g.du)), g.elevesEnRetard, n(g.moisCourant)],
    },
    {
      titre: t.rapport.parMois,
      colonnes: [t.site, ...mois.map(f.mois), t.rapport.total],
      lignes: indicateurs.map((i) => [i.site.nom, ...i.finances.parMois.map((m) => n(m.montant)), n(i.finances.parMois.reduce((s, m) => s + m.montant, 0))]),
      total: [t.groupe, ...g.parMois.map((m) => n(m.montant)), n(g.parMois.reduce((s, m) => s + m.montant, 0))],
    },
    {
      titre: t.rapport.parMode,
      colonnes: [t.site, ...MODES_PAIEMENT.map((m) => dict.finances.modes[m])],
      lignes: indicateurs.map((i) => [i.site.nom, ...MODES_PAIEMENT.map((m) => n(i.finances.parMode[m] ?? 0))]),
      total: [t.groupe, ...MODES_PAIEMENT.map((m) => n(g.parMode[m] ?? 0))],
    },
  ]
  const titre = fmt(t.rapport.titre, { annee: libelle ?? '' })

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{titre}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{fmt(t.rapport.sousTitre, { devise: dict.abonnement.fcfa })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SelecteurLibelle libelles={libelles} choisi={libelle} etiquette={dict.scolarite.annee} />
          <RapportActions
            titre={titre}
            sousTitre={fmt(t.rapport.sousTitre, { devise: dict.abonnement.fcfa })}
            groupe={groupe.groupeNom}
            tableaux={tableaux}
            lang={locale}
            libelles={{ imprimer: t.rapport.imprimer, csv: t.rapport.csv, popup: dict.bulletin.popup, edite: fmt(t.rapport.edite, { date: new Date().toLocaleDateString(loc) }) }}
          />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile libelle={t.mesures.du} valeur={f.compact(g.du)} detail={f.montant(g.du)} />
        <Tuile libelle={t.mesures.paye} valeur={f.compact(g.paye)} detail={fmt(t.kpi.recouvrement, { taux: f.taux(pct(g.paye, g.du)) })} ton="bon" />
        <Tuile libelle={t.mesures.reste} valeur={f.compact(g.reste)} detail={fmt(t.kpi.elevesEnRetard, { n: g.elevesEnRetard })} ton={g.reste > 0 ? 'alerte' : 'bon'} />
        <Tuile libelle={t.mesures.recetteParEleve} valeur={g.effectif ? f.compact(g.paye / g.effectif) : '—'} detail={t.rapport.moyenneEncaissee} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <ColonnesMois
          titre={t.encaissementsMensuels}
          colonnes={g.parMois.map((m) => ({ cle: m.mois, libelle: f.mois(m.mois), valeur: m.montant, affichage: f.montant(m.montant) }))}
          format={f.montant}
          vide={t.aucunEncaissement}
        />
        <BarresHorizontales
          titre={t.rapport.parMode}
          vide={t.aucunEncaissement}
          lignes={MODES_PAIEMENT.map((m) => ({ cle: m, libelle: dict.finances.modes[m], valeur: g.parMode[m] ?? 0, affichage: f.compact(g.parMode[m] ?? 0), detail: f.taux(pct(g.parMode[m] ?? 0, g.paye)) }))}
        />
      </div>

      {tableaux.map((tb) => (
        <section key={tb.titre} className="overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-xs">
          <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{tb.titre}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                <tr>{tb.colonnes.map((c, k) => <th key={k} className={`whitespace-nowrap px-4 py-3 ${k === 0 ? 'sticky start-0 bg-surface text-start' : 'text-end'}`}>{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {tb.lignes.map((l, r) => (
                  <tr key={r}>{l.map((v, k) => <td key={k} className={`whitespace-nowrap px-4 py-2.5 ${k === 0 ? 'sticky start-0 bg-surface font-medium text-foreground' : 'text-end tabular-nums text-foreground'}`}>{v}</td>)}</tr>
                ))}
                {tb.total && (
                  <tr className="bg-primary-soft/40 font-semibold">{tb.total.map((v, k) => <td key={k} className={`whitespace-nowrap px-4 py-2.5 ${k === 0 ? 'sticky start-0 bg-primary-soft/40' : 'text-end tabular-nums'}`}>{v}</td>)}</tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
