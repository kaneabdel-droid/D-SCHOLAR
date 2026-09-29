import Link from 'next/link'
import { notFound } from 'next/navigation'
import EmploiGrid from '@/components/EmploiGrid'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getFamilleContext } from '@/lib/auth/getFamilleContext'
import { chargerCreneaux } from '@/lib/emploi'
import { situationsFinancieres } from '@/lib/finances'
import { appreciationPour, baremeAppreciations, libellePeriode, moyenneLisible, TEINTES_APPRECIATION, un } from '@/lib/scolarite'
import type { TypeDocument } from '@/lib/documents'
import { TEINTES_BILLET, type TypeBillet } from '@/lib/billets'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import { LigneDocumentActions } from '@/app/(dashboard)/attestations/DocumentsClient'
import { LignePaiementActions } from '@/app/(dashboard)/services/ServicesClient'
import JustifierAbsence from '../JustifierAbsence'

const VUES = ['notes', 'bulletins', 'emploi', 'assiduite', 'documents', 'paiements'] as const
type Vue = (typeof VUES)[number]

type NoteLigne = {
  id: string
  valeur: number | null
  absent: boolean
  evaluations: {
    libelle: string | null
    date_evaluation: string
    bareme: number
    periodes: { annee_id: string } | null
    types_evaluation: { libelle: string } | null
    enseignements: { matieres: { nom: string; couleur: string } | null } | null
  } | null
}

// Suivi d'un enfant : notes publiées, bulletins des périodes clôturées, emploi
// du temps, assiduité (avec justification), documents et paiements.
export default async function PortailEleve({ params, searchParams }: { params: Promise<{ eleveId: string }>; searchParams: Promise<{ vue?: string }> }) {
  const famille = await getFamilleContext()
  const { eleveId } = await params
  const sp = await searchParams
  const enfant = famille.enfants.find((e) => e.id === eleveId)
  if (!enfant) notFound()

  const vues = VUES.filter((v) => v !== 'paiements' || famille.type === 'parent')
  const vue: Vue = (vues as readonly string[]).includes(sp.vue ?? '') ? (sp.vue as Vue) : 'notes'
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.portail
  const date = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' })
  const n = (v: number | null | undefined) => moyenneLisible(v, loc)

  let contenu: React.ReactNode = null

  if (vue === 'notes') {
    const { data } = enfant.anneeId
      ? await supabase
          .from('notes')
          .select('id, valeur, absent, evaluations!inner(libelle, date_evaluation, bareme, periodes!inner(annee_id), types_evaluation(libelle), enseignements(matieres(nom, couleur)))')
          .eq('eleve_id', eleveId)
          .eq('evaluations.periodes.annee_id', enfant.anneeId)
      : { data: [] }
    const lignes = ((data ?? []) as unknown as NoteLigne[])
      .map((l) => ({ ...l, ev: un(l.evaluations) }))
      .filter((l) => l.ev)
      .sort((a, b) => b.ev!.date_evaluation.localeCompare(a.ev!.date_evaluation))
    contenu = (
      <section className={cardClass}>
        <ul className="divide-y divide-surface-border">
          {lignes.map((l) => {
            const m = un(un(l.ev!.enseignements)?.matieres)
            return (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: m?.couleur ?? '#94A3B8' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{m?.nom ?? '—'}</p>
                  <p className="truncate text-xs text-foreground-muted">{[un(l.ev!.types_evaluation)?.libelle, l.ev!.libelle].filter(Boolean).join(' · ')} · {date(l.ev!.date_evaluation)}</p>
                </div>
                {l.absent ? (
                  <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">{t.absentEval}</span>
                ) : (
                  <span className="text-end font-heading text-lg font-semibold tabular-nums text-foreground" dir="ltr">
                    {n(l.valeur)}<span className="text-xs font-normal text-foreground-muted">/{Number(l.ev!.bareme)}</span>
                  </span>
                )}
              </li>
            )
          })}
          {lignes.length === 0 && <li className="px-4 py-12 text-center text-sm text-foreground-muted">{t.aucuneNote}</li>}
        </ul>
      </section>
    )
  }

  if (vue === 'bulletins' && enfant.classeId) {
    const [{ data: periodes }, { data: matieres }, bareme] = await Promise.all([
      supabase.rpc('periodes_classe', { p_classe_id: enfant.classeId }),
      supabase.from('matieres').select('id, nom'),
      baremeAppreciations(supabase),
    ])
    const noms = new Map((matieres ?? []).map((m) => [m.id, m.nom]))
    const liste = (periodes ?? []) as { id: string; rang: number; decoupage: string; verrouillee: boolean }[]
    const bulletins = await Promise.all(
      liste.map(async (p) => ({ p, lignes: p.verrouillee ? (((await supabase.rpc('bulletin_eleve', { p_eleve_id: eleveId, p_periode_id: p.id })).data ?? []) as { matiere_id: string; moyenne: number; coefficient: number; moyenne_generale: number | null; rang: number | null; effectif: number }[]) : null }))
    )
    contenu = (
      <div className="space-y-4">
        {bulletins.map(({ p, lignes }) => {
          const g = lignes?.[0]
          const app = appreciationPour(bareme, g?.moyenne_generale != null ? Number(g.moyenne_generale) : null)
          return (
            <section key={p.id} className={cardClass}>
              <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-4">
                <h2 className="flex-1 font-heading text-base font-semibold text-foreground">{libellePeriode(dict.annees, p)}</h2>
                {g && (
                  <span className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary" dir="ltr">{n(g.moyenne_generale)} / 20</span>
                    <span className="rounded-full bg-background px-2.5 py-1">{dict.classes.rangCol} {g.rang ?? '—'}/{g.effectif}</span>
                    {app && <span className={`rounded-full px-2.5 py-1 ${TEINTES_APPRECIATION[app.categorie]}`}>{app.libelle}</span>}
                  </span>
                )}
              </div>
              {lignes === null ? (
                <p className="px-5 py-6 text-sm text-foreground-muted">{t.periodeOuverte}</p>
              ) : (
                <ul className="divide-y divide-surface-border text-sm">
                  {[...lignes].sort((a, b) => Number(b.coefficient) - Number(a.coefficient)).map((l) => (
                    <li key={l.matiere_id} className="flex justify-between gap-3 px-5 py-2">
                      <span>{noms.get(l.matiere_id) ?? '—'} <span className="text-xs text-foreground-muted">· {dict.eleves.coef} {Number(l.coefficient)}</span></span>
                      <span className="font-semibold tabular-nums" dir="ltr">{n(l.moyenne)}</span>
                    </li>
                  ))}
                  {lignes.length === 0 && <li className="px-5 py-6 text-foreground-muted">{t.aucuneNote}</li>}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    )
  }

  if (vue === 'emploi' && enfant.classeId) {
    const creneaux = await chargerCreneaux(supabase, { classeId: enfant.classeId })
    contenu = <section className={`${cardClass} p-3 sm:p-5`}><EmploiGrid creneaux={creneaux} jours={dict.scolarite.jours} vide={dict.emplois.vide} /></section>
  }

  if (vue === 'assiduite') {
    const { data: billets } = enfant.anneeId
      ? await supabase.from('billets').select('id, type, numero, emis_le, motif, minutes_retard, heure_retour').eq('eleve_id', eleveId).eq('annee_id', enfant.anneeId).order('emis_le', { ascending: false }).limit(50)
      : { data: [] }
    const { data } = enfant.anneeId
      ? await supabase.from('absences').select('id, date_absence, type, duree, justifiee, motif, justification_parent').eq('eleve_id', eleveId).eq('annee_id', enfant.anneeId).order('date_absence', { ascending: false })
      : { data: [] }
    const libelles = { justifier: t.justifier, motif: t.motif, envoyer: t.envoyer, annuler: dict.common.cancel, envoye: t.justificationEnvoyee }
    contenu = (
      <>
      <section className={cardClass}>
        <ul className="divide-y divide-surface-border">
          {(data ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.type === 'retard' ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'}`}>{dict.assiduite.types[a.type as 'absence' | 'retard']}</span>
              <span className="flex-1 text-foreground">{date(a.date_absence)} · {a.type === 'retard' ? fmt(t.minutes, { n: Number(a.duree) }) : fmt(t.heures, { n: Number(a.duree) })}</span>
              {a.justifiee ? (
                <span className="text-xs font-semibold text-success">{t.justifiee}</span>
              ) : a.justification_parent ? (
                <span className="text-xs font-medium text-foreground-muted">{t.enAttente}</span>
              ) : (
                <JustifierAbsence absenceId={a.id} eleveId={eleveId} libelles={libelles} />
              )}
              {(a.motif || a.justification_parent) && <p className="w-full text-xs text-foreground-muted">{a.motif || a.justification_parent}</p>}
            </li>
          ))}
          {(data ?? []).length === 0 && <li className="px-4 py-12 text-center text-sm text-foreground-muted">{t.aucuneAbsence}</li>}
        </ul>
      </section>
      {(billets ?? []).length > 0 && (
        <section className={`${cardClass} mt-4`}>
          <h2 className="border-b border-surface-border px-4 py-3 text-sm font-semibold text-foreground">{dict.billets.title}</h2>
          <ul className="divide-y divide-surface-border">
            {(billets ?? []).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_BILLET[b.type as TypeBillet]}`}>{dict.billets.types[b.type as TypeBillet]}</span>
                <span className="flex-1 text-foreground">
                  {new Date(b.emis_le).toLocaleString(loc, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {b.minutes_retard ? ` · ${fmt(t.minutes, { n: b.minutes_retard })}` : ''}
                </span>
                <span className="font-mono text-xs text-foreground-muted">{b.numero}</span>
                {b.motif && <p className="w-full text-xs text-foreground-muted">{b.motif}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      </>
    )
  }

  if (vue === 'documents') {
    const { data } = await supabase.from('documents_emis').select('id, type, numero, emis_le').eq('eleve_id', eleveId).order('emis_le', { ascending: false })
    contenu = (
      <section className={cardClass}>
        <ul className="divide-y divide-surface-border">
          {(data ?? []).map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{dict.documents.types[d.type as TypeDocument] ?? d.type}</span>
                <span className="font-mono text-xs text-foreground-muted">{d.numero} · {new Date(d.emis_le).toLocaleDateString(loc)}</span>
              </span>
              <LigneDocumentActions id={d.id} annule={false} ecriture={false} dict={dict} lang={locale} locale={loc} />
            </li>
          ))}
          {(data ?? []).length === 0 && <li className="px-4 py-12 text-center text-sm text-foreground-muted">{dict.documents.aucun}</li>}
        </ul>
      </section>
    )
  }

  if (vue === 'paiements' && enfant.anneeId) {
    const [situations, { data: paiements }, { data: services }] = await Promise.all([
      situationsFinancieres(supabase, enfant.anneeId, [eleveId]),
      supabase.from('paiements_eleves').select('id, libelle, montant, date_paiement, numero_recu').eq('eleve_id', eleveId).eq('annee_id', enfant.anneeId).order('date_paiement', { ascending: false }),
      supabase.from('souscriptions_services').select('id, details, services(nom)').eq('eleve_id', eleveId).eq('annee_id', enfant.anneeId),
    ])
    const s = situations.get(eleveId) ?? { du: 0, paye: 0, reste: 0 }
    const f = dict.finances
    const m = (v: number) => `${v.toLocaleString(loc)} ${dict.abonnement.fcfa}`
    contenu = (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[{ l: f.totalDu, v: s.du, c: 'text-foreground' }, { l: f.totalPaye, v: s.paye, c: 'text-success' }, { l: f.totalReste, v: s.reste, c: s.reste > 0 ? 'text-danger' : 'text-success' }].map((k) => (
            <div key={k.l} className={`${cardClass} p-3 sm:p-4`}>
              <p className="text-xs text-foreground-muted">{k.l}</p>
              <p className={`mt-1 font-heading text-base font-semibold tabular-nums sm:text-xl ${k.c}`}>{m(k.v)}</p>
            </div>
          ))}
        </div>
        {(services ?? []).length > 0 && (
          <section className={`${cardClass} p-4 text-sm`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{f.servicesSouscrits}</p>
            <p className="mt-2">{(services ?? []).map((x) => [un(x.services as unknown as { nom: string } | null)?.nom, x.details].filter(Boolean).join(' · ')).join(' — ')}</p>
          </section>
        )}
        <section className={cardClass}>
          <ul className="divide-y divide-surface-border">
            {(paiements ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{p.libelle}</span>
                  <span className="font-mono text-xs text-foreground-muted">{p.numero_recu} · {new Date(p.date_paiement + 'T00:00:00').toLocaleDateString(loc)}</span>
                </span>
                <span className="font-semibold tabular-nums">{m(Number(p.montant))}</span>
                <LignePaiementActions id={p.id} ecriture={false} dict={dict} lang={locale} locale={loc} />
              </li>
            ))}
            {(paiements ?? []).length === 0 && <li className="px-4 py-12 text-center text-sm text-foreground-muted">{t.aucunPaiement}</li>}
          </ul>
        </section>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold text-foreground">{enfant.prenom} {enfant.nom}</h1>
        <p className="text-sm text-foreground-muted">{enfant.classe ?? '—'} · <span className="font-mono text-xs">{enfant.matricule}</span></p>
      </div>
      <nav className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-xl border border-surface-border bg-surface p-1 shadow-xs">
          {vues.map((v) => (
            <Link key={v} href={`/portail/${eleveId}?vue=${v}`} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${vue === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground-muted hover:bg-primary-soft hover:text-foreground'}`}>
              {t.vues[v]}
            </Link>
          ))}
        </div>
      </nav>
      {contenu ?? <p className={`${cardClass} px-5 py-12 text-center text-sm text-foreground-muted`}>{t.pasDeClasse}</p>}
    </div>
  )
}
