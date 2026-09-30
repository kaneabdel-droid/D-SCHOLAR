import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Award, CalendarCheck, Clock, GraduationCap, LogIn, LogOut, Phone, User } from 'lucide-react'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { anneesEtSelection, appreciationPour, baremeAppreciations, libellePeriode, moyenneLisible, TEINTES_APPRECIATION, TEINTES_DECISION, un } from '@/lib/scolarite'
import { fmt, intlLocale } from '@/lib/i18n'
import { peutEcrire } from '@/lib/roles'
import EleveActions from './EleveActions'
import { situationsFinancieres } from '@/lib/finances'
import type { TypeDocument } from '@/lib/documents'
import { EmettreDocumentButton, LigneDocumentActions } from '../../attestations/DocumentsClient'
import { getDictionary, getLocale } from '@/dictionaries'

type Inscription = {
  id: string
  statut: string
  annee_id: string
  classe_id: string
  annees_scolaires: { libelle: string; date_debut: string } | null
  classes: { nom: string } | null
  decisions: { moyenne_annuelle: number | null; rang: number | null; decision: string; note_repechage: number | null; decision_finale: string | null; orientation: string | null } | null
}

export default async function EleveFichePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ annee?: string }> }) {
  const context = await getCurrentUserContext()
  const { id } = await params
  const { annee } = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.eleves
  const s = dict.scolarite
  const date = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })

  const [{ data: eleve }, { data: inscriptionsBrutes }, { data: examens }, { data: mouvements }, bareme] = await Promise.all([
    supabase.from('eleves').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('inscriptions')
      .select('id, statut, annee_id, classe_id, annees_scolaires(libelle, date_debut), classes(nom), decisions(moyenne_annuelle, rang, decision, note_repechage, decision_finale, orientation)')
      .eq('eleve_id', id),
    supabase.from('examens_officiels').select('id, examen, session, resultat, mention, annees_scolaires(libelle)').eq('eleve_id', id),
    supabase.from('mouvements').select('id, date_mouvement, type, motif').eq('eleve_id', id).order('date_mouvement'),
    baremeAppreciations(supabase),
  ])
  if (!eleve) notFound()

  const inscriptions = ((inscriptionsBrutes ?? []) as unknown as Inscription[])
    .map((i) => ({ ...i, annees_scolaires: un(i.annees_scolaires), classes: un(i.classes), decisions: un(i.decisions) }))
    .sort((a, b) => (a.annees_scolaires?.date_debut ?? '').localeCompare(b.annees_scolaires?.date_debut ?? ''))

  // Année affichée : celle de l'URL si l'élève y est inscrit, sinon sa dernière année évaluée.
  const { annees } = await anneesEtSelection(supabase, annee)
  const anneesEleve = annees.filter((a) => inscriptions.some((i) => i.annee_id === a.id))
  const inscription =
    inscriptions.find((i) => i.annee_id === annee) ?? [...inscriptions].reverse().find((i) => i.decisions) ?? inscriptions[inscriptions.length - 1] ?? null

  // Résultats de l'année affichée : moyennes par matière et par trimestre (calcul SQL).
  let lignesMatieres: { matiere: string; couleur: string; coef: number; moyennes: (number | null)[] }[] = []
  let generales: (number | null)[] = []
  let rangs: (number | null)[] = []
  let periodes: { id: string; rang: number; decoupage: string }[] = []
  let heures = 0
  let heuresNJ = 0
  let retards = 0
  let evaluationsManquees = 0

  if (inscription) {
    const [{ data: per }, { data: matieres }, { data: absences }, { count: manquees }] = await Promise.all([
      // Périodes du découpage du cycle de la classe (trimestres ou semestres).
      supabase.rpc('periodes_classe', { p_classe_id: inscription.classe_id }),
      supabase.from('matieres').select('id, nom, couleur'),
      supabase.from('absences').select('type, duree, justifiee').eq('eleve_id', id).eq('annee_id', inscription.annee_id),
      supabase.from('notes').select('id, evaluations!inner(periodes!inner(annee_id))', { count: 'exact', head: true })
        .eq('eleve_id', id).eq('absent', true).eq('evaluations.periodes.annee_id', inscription.annee_id),
    ])
    periodes = per ?? []
    const resultats = await Promise.all(
      periodes.map(async (p) => {
        const [{ data: mm }, { data: mp }] = await Promise.all([
          supabase.rpc('moyennes_matieres', { p_classe_id: inscription.classe_id, p_periode_id: p.id }),
          supabase.rpc('moyennes_periode', { p_classe_id: inscription.classe_id, p_periode_id: p.id }),
        ])
        return {
          matieres: ((mm ?? []) as { eleve_id: string; matiere_id: string; moyenne: number; coefficient: number }[]).filter((m) => m.eleve_id === id),
          generale: ((mp ?? []) as { eleve_id: string; moyenne: number; rang: number }[]).find((m) => m.eleve_id === id) ?? null,
        }
      })
    )
    const parMatiere = new Map<string, { coef: number; moyennes: (number | null)[] }>()
    resultats.forEach((r, i) => {
      for (const m of r.matieres) {
        const ligne = parMatiere.get(m.matiere_id) ?? { coef: Number(m.coefficient), moyennes: periodes.map(() => null) }
        ligne.moyennes[i] = Number(m.moyenne)
        parMatiere.set(m.matiere_id, ligne)
      }
    })
    const nomsMatieres = new Map((matieres ?? []).map((m) => [m.id, m]))
    lignesMatieres = [...parMatiere.entries()]
      .map(([mid, l]) => ({ matiere: nomsMatieres.get(mid)?.nom ?? '—', couleur: nomsMatieres.get(mid)?.couleur ?? '#999', ...l }))
      .sort((a, b) => b.coef - a.coef || a.matiere.localeCompare(b.matiere))
    generales = resultats.map((r) => (r.generale ? Number(r.generale.moyenne) : null))
    rangs = resultats.map((r) => (r.generale ? Number(r.generale.rang) : null))

    for (const a of absences ?? []) {
      if (a.type === 'retard') retards++
      else {
        heures += Number(a.duree)
        if (!a.justifiee) heuresNJ += Number(a.duree)
      }
    }
    evaluationsManquees = manquees ?? 0
  }

  const annuelle = inscription?.decisions?.moyenne_annuelle ?? null

  // Gestion (secrétariat, direction, censeur) : dernière inscription, classes de
  // la même année, accès au portail déjà ouverts et codes en attente.
  const gestion = peutEcrire(context.role, 'eleves')
  const courante = inscriptions[inscriptions.length - 1] ?? null
  const [{ data: classesAnnee }, { data: etabNiveau }, { data: niveauCourant }, { data: liens }, { data: codes }] = gestion
    ? await Promise.all([
        courante ? supabase.from('classes').select('id, nom').eq('annee_id', courante.annee_id).order('nom') : Promise.resolve({ data: [] }),
        supabase.from('etablissements').select('niveau_min_compte_eleve').eq('id', context.etablissementId).single(),
        courante ? supabase.from('classes').select('niveaux(ordre)').eq('id', courante.classe_id).single() : Promise.resolve({ data: null }),
        supabase.from('liens_famille').select('lien, comptes_famille(prenom, nom, telephone)').eq('eleve_id', id),
        supabase.from('codes_activation').select('code, type, expire_le').eq('eleve_id', id).is('utilise_le', null).gt('expire_le', new Date().toISOString()),
      ])
    : [{ data: [] }, { data: null }, { data: null }, { data: [] }, { data: [] }]
  const { data: niveauMin } = gestion && etabNiveau
    ? await supabase.from('niveaux').select('ordre').eq('code', etabNiveau.niveau_min_compte_eleve).maybeSingle()
    : { data: null }
  const ordreCourant = un(niveauCourant?.niveaux as unknown as { ordre: number } | null)?.ordre ?? 0
  const compteEleveDisponible = ordreCourant >= (niveauMin?.ordre ?? 0)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://scholar.dembasolution.com'

  // Situation financière de l'année affichée (direction, censeur, intendance, secrétariat).
  const finance = ['direction', 'censeur', 'intendant', 'secretariat'].includes(context.role)
  const [situations, { data: servicesEleve }, { data: paiementsEleve }] = finance && inscription
    ? await Promise.all([
        situationsFinancieres(supabase, inscription.annee_id, [id]),
        supabase.from('souscriptions_services').select('details, services(nom, tarif, periodicite)').eq('eleve_id', id).eq('annee_id', inscription.annee_id),
        supabase.from('paiements_eleves').select('libelle, montant, numero_recu, date_paiement').eq('eleve_id', id).eq('annee_id', inscription.annee_id).order('date_paiement', { ascending: false }).limit(6),
      ])
    : [null, { data: [] }, { data: [] }]
  const situation = situations?.get(id) ?? null

  // Documents émis (attestations, certificats, exeat, relevés).
  const documentsVisibles = peutEcrire(context.role, 'documents')
  const { data: documents } = documentsVisibles
    ? await supabase.from('documents_emis').select('id, type, numero, emis_le, annule').eq('eleve_id', id).order('emis_le', { ascending: false })
    : { data: [] }
  const periodeLib = (p: { rang: number; decoupage: string }) => libellePeriode(dict.annees, p)
  const icones: Record<string, typeof LogIn> = { entree: LogIn, transfert_entrant: LogIn, transfert_sortant: LogOut, abandon: LogOut, exclusion: LogOut, fin_de_cycle: GraduationCap }

  return (
    <div className="space-y-6">
      <Link href="/eleves" className="inline-flex items-center gap-1 text-sm font-medium text-foreground-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t.retour}
      </Link>

      {/* Identité */}
      <section className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-soft font-heading text-xl font-semibold text-primary">
            {eleve.prenom[0]}{eleve.nom[0]}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {eleve.prenom} {eleve.nom}
              {eleve.statut === 'sorti' && <span className="ms-2 rounded-full bg-foreground-muted/10 px-2 py-0.5 align-middle text-xs font-medium text-foreground-muted">{s.sorti}</span>}
            </h1>
            <p className="mt-0.5 font-mono text-xs text-foreground-muted">{eleve.matricule} · {s.sexe[eleve.sexe as 'M' | 'F']}</p>
            <div className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-foreground-muted sm:grid-cols-2">
              {eleve.date_naissance && <p className="flex items-center gap-2"><User className="h-4 w-4 shrink-0" /> {fmt(t.naissance, { date: date(eleve.date_naissance), lieu: eleve.lieu_naissance ?? '—' })}</p>}
              {eleve.tuteur_nom && <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /> {t.tuteur} · {eleve.tuteur_nom} · <span dir="ltr">{eleve.tuteur_telephone}</span></p>}
              {eleve.adresse && <p>{t.adresse} · {eleve.adresse}</p>}
              {eleve.date_entree && <p>{fmt(t.entree, { date: date(eleve.date_entree) })}</p>}
            </div>
          </div>
        </div>
        {gestion && (
          <div className="mt-5 space-y-3 border-t border-surface-border pt-4">
            <EleveActions
              eleveId={id}
              identite={eleve}
              inscriptionCourante={courante ? { id: courante.id, classe_id: courante.classe_id } : null}
              classesAnnee={classesAnnee ?? []}
              compteEleveDisponible={compteEleveDisponible}
              sorti={eleve.statut === 'sorti'}
              urlActivation={`${siteUrl}/activer`}
              dict={dict}
            />
            {((liens ?? []).length > 0 || (codes ?? []).length > 0) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {(liens ?? []).map((l, i) => {
                  const cpt = un(l.comptes_famille as unknown as { prenom: string | null; nom: string | null })
                  return (
                    <span key={i} className="rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
                      {t.acces.liens[l.lien as 'pere' | 'mere' | 'tuteur']} · {[cpt?.prenom, cpt?.nom].filter(Boolean).join(' ')}
                    </span>
                  )
                })}
                {(codes ?? []).map((cd) => (
                  <span key={cd.code} className="rounded-full bg-warning/10 px-2.5 py-1 font-medium text-warning">
                    {t.acces.enAttente} · <span className="font-mono" dir="ltr">{cd.code}</span> ({cd.type === 'eleve' ? t.acces.eleve : t.acces.parent})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Cursus */}
        <section className={`${cardClass} p-5 sm:p-6`}>
          <h2 className="font-heading text-base font-semibold text-foreground">{t.cursus}</h2>
          <ol className="mt-4 space-y-4 border-s-2 border-surface-border ps-5">
            {inscriptions.map((i) => (
              <li key={i.id} className="relative">
                <span className="absolute -start-[1.72rem] top-1 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
                <p className="font-semibold text-foreground">
                  {i.annees_scolaires?.libelle} · {i.classes?.nom}
                  <span className="ms-2 text-xs font-normal text-foreground-muted">{s.statutsInscription[i.statut as keyof typeof s.statutsInscription]}</span>
                </p>
                {i.decisions && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-foreground-muted">{t.moyenneAnnuelle} <strong className="tabular-nums text-foreground">{moyenneLisible(i.decisions.moyenne_annuelle, loc)}</strong></span>
                    {i.decisions.rang && <span className="text-foreground-muted">· {fmt(t.rang, { rang: i.decisions.rang })}</span>}
                    {i.decisions.decision_finale && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_DECISION[i.decisions.decision_finale]}`}>
                        {s.decisions[i.decisions.decision_finale as keyof typeof s.decisions]}
                      </span>
                    )}
                  </div>
                )}
                {i.decisions?.decision === 'repechage' && i.decisions.note_repechage !== null && (
                  <p className="mt-1 text-xs text-warning">{fmt(t.repechage, { note: moyenneLisible(i.decisions.note_repechage, loc) })}</p>
                )}
                {i.decisions?.orientation && <p className="mt-1 text-xs text-foreground-muted">{fmt(t.orientation, { texte: i.decisions.orientation })}</p>}
              </li>
            ))}
          </ol>

          {(examens ?? []).length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold text-foreground">{t.examens}</h3>
              <ul className="mt-2 space-y-2">
                {(examens ?? []).map((ex) => (
                  <li key={ex.id} className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm">
                    <Award className={`h-4 w-4 shrink-0 ${ex.resultat === 'admis' ? 'text-success' : 'text-danger'}`} />
                    <span className="font-semibold">{ex.examen}</span>
                    <span className="text-foreground-muted">{ex.session}</span>
                    <span className={`ms-auto rounded-full px-2 py-0.5 text-xs font-semibold ${ex.resultat === 'admis' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {s.resultatsExamen[ex.resultat as 'admis' | 'ajourne']}{ex.mention ? ` · ${ex.mention}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {(mouvements ?? []).length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold text-foreground">{t.mouvements}</h3>
              <ul className="mt-2 space-y-2">
                {(mouvements ?? []).map((m) => {
                  const Icone = icones[m.type] ?? LogIn
                  return (
                    <li key={m.id} className="flex items-start gap-2 text-sm">
                      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted rtl:-scale-x-100" />
                      <span>
                        <span className="font-medium">{s.mouvements[m.type as keyof typeof s.mouvements]}</span>
                        <span className="text-foreground-muted"> · {date(m.date_mouvement)}</span>
                        {m.motif && <span className="block text-xs text-foreground-muted">{m.motif}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>

        {/* Résultats de l'année */}
        <section className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
            <h2 className="font-heading text-base font-semibold text-foreground">
              {fmt(t.resultats, { annee: inscription?.annees_scolaires?.libelle ?? '' })} · {inscription?.classes?.nom}
            </h2>
            {anneesEleve.length > 1 && (
              <SelecteurAnnee
                annees={anneesEleve}
                selection={inscription?.annee_id ?? null}
                libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }}
              />
            )}
          </div>
          {lignesMatieres.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-foreground-muted">{t.pasDeNotes}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <tr>
                    <th className="px-5 py-3 text-start">{t.matiere}</th>
                    <th className="px-3 py-3 text-center">{t.coef}</th>
                    {periodes.map((p) => (
                      <th key={p.id} className="px-3 py-3 text-center">{periodeLib(p)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {lignesMatieres.map((l) => (
                    <tr key={l.matiere}>
                      <td className="px-5 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.couleur }} />
                          {l.matiere}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-foreground-muted">{l.coef}</td>
                      {l.moyennes.map((m, i) => (
                        <td key={i} className={`px-3 py-2.5 text-center tabular-nums ${m !== null && m < 10 ? 'text-danger' : 'text-foreground'}`}>{moyenneLisible(m, loc)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-border bg-background/60 font-semibold">
                    <td className="px-5 py-3" colSpan={2}>{t.moyenneGenerale}</td>
                    {generales.map((g, i) => (
                      <td key={i} className="px-3 py-3 text-center tabular-nums">
                        {moyenneLisible(g, loc)}
                        {rangs[i] && <span className="block text-[0.68rem] font-normal text-foreground-muted">{fmt(t.rang, { rang: rangs[i]! })}</span>}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-background/60">
                    <td className="px-5 pb-3" colSpan={2}>{t.appreciation}</td>
                    {generales.map((g, i) => {
                      const a = appreciationPour(bareme, g)
                      return (
                        <td key={i} className="px-3 pb-3 text-center">
                          {a && <span className={`inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${TEINTES_APPRECIATION[a.categorie]}`}>{a.libelle}</span>}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {annuelle !== null && (
            <div className="flex flex-wrap items-center gap-3 border-t border-surface-border px-5 py-4">
              <span className="text-sm text-foreground-muted">{t.moyenneAnnuelle}</span>
              <span className="font-heading text-2xl font-semibold tabular-nums text-foreground">{moyenneLisible(annuelle, loc)}</span>
              {(() => {
                const a = appreciationPour(bareme, Number(annuelle))
                return a ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TEINTES_APPRECIATION[a.categorie]}`}>{a.libelle}</span> : null
              })()}
            </div>
          )}

          {/* Assiduité */}
          <div className="border-t border-surface-border px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarCheck className="h-4 w-4 text-primary" /> {fmt(t.assiduite, { annee: inscription?.annees_scolaires?.libelle ?? '' })}
            </h3>
            {heures === 0 && retards === 0 && evaluationsManquees === 0 ? (
              <p className="mt-2 text-sm text-foreground-muted">{t.aucuneAbsence}</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {heures > 0 && <li className={`rounded-lg px-3 py-1.5 ${heuresNJ >= 10 ? 'bg-danger/10 text-danger' : 'bg-background text-foreground'}`}>{fmt(t.heuresAbsence, { h: heures, nj: heuresNJ })}</li>}
                {retards > 0 && <li className="flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5"><Clock className="h-3.5 w-3.5" /> {fmt(t.retards, { n: retards })}</li>}
                {evaluationsManquees > 0 && <li className="rounded-lg bg-warning/10 px-3 py-1.5 text-warning">{fmt(t.absentEvaluation, { n: evaluationsManquees })}</li>}
              </ul>
            )}
          </div>
        </section>
      </div>

      {finance && inscription && (
        <section className={cardClass}>
          <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-4">
            <h2 className="flex-1 font-heading text-base font-semibold text-foreground">{fmt(dict.finances.situation, { annee: inscription.annees_scolaires?.libelle ?? '' })}</h2>
            {situation && (
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-background px-2.5 py-1">{dict.finances.totalDu} · {situation.du.toLocaleString(loc)}</span>
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-success">{dict.finances.totalPaye} · {situation.paye.toLocaleString(loc)}</span>
                <span className={`rounded-full px-2.5 py-1 ${situation.resteADate > 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>{dict.finances.resteEchu} · {situation.resteADate.toLocaleString(loc)}</span>
                <span className="rounded-full bg-background px-2.5 py-1">{dict.finances.totalReste} · {situation.reste.toLocaleString(loc)}</span>
              </div>
            )}
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{dict.finances.servicesSouscrits}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(servicesEleve ?? []).map((sv, i) => {
                  const x = un(sv.services as unknown as { nom: string; tarif: number; periodicite: string } | null)
                  return <li key={i}>{x?.nom}{sv.details ? <span className="text-foreground-muted"> · {sv.details}</span> : null}</li>
                })}
                {(servicesEleve ?? []).length === 0 && <li className="text-foreground-muted">—</li>}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{dict.finances.derniersPaiements}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(paiementsEleve ?? []).map((p) => (
                  <li key={p.numero_recu} className="flex justify-between gap-3">
                    <span>{p.libelle} <span className="font-mono text-xs text-foreground-muted">{p.numero_recu}</span></span>
                    <span className="tabular-nums">{Number(p.montant).toLocaleString(loc)}</span>
                  </li>
                ))}
                {(paiementsEleve ?? []).length === 0 && <li className="text-foreground-muted">—</li>}
              </ul>
            </div>
          </div>
        </section>
      )}

      {documentsVisibles && (
        <section className={cardClass}>
          <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-4">
            <h2 className="flex-1 font-heading text-base font-semibold text-foreground">{dict.documents.documentsEleve}</h2>
            {context.acces === 'complet' && inscription && (
              <EmettreDocumentButton anneeId={inscription.annee_id} eleveFixe={id} dict={dict} lang={locale} locale={loc} />
            )}
          </div>
          <ul className="divide-y divide-surface-border">
            {(documents ?? []).map((d) => (
              <li key={d.id} className={`flex items-center gap-3 px-5 py-2.5 text-sm ${d.annule ? 'opacity-60' : ''}`}>
                <span className="min-w-0 flex-1">
                  {dict.documents.types[d.type as TypeDocument]}
                  <span className="ms-2 font-mono text-xs text-foreground-muted">{d.numero}</span>
                  {d.annule && <span className="ms-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">{dict.documents.annule}</span>}
                </span>
                <span className="text-xs text-foreground-muted">{new Date(d.emis_le).toLocaleDateString(loc)}</span>
                <LigneDocumentActions id={d.id} annule={d.annule} ecriture={context.acces === 'complet'} dict={dict} lang={locale} locale={loc} />
              </li>
            ))}
            {(documents ?? []).length === 0 && <li className="px-5 py-8 text-center text-sm text-foreground-muted">{dict.documents.aucun}</li>}
          </ul>
        </section>
      )}
    </div>
  )
}
