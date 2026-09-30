import Link from 'next/link'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { ColonnesMois, Tuile } from '@/components/groupe/Barres'
import { createClient } from '@/utils/supabase/server'
import { getGroupeContext } from '@/lib/auth/getGroupeContext'
import { consolider, indicateursGroupe, pct, recouvrementADate } from '@/lib/groupe'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import { SelecteurLibelle } from './GroupeNav'
import { formats } from './format'

// Seuils des alertes de la synthèse.
const RECOUVREMENT_MIN = 70
const HEURES_NJ_MAX = 5

// Synthèse du groupe : chiffres consolidés, encaissements, un bloc par site et alertes.
export default async function GroupeSynthese({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const groupe = await getGroupeContext()
  const { annee } = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.groupe
  const f = formats(loc, dict.abonnement.fcfa)

  const { indicateurs, libelles, libelle } = await indicateursGroupe(supabase, groupe.sites, annee ?? null)
  const g = consolider(indicateurs)
  const recouvrement = recouvrementADate(g)
  const anneeResultats = indicateurs.find((i) => i.resultats)?.resultats?.annee ?? null

  const alertes: { site: string; texte: string }[] = []
  for (const i of indicateurs) {
    if (i.acces !== 'complet') alertes.push({ site: i.site.nom, texte: t.alertes.abonnement[i.acces as 'lecture_seule' | 'suspendu'] ?? t.alertes.abonnement.lecture_seule })
    const r = recouvrementADate(i.finances)
    if (r !== null && r < RECOUVREMENT_MIN) alertes.push({ site: i.site.nom, texte: fmt(t.alertes.recouvrement, { taux: f.taux(r), seuil: RECOUVREMENT_MIN }) })
    const hNJ = i.effectif ? i.assiduite.heuresNJ / i.effectif : 0
    if (hNJ > HEURES_NJ_MAX) alertes.push({ site: i.site.nom, texte: fmt(t.alertes.absenteisme, { h: hNJ.toLocaleString(loc, { maximumFractionDigits: 1 }) }) })
  }

  if (groupe.sites.length === 0) {
    return <p className="rounded-2xl border border-surface-border bg-surface p-8 text-center text-sm text-foreground-muted">{t.aucunSite}</p>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{t.syntheseTitre}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{fmt(t.syntheseSousTitre, { n: g.sites })}</p>
        </div>
        <SelecteurLibelle libelles={libelles} choisi={libelle} etiquette={dict.scolarite.annee} />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile libelle={t.kpi.eleves} valeur={f.nombre(g.effectif)} detail={fmt(t.kpi.filles, { taux: f.taux(pct(g.filles, g.effectif)) })} />
        <Tuile libelle={t.kpi.enseignants} valeur={f.nombre(g.enseignants)} detail={fmt(t.kpi.parEnseignant, { n: g.enseignants ? (g.effectif / g.enseignants).toLocaleString(loc, { maximumFractionDigits: 1 }) : '—' })} />
        <Tuile libelle={t.kpi.encaisse} valeur={f.compact(g.paye)} detail={fmt(t.kpi.recouvrement, { taux: f.taux(recouvrement) })} ton={recouvrement !== null && recouvrement < RECOUVREMENT_MIN ? 'alerte' : 'bon'} />
        <Tuile libelle={t.kpi.reste} valeur={f.compact(g.resteADate)} detail={fmt(t.kpi.elevesEnRetard, { n: g.elevesEnRetard })} ton={g.resteADate > 0 ? 'alerte' : 'bon'} />
        <Tuile libelle={t.kpi.admission} valeur={f.taux(pct(g.admis, g.decisions))} detail={anneeResultats ? fmt(t.kpi.resultatsDe, { annee: anneeResultats }) : t.kpi.pasDeResultats} />
        <Tuile libelle={t.kpi.moyenne} valeur={f.moyenne(g.moyenne)} detail={t.kpi.surVingt} />
        <Tuile libelle={t.kpi.classes} valeur={f.nombre(g.classes)} detail={fmt(t.kpi.parClasse, { n: g.classes ? (g.effectif / g.classes).toLocaleString(loc, { maximumFractionDigits: 1 }) : '—' })} />
        <Tuile libelle={t.kpi.moisCourant} valeur={f.compact(g.moisCourant)} detail={f.moisLong(new Date().toISOString().slice(0, 7))} />
      </section>

      <ColonnesMois
        titre={t.encaissementsMensuels}
        colonnes={g.parMois.map((m) => ({ cle: m.mois, libelle: f.mois(m.mois), valeur: m.montant, affichage: f.montant(m.montant) }))}
        format={f.montant}
        vide={t.aucunEncaissement}
      />

      {alertes.length > 0 && (
        <section className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-warning"><AlertTriangle className="h-4 w-4" /> {t.alertes.titre}</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {alertes.map((a, k) => <li key={k}><b className="text-foreground">{a.site}</b> <span className="text-foreground-muted">· {a.texte}</span></li>)}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">{t.sites}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {indicateurs.map((i) => {
            const r = recouvrementADate(i.finances)
            return (
              <Link key={i.site.id} href={`/groupe/etablissements/${i.site.id}${libelle ? `?annee=${encodeURIComponent(libelle)}` : ''}`} className="group rounded-2xl border border-surface-border bg-surface p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-base font-semibold text-foreground">{i.site.nom}</p>
                    <p className="text-xs text-foreground-muted">{[i.site.ville, dict.paliers[i.site.palier as keyof typeof dict.paliers], i.site.prive ? dict.etablissement.statuts.prive : dict.etablissement.statuts.public].filter(Boolean).join(' · ')}</p>
                  </div>
                  {i.acces !== 'complet' && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">{t.accesLibelle[i.acces as 'lecture_seule' | 'suspendu'] ?? i.acces}</span>}
                  <ChevronRight className="h-5 w-5 text-foreground-muted group-hover:text-primary rtl:-scale-x-100" />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-background px-2 py-2"><dt className="text-foreground-muted">{t.kpi.eleves}</dt><dd className="mt-0.5 text-base font-semibold text-foreground tabular-nums">{f.nombre(i.effectif)}</dd></div>
                  <div className="rounded-xl bg-background px-2 py-2"><dt className="text-foreground-muted">{t.kpi.admissionCourt}</dt><dd className="mt-0.5 text-base font-semibold text-foreground tabular-nums">{f.taux(pct(i.resultats?.admis ?? 0, i.resultats?.decisions ?? 0))}</dd></div>
                  <div className="rounded-xl bg-background px-2 py-2"><dt className="text-foreground-muted">{t.kpi.recouvrementCourt}</dt><dd className={`mt-0.5 text-base font-semibold tabular-nums ${r !== null && r < RECOUVREMENT_MIN ? 'text-danger' : 'text-foreground'}`}>{f.taux(r)}</dd></div>
                </dl>
                <div className="mt-3 h-2 rounded-full bg-background" title={`${t.kpi.recouvrementCourt} · ${f.taux(r)}`}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r ?? 0)}%` }} />
                </div>
                <p className="mt-2 text-xs text-foreground-muted tabular-nums">{fmt(t.kpi.payeSurEchu, { paye: f.montant(i.finances.paye), echu: f.montant(i.finances.duADate) })}</p>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
