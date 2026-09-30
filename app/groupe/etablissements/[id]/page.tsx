import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BarresHorizontales, ColonnesMois, Tuile } from '@/components/groupe/Barres'
import { inputClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getGroupeContext } from '@/lib/auth/getGroupeContext'
import { situationsFinancieres } from '@/lib/finances'
import { anneesDesSites, indicateursSite, pct } from '@/lib/groupe'
import { lireTout } from '@/lib/lireTout'
import { un } from '@/lib/scolarite'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import { SelecteurLibelle } from '../../GroupeNav'
import { formats } from '../../format'

const VUES = ['apercu', 'classes', 'eleves', 'finances', 'personnel'] as const
type Vue = (typeof VUES)[number]
const CYCLES = ['prescolaire', 'elementaire', 'moyen', 'secondaire'] as const

// Consultation détaillée d'un site par le DG (lecture seule).
export default async function GroupeSite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ annee?: string; vue?: string; q?: string }> }) {
  const groupe = await getGroupeContext()
  const { id } = await params
  const sp = await searchParams
  const site = groupe.sites.find((s) => s.id === id)
  if (!site) notFound()
  const vue: Vue = (VUES as readonly string[]).includes(sp.vue ?? '') ? (sp.vue as Vue) : 'apercu'

  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.groupe
  const f = formats(loc, dict.abonnement.fcfa)

  const { parSite, libelles, defaut } = await anneesDesSites(supabase, [site])
  const annees = parSite.get(site.id) ?? []
  const libelle = sp.annee && libelles.includes(sp.annee) ? sp.annee : (annees.find((a) => a.active)?.libelle ?? defaut)
  const annee = annees.find((a) => a.libelle === libelle) ?? null
  const q = (v: Vue) => `/groupe/etablissements/${id}?vue=${v}${libelle ? `&annee=${encodeURIComponent(libelle)}` : ''}`

  let contenu: React.ReactNode = null

  if (vue === 'apercu') {
    const { data: acces } = await supabase.rpc('acces_sites_groupe')
    const i = await indicateursSite(supabase, site, annees, libelle, ((acces ?? []) as { etablissement_id: string; acces: string }[]).find((a) => a.etablissement_id === id)?.acces ?? 'complet')
    contenu = (
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tuile libelle={t.kpi.eleves} valeur={f.nombre(i.effectif)} detail={fmt(t.kpi.filles, { taux: f.taux(pct(i.filles, i.effectif)) })} />
          <Tuile libelle={t.kpi.enseignants} valeur={f.nombre(i.enseignants)} detail={fmt(t.kpi.parClasse, { n: i.classes ? (i.effectif / i.classes).toLocaleString(loc, { maximumFractionDigits: 1 }) : '—' })} />
          <Tuile libelle={t.kpi.encaisse} valeur={f.compact(i.finances.paye)} detail={fmt(t.kpi.recouvrement, { taux: f.taux(pct(i.finances.paye, i.finances.du)) })} />
          <Tuile libelle={t.kpi.admission} valeur={f.taux(i.resultats ? pct(i.resultats.admis, i.resultats.decisions) : null)} detail={i.resultats ? fmt(t.kpi.resultatsDe, { annee: i.resultats.annee }) : t.kpi.pasDeResultats} />
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <ColonnesMois titre={t.encaissementsMensuels} colonnes={i.finances.parMois.map((m) => ({ cle: m.mois, libelle: f.mois(m.mois), valeur: m.montant, affichage: f.montant(m.montant) }))} format={f.montant} vide={t.aucunEncaissement} />
          <BarresHorizontales titre={t.effectifParCycle} vide={t.aucuneDonnee} lignes={CYCLES.filter((c) => i.parCycle[c]).map((c) => ({ cle: c, libelle: dict.cycles[c], valeur: i.parCycle[c], affichage: f.nombre(i.parCycle[c]) }))} />
          <BarresHorizontales titre={t.examens} vide={t.aucunExamen} lignes={i.examens.map((e) => ({ cle: e.examen, libelle: e.examen, valeur: pct(e.admis, e.presentes), affichage: f.taux(pct(e.admis, e.presentes)), detail: `${e.admis}/${e.presentes}` }))} />
          <BarresHorizontales titre={t.admissions} vide={t.aucuneDonnee} lignes={Object.entries(i.admissions).map(([k, n]) => ({ cle: k, libelle: dict.admissions.statuts[k as keyof typeof dict.admissions.statuts] ?? k, valeur: n, affichage: f.nombre(n) }))} />
        </div>
      </div>
    )
  }

  if (vue === 'classes' || vue === 'finances') {
    if (!annee) contenu = <p className="text-sm text-foreground-muted">{t.aucuneDonnee}</p>
    else {
      const [{ data: classes }, inscriptions, situations, decisions] = await Promise.all([
        supabase.from('classes').select('id, nom, capacite, niveaux(nom, ordre), enseignants(civilite, nom)').eq('annee_id', annee.id),
        lireTout((de, a) => supabase.from('inscriptions').select('id, eleve_id, classe_id, eleves(prenom, nom, matricule, sexe)').eq('annee_id', annee.id).order('id').range(de, a)),
        situationsFinancieres(supabase, annee.id),
        lireTout((de, a) => supabase.from('decisions').select('inscription_id, moyenne_annuelle, decision_finale, inscriptions!inner(annee_id)').eq('inscriptions.annee_id', annee.id).order('id').range(de, a)),
      ])
      type Insc = { id: string; eleve_id: string; classe_id: string; eleves: { prenom: string; nom: string; matricule: string; sexe: string } | null }
      const insc = inscriptions as unknown as Insc[]
      const dec = new Map((decisions as { inscription_id: string; moyenne_annuelle: number | null; decision_finale: string | null }[]).map((d) => [d.inscription_id, d]))
      const lignes = ((classes ?? []) as unknown as { id: string; nom: string; capacite: number | null; niveaux: { nom: string; ordre: number } | null; enseignants: { civilite: string | null; nom: string } | null }[])
        .map((c) => {
          const eleves = insc.filter((i) => i.classe_id === c.id)
          const ds = eleves.map((e) => dec.get(e.id)).filter((d) => d)
          const moy = ds.map((d) => d!.moyenne_annuelle).filter((m): m is number => m !== null).map(Number)
          const fin = eleves.reduce((s, e) => { const x = situations.get(e.eleve_id); return x ? { du: s.du + x.du, paye: s.paye + x.paye, reste: s.reste + x.reste, retard: s.retard + (x.reste > 0 ? 1 : 0) } : s }, { du: 0, paye: 0, reste: 0, retard: 0 })
          return {
            ...c,
            ordre: un(c.niveaux)?.ordre ?? 0,
            prof: un(c.enseignants),
            effectif: eleves.length,
            filles: eleves.filter((e) => un(e.eleves)?.sexe === 'F').length,
            moyenne: moy.length ? moy.reduce((s, m) => s + m, 0) / moy.length : null,
            admis: ds.filter((d) => d!.decision_finale === 'admis').length,
            decisions: ds.length,
            fin,
          }
        })
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom))

      if (vue === 'classes') {
        contenu = (
          <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface shadow-xs">
            <table className="min-w-full text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                <tr>{[dict.eleves.classe, t.professeurPrincipal, t.mesures.effectif, t.mesures.filles, t.mesures.moyenne, t.mesures.admission].map((c, k) => <th key={c} className={`whitespace-nowrap px-4 py-3 ${k < 2 ? 'text-start' : 'text-end'}`}>{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {lignes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{c.nom}</td>
                    <td className="px-4 py-2.5 text-foreground-muted">{c.prof ? `${c.prof.civilite ?? ''} ${c.prof.nom}`.trim() : '—'}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{c.effectif}{c.capacite ? <span className="text-xs text-foreground-muted"> / {c.capacite}</span> : null}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{f.taux(pct(c.filles, c.effectif))}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{f.moyenne(c.moyenne)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{c.decisions ? f.taux(pct(c.admis, c.decisions)) : '—'}</td>
                  </tr>
                ))}
                {lignes.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-foreground-muted">{t.aucuneDonnee}</td></tr>}
              </tbody>
            </table>
          </div>
        )
      } else {
        const impayes = insc
          .map((i) => ({ i, s: situations.get(i.eleve_id), classe: lignes.find((c) => c.id === i.classe_id)?.nom ?? '' }))
          .filter((x) => (x.s?.reste ?? 0) > 0)
          .sort((a, b) => (b.s!.reste) - (a.s!.reste))
          .slice(0, 25)
        contenu = (
          <div className="space-y-6">
            <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface shadow-xs">
              <table className="min-w-full text-sm">
                <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <tr>{[dict.eleves.classe, t.mesures.effectif, t.mesures.du, t.mesures.paye, t.mesures.reste, t.mesures.recouvrement, t.mesures.elevesEnRetard].map((c, k) => <th key={c} className={`whitespace-nowrap px-4 py-3 ${k === 0 ? 'text-start' : 'text-end'}`}>{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {lignes.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-medium text-foreground">{c.nom}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{c.effectif}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end tabular-nums">{f.nombre(c.fin.du)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end tabular-nums">{f.nombre(c.fin.paye)}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-end tabular-nums ${c.fin.reste > 0 ? 'text-danger' : ''}`}>{f.nombre(c.fin.reste)}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{f.taux(pct(c.fin.paye, c.fin.du))}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{c.fin.retard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <section className="overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-xs">
              <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{t.plusGrosImpayes}</h2>
              <ul className="divide-y divide-surface-border">
                {impayes.map(({ i, s, classe }) => (
                  <li key={i.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{un(i.eleves)?.nom} {un(i.eleves)?.prenom} <span className="text-xs text-foreground-muted">· {classe} · <span className="font-mono">{un(i.eleves)?.matricule}</span></span></span>
                    <span className="font-semibold tabular-nums text-danger">{f.montant(s!.reste)}</span>
                  </li>
                ))}
                {impayes.length === 0 && <li className="px-5 py-8 text-center text-sm text-foreground-muted">{dict.finances.aucunImpaye}</li>}
              </ul>
            </section>
          </div>
        )
      }
    }
  }

  if (vue === 'eleves' && annee) {
    const recherche = (sp.q ?? '').trim()
    let requete = supabase
      .from('inscriptions')
      .select('id, statut, eleve_id, eleves!inner(prenom, nom, matricule, sexe), classes(nom)', { count: 'exact' })
      .eq('annee_id', annee.id)
    if (recherche) requete = requete.or(`nom.ilike.%${recherche.replace(/[%,()]/g, '')}%,prenom.ilike.%${recherche.replace(/[%,()]/g, '')}%,matricule.ilike.%${recherche.replace(/[%,()]/g, '')}%`, { referencedTable: 'eleves' })
    const [{ data, count }, situations, absences] = await Promise.all([
      requete.order('eleves(nom)').limit(200),
      situationsFinancieres(supabase, annee.id),
      lireTout((de, a) => supabase.from('absences').select('eleve_id, duree, justifiee, type').eq('annee_id', annee.id).eq('type', 'absence').eq('justifiee', false).order('id').range(de, a)),
    ])
    const hNJ = new Map<string, number>()
    for (const a of absences as { eleve_id: string; duree: number }[]) hNJ.set(a.eleve_id, (hNJ.get(a.eleve_id) ?? 0) + Number(a.duree))
    type L = { id: string; statut: string; eleve_id: string; eleves: { prenom: string; nom: string; matricule: string; sexe: string } | null; classes: { nom: string } | null }
    contenu = (
      <div className="space-y-4">
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="vue" value="eleves" />
          {libelle && <input type="hidden" name="annee" value={libelle} />}
          <label htmlFor="q" className="sr-only">{dict.eleves.recherche}</label>
          <input id="q" name="q" defaultValue={recherche} placeholder={dict.eleves.recherche} className={`${inputClass} mt-0 max-w-sm`} />
        </form>
        <p className="text-xs text-foreground-muted">{fmt(t.elevesAffiches, { n: (data ?? []).length, total: count ?? 0 })}</p>
        <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface shadow-xs">
          <table className="min-w-full text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <tr>{[dict.eleves.matricule, dict.eleves.eleve, dict.eleves.classe, t.statutInscription, t.heuresNJ, t.mesures.reste].map((c, k) => <th key={c} className={`whitespace-nowrap px-4 py-3 ${k < 4 ? 'text-start' : 'text-end'}`}>{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {((data ?? []) as unknown as L[]).map((l) => {
                const e = un(l.eleves)
                const reste = situations.get(l.eleve_id)?.reste ?? 0
                return (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">{e?.matricule}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{e?.nom} {e?.prenom}</td>
                    <td className="px-4 py-2.5">{un(l.classes)?.nom}</td>
                    <td className="px-4 py-2.5 text-foreground-muted">{dict.scolarite.statutsInscription[l.statut as keyof typeof dict.scolarite.statutsInscription] ?? l.statut}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{hNJ.get(l.eleve_id) ?? 0}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-end tabular-nums ${reste > 0 ? 'text-danger' : 'text-success'}`}>{f.nombre(reste)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (vue === 'personnel') {
    const [{ data: enseignants }, { data: utilisateurs }, { data: enseignements }] = await Promise.all([
      supabase.from('enseignants').select('id, civilite, prenom, nom, telephone, email, actif').eq('etablissement_id', id).order('nom'),
      supabase.from('utilisateurs').select('id, role, prenom, nom, email, actif').eq('etablissement_id', id).order('role'),
      annee ? supabase.from('enseignements').select('enseignant_id, matieres(nom), classes!inner(annee_id)').eq('classes.annee_id', annee.id) : Promise.resolve({ data: [] }),
    ])
    const matieres = new Map<string, Set<string>>()
    for (const e of (enseignements ?? []) as unknown as { enseignant_id: string | null; matieres: { nom: string } | null }[]) {
      if (!e.enseignant_id) continue
      matieres.set(e.enseignant_id, (matieres.get(e.enseignant_id) ?? new Set()).add(un(e.matieres)?.nom ?? ''))
    }
    contenu = (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-xs">
          <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{fmt(t.enseignantsTitre, { n: (enseignants ?? []).filter((e) => e.actif).length })}</h2>
          <ul className="divide-y divide-surface-border">
            {(enseignants ?? []).map((e) => (
              <li key={e.id} className={`px-5 py-2.5 text-sm ${e.actif ? '' : 'opacity-50'}`}>
                <p className="font-medium text-foreground">{[e.civilite, e.prenom, e.nom].filter(Boolean).join(' ')}</p>
                <p className="text-xs text-foreground-muted">{[...(matieres.get(e.id) ?? [])].join(', ') || '—'}{e.telephone && <span dir="ltr"> · {e.telephone}</span>}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="h-fit overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-xs">
          <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{t.personnelAdministratif}</h2>
          <ul className="divide-y divide-surface-border">
            {(utilisateurs ?? []).map((u) => (
              <li key={u.id} className={`flex justify-between gap-3 px-5 py-2.5 text-sm ${u.actif ? '' : 'opacity-50'}`}>
                <span className="min-w-0 truncate">{[u.prenom, u.nom].filter(Boolean).join(' ')} <span className="text-xs text-foreground-muted" dir="ltr">{u.email}</span></span>
                <span className="shrink-0 text-xs font-medium text-foreground-muted">{dict.roles[u.role as keyof typeof dict.roles]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href="/groupe/etablissements" className="inline-flex items-center gap-1 text-sm font-medium text-foreground-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t.onglets.etablissements}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{site.nom}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{[site.ville, dict.paliers[site.palier as keyof typeof dict.paliers], site.prive ? dict.etablissement.statuts.prive : dict.etablissement.statuts.public].filter(Boolean).join(' · ')} · {t.lectureSeule}</p>
        </div>
        <SelecteurLibelle libelles={libelles} choisi={libelle} etiquette={dict.scolarite.annee} />
      </div>
      <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-xl border border-surface-border bg-surface p-1 shadow-xs">
          {VUES.map((v) => (
            <Link key={v} href={q(v)} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${vue === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground-muted hover:bg-primary-soft hover:text-foreground'}`}>
              {t.vuesSite[v]}
            </Link>
          ))}
        </div>
      </nav>
      {contenu ?? <p className="text-sm text-foreground-muted">{t.aucuneDonnee}</p>}
    </div>
  )
}
